// Solo para pruebas con Postgres: borra y vuelve a crear el esquema de E2E_DATABASE_URL, migra
// y siembra datos de prueba. Lo corre playwright.config.ts antes de arrancar la app.
import { execFileSync } from "node:child_process";
import postgres from "postgres";

const url = process.env.E2E_DATABASE_URL;
if (!url) process.exit(0);
if (!/e2e|test/i.test(url)) {
  console.error("E2E_DATABASE_URL debe ser una base SOLO para pruebas (su nombre debe incluir 'e2e' o 'test'): se borra completa.");
  process.exit(1);
}
const sql = postgres(url, { max: 1, onnotice: false });
await sql.unsafe("drop schema if exists public cascade; create schema public;");
await sql.end();
const env = { ...process.env, DATABASE_URL: url, SEED_ADMIN_EMAIL: "dueno@dgarden.test" };
execFileSync("node", ["scripts/migrate.mjs"], { env, stdio: "inherit" });
execFileSync("node", ["scripts/seed.mjs", "--demo"], { env, stdio: "inherit" });
