import { execFileSync } from "node:child_process";
import postgres from "postgres";

// Con E2E_DATABASE_URL: borra y vuelve a crear el esquema, migra y siembra datos de prueba.
// Sin ella, la app usa la capa en memoria, que ya arranca limpia en cada corrida.
export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) return;
  if (!/e2e|test/i.test(url)) {
    throw new Error("E2E_DATABASE_URL debe ser una base SOLO para pruebas (su nombre debe incluir 'e2e' o 'test'): se borra completa.");
  }
  const sql = postgres(url, { max: 1, onnotice: false });
  await sql.unsafe("drop schema if exists public cascade; create schema public;");
  await sql.end();
  const env = { ...process.env, DATABASE_URL: url, SEED_ADMIN_EMAIL: "dueno@dgarden.test" };
  execFileSync("node", ["scripts/migrate.mjs"], { env, stdio: "inherit" });
  execFileSync("node", ["scripts/seed.mjs", "--demo"], { env, stdio: "inherit" });
}
