import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const DEV_SECRET = "dev-only-secret-change-me-in-production";

function secret(): string {
  const s = process.env.APP_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_SECRET falta o es muy corto (mínimo 32 caracteres).");
  }
  return DEV_SECRET;
}

export const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Token del enlace privado de una taquiza. Se deriva del id y una versión, así el panel puede
 * volver a armar el enlace para mandarlo por WhatsApp sin guardar el token. Regenerar el
 * enlace = subir la versión (el anterior deja de servir).
 */
export const manageToken = (bookingId: string, version: number) => sign(`manage:${bookingId}:${version}`);

export const manageTokenHash = (bookingId: string, version: number) => sha256(manageToken(bookingId, version));

export function verifyManageToken(
  booking: { id: string; manageTokenHash: string },
  token: string | null | undefined,
): boolean {
  if (!token) return false;
  return safeEqual(sha256(token), booking.manageTokenHash);
}
