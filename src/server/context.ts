import "server-only";
import { headers } from "next/headers";
import type { Booking } from "@/lib/types";
import { manageToken } from "./tokens";

/** URL pública de la app: APP_URL si existe; si no, la del request. */
export async function baseUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Enlace privado para que el cliente vea y gestione su taquiza. */
export function manageUrl(base: string, booking: Pick<Booking, "id" | "code" | "manageTokenVersion">): string {
  return `${base}/t/${booking.code}?k=${manageToken(booking.id, booking.manageTokenVersion)}`;
}

export const managePath = (booking: Pick<Booking, "id" | "code" | "manageTokenVersion">) =>
  `/t/${booking.code}?k=${manageToken(booking.id, booking.manageTokenVersion)}`;
