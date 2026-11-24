import type { Booking, Business, Customer, Package, TemplateKey } from "@/lib/types";
import { formatMXN } from "@/lib/format";
import { formatDateLong, localTime } from "./time";

// Plantillas de WhatsApp. Texto propio de D' Garden Tacos; el dueño puede cambiarlas en Ajustes.
// Marcadores: {nombre} {negocio} {codigo} {fecha} {hora} {invitados} {paquete} {direccion}
//             {enlace} {total} {anticipo} {motivo}

export const DEFAULT_TEMPLATES: Record<TemplateKey, string> = {
  request_received:
    "Hola, soy {nombre}. Acabo de pedir una taquiza ({codigo}) para el {fecha} a las {hora}, {invitados} invitados, en {direccion}.",
  confirmed:
    "¡Hola {nombre}! Tu taquiza con {negocio} quedó confirmada: {fecha} a las {hora}, {invitados} invitados ({paquete}). Dirección: {direccion}. Detalles y cambios: {enlace}",
  declined:
    "Hola {nombre}, esta vez no podemos atender tu taquiza del {fecha}. {motivo} Si quieres buscar otra fecha, aquí está tu solicitud: {enlace}",
  proposal:
    "Hola {nombre}, el día que pediste ya no tenemos lugar. Te proponemos el {fecha} a las {hora}. Puedes aceptarla o rechazarla aquí: {enlace}",
  reminder:
    "¡Hola {nombre}! Mañana es tu taquiza: {fecha} a las {hora} en {direccion}. Cualquier cambio, avísanos por aquí. 🌮",
  cancelled: "Hola {nombre}, tu taquiza del {fecha} quedó cancelada. {motivo} Detalles: {enlace}",
  review_request: "¡Gracias por invitarnos a tu evento, {nombre}! ¿Nos cuentas qué te pareció? Es un minuto: {enlace}",
  payment_link:
    "Hola {nombre}, para confirmar tu taquiza del {fecha} solo falta el anticipo de {anticipo}. Puedes pagarlo aquí: {enlace}",
};

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  request_received: "Solicitud del cliente al negocio",
  confirmed: "Taquiza confirmada",
  declined: "Solicitud rechazada",
  proposal: "Propuesta de otra fecha",
  reminder: "Recordatorio un día antes",
  cancelled: "Taquiza cancelada",
  review_request: "Pedir reseña",
  payment_link: "Falta el anticipo",
};

interface Ctx {
  business: Business;
  booking: Booking;
  customer: Customer;
  pkg: Package | null;
  link: string;
  reason?: string;
}

export function renderTemplate(key: TemplateKey, c: Ctx): string {
  const template = c.business.whatsappTemplates[key]?.trim() || DEFAULT_TEMPLATES[key];
  const proposed = key === "proposal" && c.booking.proposedStartAt && c.booking.proposedEventDate;
  const date = proposed ? c.booking.proposedEventDate! : c.booking.eventDate;
  const time = localTime(proposed ? c.booking.proposedStartAt! : c.booking.startAt, c.business.timezone);
  const values: Record<string, string> = {
    nombre: c.customer.name.split(" ")[0] ?? c.customer.name,
    negocio: c.business.name,
    codigo: c.booking.code,
    fecha: formatDateLong(date),
    hora: time,
    invitados: String(c.booking.guests),
    paquete: c.pkg?.name ?? "",
    direccion: [c.booking.address, c.booking.neighborhood].filter(Boolean).join(", "),
    enlace: c.link,
    total: formatMXN(c.booking.totalCents),
    anticipo: formatMXN(c.booking.depositCents),
    motivo: c.reason ?? c.booking.cancelReason ?? "",
  };
  return template
    .replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? values[k] : m))
    .replace(/\s+\./g, ".")
    .replace(/ {2,}/g, " ")
    .trim();
}
