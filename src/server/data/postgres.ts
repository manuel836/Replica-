import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import postgres, { type Sql } from "postgres";
import type {
  AdminUser,
  AvailabilityRule,
  BlockedDate,
  Booking,
  BookingEvent,
  Business,
  Conflict,
  Customer,
  Message,
  OutboxItem,
  Package,
  Payment,
  Review,
  Zone,
} from "@/lib/types";
import type { CustomerRow, DataStore } from "./store";

// Capa de datos con Postgres (postgres-js). Nombres snake_case en la base, camelCase aquí.
// withDayLock abre una transacción con pg_advisory_xact_lock y todas las consultas que
// ocurren dentro (aunque vengan de otros módulos) usan esa transacción gracias a
// AsyncLocalStorage: lo que se escribe bajo el candado se confirma o se deshace junto.

type Row = Record<string, unknown>;

const g = globalThis as unknown as { __dgSql?: Sql };
function pool(): Sql {
  return (g.__dgSql ??= postgres(process.env.DATABASE_URL!, {
    // prepare: false para el pooler de Supabase en modo transacción (puerto 6543).
    prepare: false,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idle_timeout: 20,
    onnotice: false,
    transform: { ...postgres.camel, undefined: null, json: false },
  }));
}

const txStore = new AsyncLocalStorage<Sql>();
/** La conexión de la transacción actual, o el pool. */
const q = (): Sql => txStore.getStore() ?? pool();

const slug = () => process.env.BUSINESS_SLUG ?? "dgarden";

// ---------------- conversiones ----------------

const d = (v: unknown): string => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
const dOrNull = (v: unknown): string | null => (v == null ? null : d(v));
const hm = (v: unknown): string => String(v).slice(0, 5);

const business = (r: Row): Business => ({ ...(r as unknown as Business) });
const rule = (r: Row): AvailabilityRule => ({
  ...(r as unknown as AvailabilityRule),
  firstStart: hm(r.firstStart),
  lastStart: hm(r.lastStart),
});
const blocked = (r: Row): BlockedDate => ({ ...(r as unknown as BlockedDate), date: d(r.date) });
const booking = (r: Row): Booking => ({
  ...(r as unknown as Booking),
  eventDate: d(r.eventDate),
  proposedEventDate: dOrNull(r.proposedEventDate),
});
const admin = (r: Row): AdminUser => ({
  id: r.id as string,
  businessId: r.businessId as string,
  email: r.email as string,
  role: r.role as AdminUser["role"],
  sessionVersion: r.sessionVersion as number,
});
const strip = <T extends Row>(r: T) => {
  const { createdAt: _c, updatedAt: _u, ...rest } = r;
  void _c;
  void _u;
  return rest;
};

// Columnas que se pueden escribir (evita que un patch toque id, business_id o fechas de sistema).
const BUSINESS_COLS = [
  "name", "description", "whatsappE164", "email", "city", "timezone", "currency", "bookingCodePrefix", "photoPaths",
  "depositMode", "depositType", "depositValue", "confirmationMode", "requestHoldHours", "paymentHoldMinutes",
  "proposalHoldHours", "cancellationPolicy", "refundCutoffDays", "minNoticeDays", "maxAdvanceDays", "teams",
  "whatsappTemplates",
] as const;
const BOOKING_COLS = [
  "code", "manageTokenHash", "manageTokenVersion", "idempotencyKey", "customerId", "packageId", "zoneId", "eventDate",
  "startAt", "endAt", "travelBufferMin", "guests", "address", "neighborhood", "addressNotes", "eventType",
  "customerNotes", "internalNotes", "pricePerGuestCents", "subtotalCents", "travelFeeCents", "addonsCents",
  "totalCents", "depositCents", "status", "holdExpiresAt", "proposedStartAt", "proposedEndAt", "proposedEventDate",
  "proposalExpiresAt", "source", "capacityOverride", "needsAttention", "confirmedAt", "cancelledAt", "cancelReason",
  "completedAt",
] as const;
const CUSTOMER_COLS = ["name", "whatsappE164", "email", "notes", "anonymizedAt"] as const;
const PAYMENT_COLS = ["status", "providerRef", "method", "paidAt", "checkoutRef", "amountCents"] as const;

