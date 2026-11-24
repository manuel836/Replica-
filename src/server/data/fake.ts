import { randomUUID } from "node:crypto";
import type {
  AdminUser,
  OutboxItem,
  AvailabilityRule,
  BlockedDate,
  Booking,
  BookingEvent,
  Business,
  Customer,
  Message,
  Package,
  Payment,
  Review,
  Zone,
} from "@/lib/types";
import { capacityConflict, loadsForDate } from "@/server/domain/availability";
import { addDaysLocal, localToInstant, todayLocal, weekdayOf } from "@/server/domain/time";
import { manageTokenHash } from "@/server/tokens";
import type { CustomerRow, DataStore } from "./store";

// Capa de datos en memoria para desarrollar sin base de datos. Vive en globalThis para
// sobrevivir a la recarga en caliente de `next dev`. Se pierde al reiniciar el servidor.

interface Tables {
  business: Business;
  rules: AvailabilityRule[];
  blocked: BlockedDate[];
  packages: Package[];
  zones: Zone[];
  customers: Customer[];
  bookings: Booking[];
  events: BookingEvent[];
  messages: Message[];
  payments: Payment[];
  reviews: Review[];
  admins: AdminUser[];
  loginTokens: { adminId: string; tokenHash: string; expiresAt: Date; usedAt: Date | null }[];
  rateLimits: Map<string, number>;
  webhookEvents: { id: string; provider: string; eventId: string; processed: boolean; error: string | null }[];
  outbox: OutboxItem[];
  jobRuns: { id: string; name: string; status: string; detail: Record<string, unknown>; error: string | null }[];
}

const BUSINESS_ID = "00000000-0000-4000-8000-000000000001";
const TZ = "America/Mexico_City";

