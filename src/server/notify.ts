import "server-only";
import { store } from "./data";
import { layout, sendEmail } from "./email";

/**
 * Avisos al dueño (solicitud nueva, pago que requiere atención, cancelaciones, resumen
 * diario). Van al correo del negocio (Ajustes). Si no hay correo capturado, se registran
 * en la consola del servidor.
 */
export async function notifyOwner(subject: string, body: string, link?: { label: string; path: string }): Promise<void> {
  const business = await store().getBusiness();
  if (!business.email) {
    // Solo el asunto: el cuerpo trae datos del cliente y no deben quedar en los registros.
    console.info(`[aviso al dueño sin correo configurado] ${subject}`);
    return;
  }
  const base = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const email = layout({
    title: subject,
    paragraphs: body.split("\n").filter(Boolean),
    button: link && base ? { label: link.label, url: `${base}${link.path}` } : undefined,
    footer: "Te llega porque eres el dueño de este negocio. Cambia el correo en Ajustes.",
  });
  await sendEmail(business.id, { to: business.email, subject, ...email });
}
