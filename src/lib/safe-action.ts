// Llamar una acción del servidor desde el navegador sin que una falla de red deje la pantalla
// trabada: si la petición no llega (sin internet, servidor caído), devuelve un resultado de
// error normal ({ ok: false }) que cada pantalla ya sabe mostrar.

export const NETWORK_ERROR = "No pudimos conectarnos. Revisa tu conexión a internet e intenta de nuevo.";

export type NetworkFailure = { ok: false; error: string; code: "network"; fields?: Record<string, string> };

export function safe<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  return async (...args: A): Promise<R | NetworkFailure> => {
    try {
      return await fn(...args);
    } catch {
      return { ok: false, error: NETWORK_ERROR, code: "network" };
    }
  };
}
