import "server-only";
import { fakeStore } from "./fake";
import type { DataStore } from "./store";

/** La base de datos de la app. Sin DATABASE_URL usa la capa en memoria. */
export function store(): DataStore {
  if (process.env.DATABASE_URL) {
    // /replica-backend conecta aquí la implementación con Postgres (Drizzle + schema.sql).
    throw new Error("La capa de datos de Postgres todavía no existe. Quita DATABASE_URL o corre /replica-backend.");
  }
  return fakeStore;
}

export type { DataStore } from "./store";