function seed(): Tables {
  const business: Business = {
    id: BUSINESS_ID,
    slug: "dgarden",
    name: "D' Garden Tacos",
    description:
      "Llevamos la plancha a tu evento en Lázaro Cárdenas: tacos hechos al momento para tus invitados. (Texto de ejemplo: el dueño lo cambia en Ajustes.)",
    whatsappE164: null,
    email: null,
    city: "Lázaro Cárdenas, Michoacán",
    timezone: TZ,
    currency: "MXN",
    bookingCodePrefix: "DGT",
    photoPaths: [],
    depositMode: "optional",
    depositType: "percent",
    depositValue: 30,
    confirmationMode: "manual",
    requestHoldHours: 24,
    paymentHoldMinutes: 30,
    proposalHoldHours: 48,
    cancellationPolicy:
      "Puedes cancelar sin costo hasta 7 días antes del evento y te devolvemos el anticipo. Después de eso, el anticipo no es reembolsable. (Texto de ejemplo.)",
    refundCutoffDays: 7,
    minNoticeDays: 3,
    maxAdvanceDays: 180,
    teams: 1,
    whatsappTemplates: {},
  };

  const rules: AvailabilityRule[] = Array.from({ length: 7 }, (_, weekday) => ({
    id: randomUUID(),
    businessId: BUSINESS_ID,
    weekday,
    isOpen: true,
    firstStart: "12:00",
    lastStart: "20:00",
    slotIntervalMin: 30,
    eventDurationMin: 240,
    travelBufferMin: 60,
    maxBookingsPerDay: 2,
    maxGuestsPerDay: null,
  }));

  const packages: Package[] = [
    {
      id: "00000000-0000-4000-8000-0000000000a1",
      businessId: BUSINESS_ID,
      name: "Paquete de ejemplo A",
      description: "Por definir: el dueño captura qué incluye y su precio.",
      photoPath: null,
      pricePerGuestCents: 15000,
      minGuests: 30,
      maxGuests: 150,
      includes: ["Tacos de plancha (ejemplo)", "Cebollitas asadas (ejemplo)", "Salsas de la casa (ejemplo)"],
      isActive: true,
      sortOrder: 0,
    },
    {
      id: "00000000-0000-4000-8000-0000000000a2",
      businessId: BUSINESS_ID,
      name: "Paquete de ejemplo B",
      description: "Por definir.",
      photoPath: null,
      pricePerGuestCents: 19900,
      minGuests: 50,
      maxGuests: null,
      includes: ["Todo lo del paquete A (ejemplo)", "Aguas frescas (ejemplo)"],
      isActive: true,
      sortOrder: 1,
    },
  ];

  const zones: Zone[] = [
    { id: randomUUID(), businessId: BUSINESS_ID, name: "Lázaro Cárdenas (ciudad)", travelFeeCents: 0, isActive: true, sortOrder: 0 },
    { id: randomUUID(), businessId: BUSINESS_ID, name: "Fuera de la ciudad (ejemplo)", travelFeeCents: 25000, isActive: true, sortOrder: 1 },
  ];

  const admins: AdminUser[] = [
    { id: "00000000-0000-4000-8000-0000000000f1", businessId: BUSINESS_ID, email: "dueno@dgarden.test", role: "owner", sessionVersion: 1 },
    { id: "00000000-0000-4000-8000-0000000000f2", businessId: BUSINESS_ID, email: "ayudante@dgarden.test", role: "helper", sessionVersion: 1 },
  ];

  const now = new Date();
  const today = todayLocal(TZ, now);
  const customers: Customer[] = [1, 2, 3, 4].map((n) => ({
    id: randomUUID(),
    businessId: BUSINESS_ID,
    name: `Cliente de prueba ${n}`,
    whatsappE164: `+52753000000${n}`,
    email: null,
    notes: "",
    anonymizedAt: null,
    createdAt: now,
  }));

  const mk = (
    i: number,
    customer: Customer,
    dayOffset: number,
    time: string,
    guests: number,
    status: Booking["status"],
    extra: Partial<Booking> = {},
  ): Booking => {
    const id = randomUUID();
    const eventDate = addDaysLocal(today, dayOffset);
    const startAt = localToInstant(eventDate, time, TZ);
    const pkg = packages[i % 2];
    const subtotal = pkg.pricePerGuestCents * guests;
    return {
      id,
      businessId: BUSINESS_ID,
      code: `DGT-SEED${i}`,
      manageTokenHash: manageTokenHash(id, 1),
      manageTokenVersion: 1,
      idempotencyKey: null,
      customerId: customer.id,
      packageId: pkg.id,
      zoneId: zones[0].id,
      eventDate,
      startAt,
      endAt: new Date(startAt.getTime() + 240 * 60_000),
      travelBufferMin: 60,
      guests,
      address: `Calle de prueba ${i}0`,
      neighborhood: "Colonia de prueba",
      addressNotes: "",
      eventType: "Cumpleaños",
      customerNotes: "",
      internalNotes: "",
      pricePerGuestCents: pkg.pricePerGuestCents,
      subtotalCents: subtotal,
      travelFeeCents: 0,
      addonsCents: 0,
      totalCents: subtotal,
      depositCents: Math.ceil((subtotal * 0.3) / 100) * 100,
      status,
      holdExpiresAt: null,
      proposedStartAt: null,
      proposedEndAt: null,
      proposedEventDate: null,
      proposalExpiresAt: null,
      source: "web",
      capacityOverride: false,
      needsAttention: false,
      confirmedAt: status === "confirmed" || status === "completed" ? now : null,
      cancelledAt: null,
      cancelReason: null,
      completedAt: status === "completed" ? now : null,
      createdAt: new Date(now.getTime() - (10 - i) * 3_600_000),
      updatedAt: now,
      ...extra,
    };
  };

  const bookings: Booking[] = [
    mk(1, customers[0], 6, "14:00", 80, "requested", { holdExpiresAt: new Date(now.getTime() + 20 * 3_600_000) }),
    mk(2, customers[1], 9, "13:00", 60, "confirmed"),
    mk(3, customers[2], 1, "18:00", 45, "confirmed"),
    mk(4, customers[3], -4, "15:00", 100, "completed"),
  ];

  const events: BookingEvent[] = bookings.map((b) => ({
    id: randomUUID(),
    businessId: BUSINESS_ID,
    bookingId: b.id,
    type: "created",
    actor: "customer",
    data: { seed: true },
    createdAt: b.createdAt,
  }));

  return {
    business,
    rules,
    blocked: [],
    packages,
    zones,
    customers,
    bookings,
    events,
    messages: [],
    payments: [],
    reviews: [],
    admins,
    loginTokens: [],
    rateLimits: new Map(),
    webhookEvents: [],
    outbox: [],
    jobRuns: [],
  };
}

const g = globalThis as unknown as { __dgFake?: Tables; __dgLocks?: Map<string, Promise<unknown>> };
const db = (): Tables => (g.__dgFake ??= seed());
const locks = (): Map<string, Promise<unknown>> => (g.__dgLocks ??= new Map());

const clone = <T>(v: T): T => structuredClone(v);

