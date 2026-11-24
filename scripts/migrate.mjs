// Aplica las migraciones de db/migrations en orden, cada una en su transacción.
// Uso: DATABASE_URL=postgres://… npm run db:migrate
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL.");
  process.exit(1);
}
const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");
const sql = postgres(url, { max: 1, onnotice: false, prepare: false });

try {
  await sql`create table if not exists schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`;
  const done = new Set((await sql`select name from schema_migrations`).map((r) => r.name));
  const files = readdirSync(dir).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();
  let applied = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    const body = readFileSync(join(dir, file), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into schema_migrations (name) values (${file})`;
    });
    console.log(`aplicada ${file}`);
    applied++;
  }
  console.log(applied ? `${applied} migración(es) aplicada(s).` : "La base ya está al día.");
} catch (e) {
  console.error("La migración falló; no se aplicó nada de ese archivo.\n", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
