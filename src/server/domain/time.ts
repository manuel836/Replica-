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
