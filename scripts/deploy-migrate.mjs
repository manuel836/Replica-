// Migraciones durante el build de PRODUCCIÓN en Vercel, y solo ahí (replica-deploy).
// - Vercel pone VERCEL_ENV=production en el build de producción y "preview" en las vistas previas:
//   una vista previa nunca toca la base de producción.
// - Si existe DATABASE_URL_MIGRATIONS (conexión directa o "session pooler", puerto 5432), se usa
//   para los cambios de esquema; si no, DATABASE_URL.
// - Si una migración falla, el build falla y la versión anterior sigue en línea.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const env = process.env.VERCEL_ENV;
if (env !== "production") {
  console.log(`Migraciones: se omiten fuera del build de producción (VERCEL_ENV=${env ?? "sin definir"}).`);
  process.exit(0);
}
const url = process.env.DATABASE_URL_MIGRATIONS || process.env.DATABASE_URL;
if (!url) {
  console.error("Migraciones: falta DATABASE_URL en las variables de producción de Vercel.");
  process.exit(1);
}
const script = join(dirname(fileURLToPath(import.meta.url)), "migrate.mjs");
const r = spawnSync(process.execPath, [script], { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
process.exit(r.status ?? 1);
