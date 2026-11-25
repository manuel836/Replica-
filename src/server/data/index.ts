import "server-only";
import { fakeStore } from "./fake";
import { postgresStore } from "./postgres";
import type { DataStore } from "./store";

/** La base de datos de la app: Postgres si hay DATABASE_URL; si no, la capa en memoria (solo desarrollo). */
export function store(): DataStore {
  if (process.env.DATABASE_URL) return postgresStore;
  if (process.env.NODE_ENV === "production") {
    throw new Error("Falta DATABASE_URL: en producción no se usa la capa en memoria.");
  }
  return fakeStore;
}

export type { DataStore } from "./store";
