import { createHmac } from "node:crypto";
import postgres from "postgres";
import { expect, test } from "./helpers";

// Solo con E2E_DATABASE_URL (Postgres): lo que la capa en memoria no puede demostrar.
const url = process.env.E2E_DATABASE_URL;
test.skip(!url, "Requiere E2E_DATABASE_URL (Postgres)");

test.describe("Seguridad de la base (Postgres)", () => {
  test("SEC-1 RLS: un rol como 'anon' de Supabase no ve ninguna fila", async () => {
    const sql = postgres(url!, { max: 1, onnotice: false });
    try {
      await sql.unsafe(`do $$ begin if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; end $$;
        grant usage on schema public to anon; grant select on all tables in schema public to anon;`);
      const [r] = await sql.begin(async (tx) => {
        await tx.unsafe("set local role anon");
        return tx`select (select count(*) from bookings) + (select count(*) from customers) + (select count(*) from admin_users) + (select count(*) from payments) as n`;
      });
      expect(Number(r.n)).toBe(0);
    } finally {
      await sql.end();
    }
  });

  test("SEC-2 una sesión válida de OTRO negocio no entra al panel ni a sus datos", async ({ browser, newWatchedPage }) => {
    const sql = postgres(url!, { max: 1, onnotice: false });
    let bookingId: string;
    try {
      await sql`insert into businesses (id, slug, name, city) values ('00000000-0000-4000-8000-00000000b002', 'otro', 'Otro Negocio', 'CDMX') on conflict do nothing`;
      await sql`insert into admin_users (id, business_id, email) values ('00000000-0000-4000-8000-00000000a002', '00000000-0000-4000-8000-00000000b002', 'otro@ejemplo.test') on conflict do nothing`;
      [{ id: bookingId }] = await sql`select id from bookings order by created_at limit 1`;
    } finally {
      await sql.end();
    }
    // Firma con el secreto de desarrollo (el servidor de pruebas no define APP_SECRET).
    const sign = (s: string) => createHmac("sha256", "dev-only-secret-change-me-in-production").update(s).digest("base64url");
    const id = "00000000-0000-4000-8000-00000000a002";
    const exp = Date.now() + 3_600_000;
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "dg_admin", value: `${id}.1.${exp}.${sign(`session:${id}:1:${exp}`)}`, url: "http://localhost:3100" }]);
    const p = await newWatchedPage(ctx);
    await p.goto(`/admin/t/${bookingId}`);
    await expect(p).toHaveURL(/\/admin\/entrar/);
    const wa = await ctx.request.get(`/admin/t/${bookingId}/whatsapp?plantilla=confirmed`, { maxRedirects: 0 });
    expect(wa.headers()["location"]).toMatch(/\/admin\/entrar/);
    await ctx.close();
  });
});
