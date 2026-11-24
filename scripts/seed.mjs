// Datos iniciales: el negocio, su horario, paquetes y zonas de ejemplo, y el usuario dueño.
// Uso:  DATABASE_URL=… SEED_ADMIN_EMAIL=tu@correo.mx npm run db:seed
//       … npm run db:seed -- --demo     (agrega clientes y taquizas de prueba; nunca en producción)
// Es idempotente: si el negocio ya existe, no lo toca.
import { createHash, createHmac, randomUUID } from "node:crypto";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
const slug = process.env.BUSINESS_SLUG ?? "dgarden";
const demo = process.argv.includes("--demo");
if (!url || !adminEmail) {
  console.error("Faltan DATABASE_URL y/o SEED_ADMIN_EMAIL.");
  process.exit(1);
}
if (demo && process.env.NODE_ENV === "production") {
  console.error("--demo no se usa en producción.");
  process.exit(1);
}
const secret = process.env.APP_SECRET && process.env.APP_SECRET.length >= 32 ? process.env.APP_SECRET : "dev-only-secret-change-me-in-production";
const tokenHash = (id) =>
  createHash("sha256").update(createHmac("sha256", secret).update(`manage:${id}:1`).digest("base64url")).digest("hex");

const sql = postgres(url, { max: 1, onnotice: false, prepare: false });
const TZ = "America/Mexico_City";

try {
  const existing = await sql`select id from businesses where slug = ${slug}`;
  if (existing.length) {
    console.log(`El negocio "${slug}" ya existe; no se cambió nada.`);
  } else {
    await sql.begin(async (tx) => {
      const [b] = await tx`
        insert into businesses (slug, name, description, city, timezone, cancellation_policy)
        values (
          ${slug},
          ${"D' Garden Tacos"},
          ${"Llevamos la plancha a tu evento en Lázaro Cárdenas: tacos hechos al momento para tus invitados. (Texto de ejemplo: cámbialo en Ajustes.)"},
          ${"Lázaro Cárdenas, Michoacán"},
          ${TZ},
          ${"Puedes cancelar sin costo hasta 7 días antes del evento y te devolvemos el anticipo. Después de eso, el anticipo no es reembolsable. (Texto de ejemplo.)"}
        )
        returning id`;
      for (let wd = 0; wd < 7; wd++) {
        await tx`insert into availability_rules (business_id, weekday) values (${b.id}, ${wd})`;
      }
      await tx`
        insert into packages (business_id, name, description, price_per_guest_cents, min_guests, max_guests, includes, sort_order)
        values
          (${b.id}, 'Paquete de ejemplo A', 'Por definir: captura qué incluye y su precio.', 15000, 30, 150,
           ${["Tacos de plancha (ejemplo)", "Cebollitas asadas (ejemplo)", "Salsas de la casa (ejemplo)"]}, 0),
          (${b.id}, 'Paquete de ejemplo B', 'Por definir.', 19900, 50, null,
           ${["Todo lo del paquete A (ejemplo)", "Aguas frescas (ejemplo)"]}, 1)`;
      await tx`
        insert into service_zones (business_id, name, travel_fee_cents, sort_order)
        values (${b.id}, 'Lázaro Cárdenas (ciudad)', 0, 0), (${b.id}, 'Fuera de la ciudad (ejemplo)', 25000, 1)`;
      await tx`insert into admin_users (business_id, email, role) values (${b.id}, ${adminEmail}, 'owner')`;

      if (demo) {
        const pkgs = await tx`select id, price_per_guest_cents from packages where business_id = ${b.id} order by sort_order`;
        const [zone] = await tx`select id from service_zones where business_id = ${b.id} order by sort_order limit 1`;
        const plan = [
          { n: 1, days: 6, time: "14:00", guests: 80, status: "requested" },
          { n: 2, days: 9, time: "13:00", guests: 60, status: "confirmed" },
          { n: 3, days: 1, time: "18:00", guests: 45, status: "confirmed" },
          { n: 4, days: -4, time: "15:00", guests: 100, status: "completed" },
        ];
        for (const p of plan) {
          const [c] = await tx`
            insert into customers (business_id, name, whatsapp_e164)
            values (${b.id}, ${`Cliente de prueba ${p.n}`}, ${`+52753000000${p.n}`}) returning id`;
          const pkg = pkgs[p.n % 2];
          const id = randomUUID();
          const subtotal = pkg.price_per_guest_cents * p.guests;
          await tx`
            insert into bookings (
              id, business_id, code, manage_token_hash, customer_id, package_id, zone_id,
              event_date, start_at, end_at, travel_buffer_min, guests, address, neighborhood, event_type,
              price_per_guest_cents, subtotal_cents, total_cents, deposit_cents, status, hold_expires_at, confirmed_at, completed_at
            )
            select ${id}, ${b.id}, ${`DGT-SEED${p.n}`}, ${tokenHash(id)}, ${c.id}, ${pkg.id}, ${zone.id},
              d, s, s + interval '4 hours', 60, ${p.guests}, ${`Calle de prueba ${p.n}0`}, 'Colonia de prueba', 'Cumpleaños',
              ${pkg.price_per_guest_cents}, ${subtotal}, ${subtotal}, ${Math.ceil((subtotal * 0.3) / 100) * 100},
              ${p.status},
              case when ${p.status} = 'requested' then now() + interval '20 hours' end,
              case when ${p.status} in ('confirmed', 'completed') then now() end,
              case when ${p.status} = 'completed' then now() end
            from (select (now() at time zone ${TZ})::date + ${p.days}::int as d) x,
                 lateral (select ((x.d + ${p.time}::time) at time zone ${TZ}) as s) y`;
          await tx`insert into booking_events (business_id, booking_id, type, actor, data)
                   values (${b.id}, ${id}, 'created', 'customer', ${{ seed: true }})`;
        }
      }
    });
    console.log(`Listo: negocio "${slug}", dueño ${adminEmail}${demo ? ", con datos de prueba" : ""}.`);
  }
} catch (e) {
  console.error("El seed falló:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
