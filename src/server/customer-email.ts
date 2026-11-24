import "server-only";
import type { Booking, Business, Customer, Message, Package } from "@/lib/types";
import { formatMXN } from "@/lib/format";
import { baseUrl, managePath } from "./context";
import { store } from "./data";
import { formatDateLong, formatStamp, localTime } from "./domain/time";
import { layout, sendEmail } from "./email";

// Correos al cliente. Solo salen si dejó su correo al agendar (es opcional); el canal principal
// sigue siendo WhatsApp. Texto propio. Pasan por la misma cola con reintentos que los avisos
// al dueño, y la respuesta llega al correo del negocio.

export type CustomerEmailKind =
  | "received"
  | "confirmed"
  | "payment_link"
  | "declined"
  | "proposed"
  | "changed"
  | "cancelled"
  | "reminder"
  | "review_request";

const TEMPLATE: Record<CustomerEmailKind, Message["template"]> = {
  received: "request_received",
  confirmed: "confirmed",
  payment_link: "payment_link",
  declined: "declined",
  proposed: "proposal",
  changed: "changed",
  cancelled: "cancelled",
  reminder: "reminder",
  review_request: "review_request",
};

/** Cómo se ve cada correo en el historial de la taquiza (S12). */
export const EMAIL_LABELS: Partial<Record<Message["template"], string>> = {
  request_received: "solicitud recibida",
  confirmed: "taquiza confirmada",
  payment_link: "falta el anticipo",
  declined: "solicitud rechazada",
  proposal: "otra fecha propuesta",
  changed: "cambio guardado",
  cancelled: "taquiza cancelada",
  reminder: "recordatorio de mañana",
  review_request: "pedir reseña",
};

export interface EmailCtx {
  business: Business;
  booking: Booking;
  customer: Customer;
  pkg: Package | null;
  link: string;
  reason?: string;
  refundedCents?: number;
  by?: "customer" | "business";
}