function pick<T extends Row>(patch: T, cols: readonly string[]): Row {
  const out: Row = {};
  for (const k of cols) if (k in patch && patch[k] !== undefined) out[k] = patch[k];
  return out;
}

async function one<T>(rows: Promise<Row[]> | Row[], map: (r: Row) => T): Promise<T | null> {
  const r = await rows;
  return r.length ? map(r[0]) : null;
}

const notFound = (what: string) => new Error(`${what} no encontrado`);

// ---------------- implementación ----------------

export const postgresStore: DataStore = {
  kind: "postgres",

  async getBusiness() {
    const b = await one(q()`select * from businesses where slug = ${slug()}`, business);
    if (!b) throw new Error(`No existe el negocio "${slug()}". Corre npm run db:seed.`);
    return b;
  },
  async updateBusiness(id, patch) {
    const p = pick(patch as Row, BUSINESS_COLS);
    if (Object.keys(p).length === 0) return (await one(q()`select * from businesses where id = ${id}`, business))!;
    return (await one(q()`update businesses set ${q()(p)} where id = ${id} returning *`, business))!;
  },

  async listRules(businessId) {
    return (await q()`select * from availability_rules where business_id = ${businessId} order by weekday`).map(rule);
  },
  async saveRules(businessId, rules) {
    const run = async (tx: Sql) => {
      await tx`delete from availability_rules where business_id = ${businessId}`;
      for (const r of rules) await tx`insert into availability_rules ${tx({ ...r, businessId })}`;
    };
    const inTx = txStore.getStore();
    if (inTx) await run(inTx);
    else await pool().begin((tx) => run(tx as unknown as Sql));
  },
  async listBlockedDates(businessId) {
    return (await q()`select * from blocked_dates where business_id = ${businessId} order by date`).map(blocked);
  },
  async addBlockedDate(businessId, date, reason) {
    return (await one(
      q()`insert into blocked_dates (business_id, date, reason) values (${businessId}, ${date}, ${reason})
          on conflict (business_id, date) do update set reason = excluded.reason returning *`,
      blocked,
    ))!;
  },
  async removeBlockedDate(businessId, date) {
    await q()`delete from blocked_dates where business_id = ${businessId} and date = ${date}`;
  },

  async listPackages(businessId) {
    return (await q()`select * from packages where business_id = ${businessId} order by sort_order, created_at`) as unknown as Package[];
  },
  async getPackage(businessId, id) {
    return one(q()`select * from packages where business_id = ${businessId} and id = ${id}`, (r) => r as unknown as Package);
  },
  async savePackage(businessId, input) {
    const { id, ...rest } = input;
    const data = strip({ ...rest } as Row);
    delete data.businessId;
    if (id) {
      const r = await one(q()`update packages set ${q()(data)} where business_id = ${businessId} and id = ${id} returning *`, (x) => x as unknown as Package);
      if (!r) throw notFound("Paquete");
      return r;
    }
    return (await one(q()`insert into packages ${q()({ ...data, businessId })} returning *`, (x) => x as unknown as Package))!;
  },
  async listZones(businessId) {
    return (await q()`select * from service_zones where business_id = ${businessId} order by sort_order, created_at`) as unknown as Zone[];
  },
  async getZone(businessId, id) {
    return one(q()`select * from service_zones where business_id = ${businessId} and id = ${id}`, (r) => r as unknown as Zone);
  },
  async saveZone(businessId, input) {
    const { id, ...rest } = input;
    const data = strip({ ...rest } as Row);
    delete data.businessId;
    if (id) {
      const r = await one(q()`update service_zones set ${q()(data)} where business_id = ${businessId} and id = ${id} returning *`, (x) => x as unknown as Zone);
      if (!r) throw notFound("Zona");
      return r;
    }
    return (await one(q()`insert into service_zones ${q()({ ...data, businessId })} returning *`, (x) => x as unknown as Zone))!;
  },

  async getCustomer(businessId, id) {
    return one(q()`select * from customers where business_id = ${businessId} and id = ${id}`, (r) => r as unknown as Customer);
  },
  async findCustomerByWhatsapp(businessId, whatsappE164) {
    return one(q()`select * from customers where business_id = ${businessId} and whatsapp_e164 = ${whatsappE164}`, (r) => r as unknown as Customer);
  },
  async insertCustomer(c) {
    return (await one(q()`insert into customers ${q()(c as unknown as Row)} returning *`, (r) => r as unknown as Customer))!;
  },
  async updateCustomer(businessId, id, patch) {
    const p = pick(patch as Row, CUSTOMER_COLS);
    const r = await one(q()`update customers set ${q()(p)} where business_id = ${businessId} and id = ${id} returning *`, (x) => x as unknown as Customer);
    if (!r) throw notFound("Cliente");
    return r;
  },
  async listCustomers(businessId, search) {
    const needle = search?.trim() ? `%${search.trim().replace(/[%_\\]/g, (m) => `\\${m}`)}%` : null;
    const rows = await q()`
      select c.*, count(b.id)::int as booking_count, max(b.event_date) as last_event_date
      from customers c
      left join bookings b on b.customer_id = c.id
      where c.business_id = ${businessId}
        ${needle ? q()`and (c.name ilike ${needle} or c.whatsapp_e164 ilike ${needle})` : q()``}
      group by c.id
      order by max(b.event_date) desc nulls last, c.created_at desc
      limit 200`;
    return rows.map((r) => ({ ...(r as unknown as CustomerRow), lastEventDate: dOrNull(r.lastEventDate) }));
  },

  async listBookingsTouching(businessId, from, to) {
    return (
      await q()`select * from bookings where business_id = ${businessId}
        and ((event_date between ${from} and ${to}) or (proposed_event_date between ${from} and ${to}))`
    ).map(booking);
  },
  async listBookings(businessId, f = {}) {
    const x = q();
    return (
      await x`select * from bookings where business_id = ${businessId}
        ${f.statuses ? x`and status = any(${f.statuses}::text[])` : x``}
        ${f.from ? x`and event_date >= ${f.from}` : x``}
        ${f.to ? x`and event_date <= ${f.to}` : x``}
        ${f.customerId ? x`and customer_id = ${f.customerId}` : x``}
        ${f.needsAttention !== undefined ? x`and needs_attention = ${f.needsAttention}` : x``}
        order by start_at limit 1000`
    ).map(booking);
  },
  async getBooking(businessId, id) {
    return one(q()`select * from bookings where business_id = ${businessId} and id = ${id}`, booking);
  },
  async getBookingByCode(code) {
    return one(q()`select * from bookings where code = ${code}`, booking);
  },
  async findBookingByIdempotencyKey(businessId, key) {
    return one(q()`select * from bookings where business_id = ${businessId} and idempotency_key = ${key}`, booking);
  },
  async codeExists(code) {
    return (await q()`select 1 from bookings where code = ${code}`).length > 0;
  },
  async insertBooking(b) {
    return (await one(q()`insert into bookings ${q()(b as unknown as Row)} returning *`, booking))!;
  },
  async updateBooking(businessId, id, patch) {
    const p = pick(patch as Row, BOOKING_COLS);
    const r = await one(q()`update bookings set ${q()(p)} where business_id = ${businessId} and id = ${id} returning *`, booking);
    if (!r) throw notFound("Taquiza");
    return r;
  },
  async countBookingsByCustomerSince(businessId, customerId, since) {
    const [r] = await q()`select count(*)::int as n from bookings
      where business_id = ${businessId} and customer_id = ${customerId} and created_at >= ${since}`;
    return r.n as number;
  },

  async addEvent(e) {
    await q()`insert into booking_events ${q()(e as unknown as Row)}`;
  },
  async listEvents(bookingId) {
    return (await q()`select * from booking_events where booking_id = ${bookingId} order by created_at desc`) as unknown as BookingEvent[];
  },
  async addMessage(m) {
    await q()`insert into messages ${q()(m as unknown as Row)}`;
  },
  async listMessages(bookingId) {
    return (await q()`select * from messages where booking_id = ${bookingId} order by created_at`) as unknown as Message[];
  },
  async addPayment(p) {
    return (await one(q()`insert into payments ${q()(p as unknown as Row)} returning *`, (r) => r as unknown as Payment))!;
  },
  async updatePayment(id, patch) {
    const r = await one(q()`update payments set ${q()(pick(patch as Row, PAYMENT_COLS))} where id = ${id} returning *`, (x) => x as unknown as Payment);
    if (!r) throw notFound("Pago");
    return r;
  },
  async listPayments(bookingId) {
    return (await q()`select * from payments where booking_id = ${bookingId} order by created_at`) as unknown as Payment[];
  },
  async findPayment(provider, providerRef) {
    return one(q()`select * from payments where provider = ${provider} and provider_ref = ${providerRef}`, (r) => r as unknown as Payment);
  },
  async findPaymentByCheckout(checkoutRef) {
    return one(q()`select * from payments where checkout_ref = ${checkoutRef} order by created_at desc limit 1`, (r) => r as unknown as Payment);
  },
  async findLatestPendingDeposit(bookingId) {
    return one(
      q()`select * from payments where booking_id = ${bookingId} and kind = 'deposit' and status = 'pending'
          and provider <> 'manual' order by created_at desc limit 1`,
      (r) => r as unknown as Payment,
    );
  },
  async addReview(r) {
    return (await one(q()`insert into reviews ${q()(r as unknown as Row)} returning *`, (x) => x as unknown as Review))!;
  },
  async getReviewByBooking(bookingId) {
    return one(q()`select * from reviews where booking_id = ${bookingId}`, (r) => r as unknown as Review);
  },
  async listReviews(businessId, opts) {
    return (await q()`select * from reviews where business_id = ${businessId}
      ${opts?.publishedOnly ? q()`and is_published` : q()``} order by created_at desc limit 200`) as unknown as Review[];
  },
  async setReviewPublished(businessId, id, published) {
    await q()`update reviews set is_published = ${published}, reviewed_at = now() where business_id = ${businessId} and id = ${id}`;
  },

  async findAdminByEmail(email) {
    return one(q()`select * from admin_users where email = ${email.trim().toLowerCase()}`, admin);
  },
  async getAdmin(id) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    return one(q()`select * from admin_users where id = ${id}`, admin);
  },
  async bumpSessionVersion(adminId) {
    await q()`update admin_users set session_version = session_version + 1 where id = ${adminId}`;
  },
  async listAdmins(businessId) {
    // "owner" > "helper" en orden alfabético inverso: el dueño va primero.
    return (await q()`select * from admin_users where business_id = ${businessId} order by role desc, created_at`).map(admin);
  },
  async addAdmin(businessId, email, role) {
    const [r] = await q()`insert into admin_users (business_id, email, role)
      values (${businessId}, ${email.trim().toLowerCase()}, ${role}) returning *`;
    return admin(r);
  },
  async removeAdmin(businessId, id) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return;
    await q()`delete from admin_users where id = ${id} and business_id = ${businessId}`;
  },
  async createLoginToken(adminId, tokenHash, expiresAt) {
    await q()`insert into login_tokens (admin_id, token_hash, expires_at) values (${adminId}, ${tokenHash}, ${expiresAt})`;
  },
  async consumeLoginToken(tokenHash) {
    const [r] = await q()`update login_tokens set used_at = now()
      where token_hash = ${tokenHash} and used_at is null and expires_at > now() returning admin_id`;
    return (r?.adminId as string) ?? null;
  },
  async hitRateLimit(key, windowSeconds, max) {
    const [r] = await q()`
      insert into rate_limits (key, window_start, hits)
      values (${key}, to_timestamp(floor(extract(epoch from now()) / ${windowSeconds}) * ${windowSeconds}), 1)
      on conflict (key, window_start) do update set hits = rate_limits.hits + 1
      returning hits`;
    return (r.hits as number) <= max;
  },

  async capacityConflict(i) {
    const [r] = await q()`select capacity_conflict(
      ${i.businessId}::uuid, ${i.date}::date, ${i.start}::timestamptz, ${i.end}::timestamptz,
      ${i.guests}::int, ${i.travelBufferMin}::int, ${i.excludeBookingId ?? null}::uuid) as conflict`;
    return (r.conflict as Conflict | null) ?? null;
  },

  async recordWebhookEvent(provider, eventId, topic, payload) {
    const [ins] = await q()`insert into webhook_events (provider, event_id, topic, payload)
      values (${provider}, ${eventId}, ${topic}, ${q().json(payload as postgres.JSONValue)}) on conflict (provider, event_id) do nothing returning id`;
    if (ins) return { id: ins.id as string, isNew: true, processed: false };
    const [ex] = await q()`select id, processed_at from webhook_events where provider = ${provider} and event_id = ${eventId}`;
    return { id: ex.id as string, isNew: false, processed: ex.processedAt != null };
  },
  async markWebhookProcessed(id, error = null) {
    await q()`update webhook_events set processed_at = case when ${error}::text is null then now() end, error = ${error} where id = ${id}`;
  },

  async enqueueOutbox(item) {
    return (await one(q()`insert into outbox (business_id, payload) values (${item.businessId}, ${q().json(item.payload)}) returning *`, (r) => r as unknown as OutboxItem))!;
  },
  async listDueOutbox(limit) {
    return (await q()`select * from outbox where sent_at is null and dead_at is null and next_attempt_at <= now()
      order by next_attempt_at limit ${limit}`) as unknown as OutboxItem[];
  },
  async updateOutbox(id, patch) {
    await q()`update outbox set ${q()(patch as Row)} where id = ${id}`;
  },
  async listDeadOutbox(businessId) {
    return (await q()`select * from outbox where business_id = ${businessId} and dead_at is not null order by dead_at desc limit 50`) as unknown as OutboxItem[];
  },

  async purgeExpired() {
    const a = await q()`delete from rate_limits where window_start < now() - interval '2 days'`;
    const b = await q()`delete from login_tokens where created_at < now() - interval '7 days'`;
    return a.count + b.count;
  },

  async startJobRun(name) {
    const [r] = await q()`insert into job_runs (name) values (${name}) returning id`;
    return r.id as string;
  },
  async finishJobRun(id, status, detail, error = null) {
    await q()`update job_runs set status = ${status}, detail = ${q().json(detail as postgres.JSONValue)}, error = ${error}, finished_at = now() where id = ${id}`;
  },

  async withDayLock(businessId, dates, fn) {
    if (txStore.getStore()) {
      // Ya dentro de una transacción: tomar los candados que falten en la misma.
      for (const day of [...new Set(dates)].sort()) await q()`select lock_business_day(${businessId}::uuid, ${day}::date)`;
      return fn();
    }
    return pool().begin(async (tx) => {
      for (const day of [...new Set(dates)].sort()) await tx`select lock_business_day(${businessId}::uuid, ${day}::date)`;
      return txStore.run(tx as unknown as Sql, fn);
    }) as Promise<Awaited<ReturnType<typeof fn>>>;
  },
};
