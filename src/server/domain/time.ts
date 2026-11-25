import { TZDate } from "@date-fns/tz";
import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";

// Todo horario se calcula en la zona del negocio, nunca en la del navegador ni la del servidor.

/** "2026-12-14" + "14:00" en la zona del negocio → instante UTC. */
export function localToInstant(date: string, time: string, zone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(new TZDate(y, m - 1, d, hh, mm, zone).getTime());
}

/** Fecha local "yyyy-MM-dd" de un instante. */
export function localDate(instant: Date, zone: string): string {
  return format(new TZDate(instant.getTime(), zone), "yyyy-MM-dd");
}

/** Hora local "HH:mm" de un instante. */
export function localTime(instant: Date, zone: string): string {
  return format(new TZDate(instant.getTime(), zone), "HH:mm");
}

/** Hoy en la zona del negocio. */
export function todayLocal(zone: string, now: Date = new Date()): string {
  return localDate(now, zone);
}

/** Día de la semana de una fecha local (0 = domingo), sin depender de zonas. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function addDaysLocal(date: string, n: number): string {
  return format(addDays(new Date(`${date}T12:00:00Z`), n), "yyyy-MM-dd");
}

/** Minutos desde medianoche de "HH:mm". */
export const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export const fromMinutes = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

/** "sábado 14 de diciembre" */
export function formatDateLong(date: string): string {
  return format(new Date(`${date}T12:00:00Z`), "EEEE d 'de' MMMM", { locale: es });
}

/** "sáb 14 dic" */
export function formatDateShort(date: string): string {
  return format(new Date(`${date}T12:00:00Z`), "EEE d MMM", { locale: es });
}

/** "12 dic, 18:04" en la zona del negocio. */
export function formatStamp(instant: Date, zone: string): string {
  return format(new TZDate(instant.getTime(), zone), "d MMM, HH:mm", { locale: es });
}

/** "diciembre de 2026" para un mes "yyyy-MM". */
export function formatMonth(month: string): string {
  return format(new Date(`${month}-15T12:00:00Z`), "MMMM 'de' yyyy", { locale: es });
}

/** Lunes de la semana de una fecha local (en México la semana empieza en lunes). */
export function startOfWeekLocal(date: string): string {
  return addDaysLocal(date, -((weekdayOf(date) + 6) % 7));
}

/** Primer día del mes de una fecha local. */
export function startOfMonthLocal(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/** Primer día del mes que queda n meses después (o antes, con n negativo). */
export function addMonthsLocal(date: string, n: number): string {
  const [y, m] = date.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1, 12));
  return format(first, "yyyy-MM-dd");
}

/** "23 – 29 de noviembre de 2026", o "30 de noviembre – 6 de diciembre de 2026". */
export function formatWeekRange(from: string, to: string): string {
  const a = new Date(`${from}T12:00:00Z`);
  const b = new Date(`${to}T12:00:00Z`);
  if (from.slice(0, 7) === to.slice(0, 7)) return `${format(a, "d")} – ${format(b, "d 'de' MMMM 'de' yyyy", { locale: es })}`;
  if (from.slice(0, 4) === to.slice(0, 4))
    return `${format(a, "d 'de' MMMM", { locale: es })} – ${format(b, "d 'de' MMMM 'de' yyyy", { locale: es })}`;
  return `${format(a, "d 'de' MMMM 'de' yyyy", { locale: es })} – ${format(b, "d 'de' MMMM 'de' yyyy", { locale: es })}`;
}

/** Fecha local válida "yyyy-MM-dd" o null. */
export function parseLocalDate(s: string | undefined | null): string | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || format(d, "yyyy-MM-dd") !== s ? null : s;
}

/**
 * Último día en que cancelar todavía devuelve el anticipo: la fecha del evento menos los días
 * de la política. Cancelar ese día sí lo devuelve (igual que daysUntil >= refundCutoffDays).
 */
export function refundDeadline(eventDate: string, refundCutoffDays: number): string {
  return addDaysLocal(eventDate, -refundCutoffDays);
}
