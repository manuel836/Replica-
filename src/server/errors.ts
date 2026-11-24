/** Error con mensaje listo para mostrarle a una persona (en español). */
export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string = "error",
    readonly field?: string,
  ) {
    super(message);
  }
}

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string; code?: string; field?: string };

/** Corre una acción y convierte AppError en un resultado; lo inesperado se registra y se oculta. */
export async function run<T>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: string; code?: string; field?: string }> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, error: e.message, code: e.code, field: e.field };
    // redirect() y notFound() de Next se propagan como errores especiales: no tocarlos.
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error(e);
    return { ok: false, error: "Algo salió mal. Intenta de nuevo en un momento." };
  }
}