interface Composed {
  subject: string;
  title: string;
  paragraphs: string[];
  button: { label: string; url: string };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function details(c: EmailCtx): string[] {
  const tz = c.business.timezone;
  return [
    `Fecha: ${cap(formatDateLong(c.booking.eventDate))}, ${localTime(c.booking.startAt, tz)}`,
    `Invitados: ${c.booking.guests}${c.pkg ? ` · ${c.pkg.name}` : ""}`,
    `Dirección: ${[c.booking.address, c.booking.neighborhood].filter(Boolean).join(", ")}`,
    `Total estimado: ${formatMXN(c.booking.totalCents)}`,
  ];
}

const refundLine = (c: EmailCtx) =>
  c.refundedCents && c.refundedCents > 0
    ? [`Te devolvemos tu anticipo de ${formatMXN(c.refundedCents)}. Puede tardar unos días en verse en tu tarjeta.`]
    : [];

/** Arma el asunto y el texto. Función pura: se prueba sin mandar nada. */
export function composeCustomerEmail(kind: CustomerEmailKind, c: EmailCtx): Composed {
  const name = c.customer.name.split(/\s+/)[0] || c.customer.name;
  const shop = c.business.name;
  const tz = c.business.timezone;
  const when = `${formatDateLong(c.booking.eventDate)} a las ${localTime(c.booking.startAt, tz)}`;
  const code = c.booking.code;
  const view = { label: "Ver mi taquiza", url: c.link };

  switch (kind) {
    case "received":
      return {
        subject: `Recibimos tu solicitud de taquiza (${code})`,
        title: "Recibimos tu solicitud",
        paragraphs: [`Hola, ${name}. ${shop} ya tiene tu solicitud y te confirma pronto.`, ...details(c)],
        button: { label: "Ver mi solicitud", url: c.link },
      };
    case "confirmed":
      return {
        subject: `Tu taquiza está confirmada (${code})`,
        title: "¡Tu taquiza está confirmada!",
        paragraphs: [
          `Hola, ${name}. Te esperamos el ${when}.`,
          ...details(c),
          "Si necesitas cambiar la fecha o los invitados, o cancelar, hazlo desde tu enlace.",
        ],
        button: view,
      };
    case "payment_link":
      return {
        subject: `Falta el anticipo para confirmar tu taquiza (${code})`,
        title: "Solo falta tu anticipo",
        paragraphs: [
          `Hola, ${name}. ${shop} puede atender tu taquiza del ${when}.`,
          `Para confirmarla falta el anticipo de ${formatMXN(c.booking.depositCents)}. Lo pagas desde tu enlace.`,
        ],
        button: { label: "Pagar el anticipo", url: c.link },
      };
    case "declined":
      return {
        subject: `No podemos atender tu taquiza (${code})`,
        title: "Esta vez no podemos",
        paragraphs: [
          `Hola, ${name}. Lo sentimos: ${shop} no puede atender tu taquiza del ${when}.`,
          ...(c.reason ? [`Motivo: ${c.reason}`] : []),
          ...refundLine(c),
          "Si quieres, agenda otra fecha cuando gustes.",
        ],
        button: { label: "Ver mi solicitud", url: c.link },
      };
    case "proposed": {
      const date = c.booking.proposedEventDate ?? c.booking.eventDate;
      const start = c.booking.proposedStartAt ?? c.booking.startAt;
      const expires = c.booking.proposalExpiresAt;
      return {
        subject: `Te proponemos otra fecha (${code})`,
        title: "Te proponemos otra fecha",
        paragraphs: [
          `Hola, ${name}. El ${formatDateLong(c.booking.eventDate)} ya no tenemos lugar.`,
          `¿Te queda el ${formatDateLong(date)} a las ${localTime(start, tz)}?`,
          `Acepta o rechaza la propuesta desde tu enlace${expires ? ` antes del ${formatStamp(expires, tz)}` : ""}.`,
        ],
        button: { label: "Responder la propuesta", url: c.link },
      };
    }
    case "changed":
      return {
        subject: `Guardamos el cambio de tu taquiza (${code})`,
        title: "Guardamos tu cambio",
        paragraphs: [
          `Hola, ${name}. Así quedó tu taquiza:`,
          ...details(c),
          ...(c.booking.status === "requested" ? [`${shop} revisa el cambio y te confirma.`] : []),
        ],
        button: view,
      };
    case "cancelled":
      return {
        subject: `Tu taquiza quedó cancelada (${code})`,
        title: "Taquiza cancelada",
        paragraphs: [
          c.by === "customer"
            ? `Hola, ${name}. Cancelaste tu taquiza del ${when}.`
            : `Hola, ${name}. ${shop} tuvo que cancelar tu taquiza del ${when}.`,
          ...(c.by !== "customer" && c.reason ? [`Motivo: ${c.reason}`] : []),
          ...refundLine(c),
        ],
        button: { label: "Ver los detalles", url: c.link },
      };
    case "reminder":
      return {
        subject: "Mañana es tu taquiza 🌮",
        title: "Mañana es tu taquiza",
        paragraphs: [
          `Hola, ${name}. Mañana, ${when}, llegamos a ${[c.booking.address, c.booking.neighborhood].filter(Boolean).join(", ")}.`,
          "Si algo cambió, avísanos respondiendo este correo o por WhatsApp.",
        ],
        button: view,
      };
    case "review_request":
      return {
        subject: `¿Qué tal estuvo tu taquiza con ${shop}?`,
        title: "¡Gracias por invitarnos!",
        paragraphs: [`Hola, ${name}. ¿Nos cuentas qué te pareció? Tu reseña ayuda a otras familias a elegir. Es un minuto.`],
        button: { label: "Dejar mi reseña", url: c.link },
      };
  }
}

async function appBase(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  return baseUrl();
}

/**
 * Manda el correo si el cliente dejó su correo. Nunca lanza error: un correo que no sale no
 * debe romper la acción del cliente ni la del dueño (queda en la cola para reintento).
 */
export async function notifyCustomer(
  bookingId: string,
  kind: CustomerEmailKind,
  extra: Pick<EmailCtx, "reason" | "refundedCents" | "by"> = {},
): Promise<void> {
  try {
    const db = store();
    const business = await db.getBusiness();
    const booking = await db.getBooking(business.id, bookingId);
    if (!booking) return;
    const customer = await db.getCustomer(business.id, booking.customerId);
    if (!customer?.email || customer.anonymizedAt) return;
    const template = TEMPLATE[kind];
    if (kind === "reminder" || kind === "review_request") {
      const earlier = await db.listMessages(booking.id);
      if (earlier.some((m) => m.channel === "email" && m.template === template)) return;
    }
    const pkg = await db.getPackage(business.id, booking.packageId);
    let path = managePath(booking);
    if (kind === "review_request") path = path.replace(`/t/${booking.code}?`, `/t/${booking.code}/resena?`);
    const e = composeCustomerEmail(kind, { business, booking, customer, pkg, link: `${await appBase()}${path}`, ...extra });
    const body = layout({
      title: e.title,
      paragraphs: e.paragraphs,
      button: e.button,
      footer: `Te llega porque agendaste una taquiza con ${business.name}.${business.email ? " Si tienes dudas, responde a este correo." : ""}`,
    });
    const sent = await sendEmail(business.id, {
      to: customer.email,
      subject: e.subject,
      ...body,
      replyTo: business.email ?? undefined,
    });
    await db.addMessage({
      businessId: business.id,
      bookingId: booking.id,
      channel: "email",
      template,
      mode: "api",
      status: sent ? "sent" : "prepared",
      recipient: customer.email,
    });
    await db.addEvent({
      businessId: business.id,
      bookingId: booking.id,
      type: "message",
      actor: "system",
      data: { template, channel: "email" },
    });
  } catch (e) {
    console.error(`[correo al cliente] ${kind} falló: ${e instanceof Error ? e.message : String(e)}`);
  }
}