export const fakeStore: DataStore = {
  kind: "fake",

  async getBusiness() {
    return clone(db().business);
  },
  async updateBusiness(_id, patch) {
    Object.assign(db().business, patch);
    return clone(db().business);
  },

  async listRules(businessId) {
    return clone(db().rules.filter((r) => r.businessId === businessId).sort((a, b) => a.weekday - b.weekday));
  },
  async saveRules(businessId, rules) {
    const t = db();
    t.rules = t.rules.filter((r) => r.businessId !== businessId);
    for (const r of rules) t.rules.push({ ...r, id: randomUUID(), businessId });
  },
  async listBlockedDates(businessId) {
    return clone(db().blocked.filter((b) => b.businessId === businessId).sort((a, b) => a.date.localeCompare(b.date)));
  },
  async addBlockedDate(businessId, date, reason) {
    const t = db();
    const existing = t.blocked.find((b) => b.businessId === businessId && b.date === date);
    if (existing) {
      existing.reason = reason;
      return clone(existing);
    }
    const row = { id: randomUUID(), businessId, date, reason };
    t.blocked.push(row);
    return clone(row);
  },
  async removeBlockedDate(businessId, date) {
    const t = db();
    t.blocked = t.blocked.filter((b) => !(b.businessId === businessId && b.date === date));
  },

  async listPackages(businessId) {
    return clone(db().packages.filter((p) => p.businessId === businessId).sort((a, b) => a.sortOrder - b.sortOrder));
  },
  async getPackage(businessId, id) {
    return clone(db().packages.find((p) => p.businessId === businessId && p.id === id) ?? null);
  },
  async savePackage(businessId, input) {
    const t = db();
    if (input.id) {
      const row = t.packages.find((p) => p.businessId === businessId && p.id === input.id);
      if (!row) throw new Error("Paquete no encontrado");
      Object.assign(row, input);
      return clone(row);
    }
    const row: Package = { ...input, id: randomUUID(), businessId };
    t.packages.push(row);
    return clone(row);
  },
  async listZones(businessId) {
    return clone(db().zones.filter((z) => z.businessId === businessId).sort((a, b) => a.sortOrder - b.sortOrder));
  },
  async getZone(businessId, id) {
    return clone(db().zones.find((z) => z.businessId === businessId && z.id === id) ?? null);
  },
  async saveZone(businessId, input) {
    const t = db();
    if (input.id) {
      const row = t.zones.find((z) => z.businessId === businessId && z.id === input.id);
      if (!row) throw new Error("Zona no encontrada");
      Object.assign(row, input);
      return clone(row);
    }
    const row: Zone = { ...input, id: randomUUID(), businessId };
    t.zones.push(row);
    return clone(row);
  },

  async getCustomer(businessId, id) {
    return clone(db().customers.find((c) => c.businessId === businessId && c.id === id) ?? null);
  },
  async findCustomerByWhatsapp(businessId, whatsappE164) {
    return clone(db().customers.find((c) => c.businessId === businessId && c.whatsappE164 === whatsappE164) ?? null);
  },
  async insertCustomer(c) {
    const row: Customer = { ...c, id: randomUUID(), createdAt: new Date() };
    db().customers.push(row);
    return clone(row);
  },
  async updateCustomer(businessId, id, patch) {
    const row = db().customers.find((c) => c.businessId === businessId && c.id === id);
    if (!row) throw new Error("Cliente no encontrado");
    Object.assign(row, patch);
    return clone(row);
  },
  async listCustomers(businessId, q) {
    const t = db();
    const needle = q?.trim().toLowerCase();
    const rows: CustomerRow[] = t.customers
      .filter((c) => c.businessId === businessId)
      .filter((c) => !needle || c.name.toLowerCase().includes(needle) || (c.whatsappE164 ?? "").includes(needle))
      .map((c) => {
        const mine = t.bookings.filter((b) => b.customerId === c.id);
        const last = mine.map((b) => b.eventDate).sort().at(-1) ?? null;
        return { ...clone(c), bookingCount: mine.length, lastEventDate: last };
      });
    return rows.sort((a, b) => (b.lastEventDate ?? "").localeCompare(a.lastEventDate ?? ""));
  },

  async listBookingsTouching(businessId, from, to) {
    return clone(
      db().bookings.filter(
        (b) =>
          b.businessId === businessId &&
          ((b.eventDate >= from && b.eventDate <= to) ||
            (b.proposedEventDate !== null && b.proposedEventDate >= from && b.proposedEventDate <= to)),
      ),
    );
  },
  async listBookings(businessId, f = {}) {
    return clone(
      db()
        .bookings.filter((b) => b.businessId === businessId)
        .filter((b) => !f.statuses || f.statuses.includes(b.status))
        .filter((b) => !f.from || b.eventDate >= f.from)
        .filter((b) => !f.to || b.eventDate <= f.to)
        .filter((b) => !f.customerId || b.customerId === f.customerId)
        .filter((b) => f.needsAttention === undefined || b.needsAttention === f.needsAttention)
        .sort((a, b) => a.startAt.getTime() - b.startAt.getTime()),
    );
  },
  async getBooking(businessId, id) {
    return clone(db().bookings.find((b) => b.businessId === businessId && b.id === id) ?? null);
  },
  async getBookingByCode(code) {
    return clone(db().bookings.find((b) => b.code === code) ?? null);
  },
  async findBookingByIdempotencyKey(businessId, key) {
    return clone(db().bookings.find((b) => b.businessId === businessId && b.idempotencyKey === key) ?? null);
  },
  async codeExists(code) {
    return db().bookings.some((b) => b.code === code);
  },
  async insertBooking(b) {
    const t = db();
    if (t.bookings.some((x) => x.code === b.code)) throw new Error("Código repetido");
    if (b.idempotencyKey && t.bookings.some((x) => x.idempotencyKey === b.idempotencyKey)) throw new Error("Taquiza repetida");
    const row: Booking = { ...b, createdAt: new Date(), updatedAt: new Date() };
    t.bookings.push(row);
    return clone(row);
  },
  async updateBooking(businessId, id, patch) {
    const row = db().bookings.find((b) => b.businessId === businessId && b.id === id);
    if (!row) throw new Error("Taquiza no encontrada");
    Object.assign(row, patch, { updatedAt: new Date() });
    return clone(row);
  },
  async countBookingsByCustomerSince(businessId, customerId, since) {
    return db().bookings.filter((b) => b.businessId === businessId && b.customerId === customerId && b.createdAt >= since).length;
  },

  async addEvent(e) {
    db().events.push({ ...e, id: randomUUID(), createdAt: new Date() });
  },
  async listEvents(bookingId) {
    return clone(db().events.filter((e) => e.bookingId === bookingId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
  },
  async addMessage(m) {
    db().messages.push({ ...m, id: randomUUID(), createdAt: new Date() });
  },
  async listMessages(bookingId) {
    return clone(db().messages.filter((m) => m.bookingId === bookingId));
  },
  async addPayment(p) {
    const t = db();
    if (p.providerRef && t.payments.some((x) => x.provider === p.provider && x.providerRef === p.providerRef)) {
      throw new Error("Pago repetido");
    }
    const row: Payment = { ...p, id: randomUUID(), createdAt: new Date() };
    t.payments.push(row);
    return clone(row);
  },
  async updatePayment(id, patch) {
    const row = db().payments.find((p) => p.id === id);
    if (!row) throw new Error("Pago no encontrado");
    Object.assign(row, patch);
    return clone(row);
  },
  async listPayments(bookingId) {
    return clone(db().payments.filter((p) => p.bookingId === bookingId).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()));
  },
  async findPayment(provider, providerRef) {
    return clone(db().payments.find((p) => p.provider === provider && p.providerRef === providerRef) ?? null);
  },
  async findPaymentByCheckout(checkoutRef) {
    return clone(db().payments.find((p) => p.checkoutRef === checkoutRef) ?? null);
  },
  async addReview(r) {
    const t = db();
    if (t.reviews.some((x) => x.bookingId === r.bookingId)) throw new Error("Ya hay una reseña");
    const row: Review = { ...r, id: randomUUID(), createdAt: new Date() };
    t.reviews.push(row);
    return clone(row);
  },
  async getReviewByBooking(bookingId) {
    return clone(db().reviews.find((r) => r.bookingId === bookingId) ?? null);
  },
  async listReviews(businessId, opts) {
    return clone(
      db()
        .reviews.filter((r) => r.businessId === businessId && (!opts?.publishedOnly || r.isPublished))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    );
  },
  async setReviewPublished(businessId, id, published) {
    const row = db().reviews.find((r) => r.businessId === businessId && r.id === id);
    if (row) Object.assign(row, { isPublished: published, reviewedAt: new Date() });
  },

  async findAdminByEmail(email) {
    return clone(db().admins.find((a) => a.email.toLowerCase() === email.trim().toLowerCase()) ?? null);
  },
  async getAdmin(id) {
    return clone(db().admins.find((a) => a.id === id) ?? null);
  },
  async bumpSessionVersion(adminId) {
    const a = db().admins.find((x) => x.id === adminId);
    if (a) a.sessionVersion++;
  },
  async createLoginToken(adminId, tokenHash, expiresAt) {
    db().loginTokens.push({ adminId, tokenHash, expiresAt, usedAt: null });
  },
  async consumeLoginToken(tokenHash) {
    const t = db().loginTokens.find((x) => x.tokenHash === tokenHash && !x.usedAt && x.expiresAt > new Date());
    if (!t) return null;
    t.usedAt = new Date();
    return t.adminId;
  },
  async hitRateLimit(key, windowSeconds, max) {
    const m = db().rateLimits;
    const k = `${key}@${Math.floor(Date.now() / 1000 / windowSeconds)}`;
    const n = (m.get(k) ?? 0) + 1;
    m.set(k, n);
    return n <= max;
  },
  async capacityConflict(i) {
    const t = db();
    const rule = t.rules.find((r) => r.businessId === i.businessId && r.weekday === weekdayOf(i.date));
    const blocked = t.blocked.some((b) => b.businessId === i.businessId && b.date === i.date);
    return capacityConflict({
      business: t.business,
      rule,
      blocked,
      date: i.date,
      start: i.start,
      end: i.end,
      guests: i.guests,
      travelBufferMin: i.travelBufferMin,
      loads: loadsForDate(t.bookings.filter((b) => b.businessId === i.businessId), i.date, new Date(), i.excludeBookingId),
    });
  },
  async recordWebhookEvent(provider, eventId) {
    const t = db();
    const ex = t.webhookEvents.find((e) => e.provider === provider && e.eventId === eventId);
    if (ex) return { id: ex.id, isNew: false, processed: ex.processed };
    const row = { id: randomUUID(), provider, eventId, processed: false, error: null };
    t.webhookEvents.push(row);
    return { id: row.id, isNew: true, processed: false };
  },
  async markWebhookProcessed(id, error = null) {
    const e = db().webhookEvents.find((x) => x.id === id);
    if (e) Object.assign(e, { processed: !error, error });
  },
  async findLatestPendingDeposit(bookingId) {
    const list = db().payments.filter((p) => p.bookingId === bookingId && p.kind === "deposit" && p.status === "pending" && p.provider !== "manual");
    return clone(list.at(-1) ?? null);
  },
  async enqueueOutbox(item) {
    const row: OutboxItem = {
      id: randomUUID(),
      businessId: item.businessId,
      kind: "email",
      payload: item.payload,
      attempts: 0,
      nextAttemptAt: new Date(),
      lastError: null,
      sentAt: null,
      deadAt: null,
      createdAt: new Date(),
    };
    db().outbox.push(row);
    return clone(row);
  },
  async listDueOutbox(limit) {
    const now = new Date();
    return clone(db().outbox.filter((o) => !o.sentAt && !o.deadAt && o.nextAttemptAt <= now).slice(0, limit));
  },
  async updateOutbox(id, patch) {
    const o = db().outbox.find((x) => x.id === id);
    if (o) Object.assign(o, patch);
  },
  async listDeadOutbox(businessId) {
    return clone(db().outbox.filter((o) => o.businessId === businessId && o.deadAt));
  },
  async purgeExpired() {
    return 0;
  },
  async startJobRun(name) {
    const id = randomUUID();
    db().jobRuns.push({ id, name, status: "running", detail: {}, error: null });
    return id;
  },
  async finishJobRun(id, status, detail, error = null) {
    const j = db().jobRuns.find((x) => x.id === id);
    if (j) Object.assign(j, { status, detail, error });
  },

  async withDayLock(businessId, dates, fn) {
    const keys = [...new Set(dates)].sort().map((d) => `${businessId}:${d}`);
    const m = locks();
    // Encadena detrás de quien tenga cualquiera de esos días.
    const before = Promise.all(keys.map((k) => m.get(k) ?? Promise.resolve()));
    let release!: () => void;
    const mine = new Promise<void>((r) => (release = r));
    const chained = before.then(() => mine);
    keys.forEach((k) => m.set(k, chained));
    await before.catch(() => undefined);
    try {
      return await fn();
    } finally {
      release();
      keys.forEach((k) => m.get(k) === chained && m.delete(k));
    }
  },
};
