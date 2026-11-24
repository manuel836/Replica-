import "server-only";
import tokens from "../../replica/design/tokens.json";
import { store } from "./data";

const c = tokens.color;

// Correos transaccionales por Resend (API oficial, con la llave del negocio).
// Todo correo pasa por la tabla outbox: se intenta mandar de inmediato y, si falla, el job
// diario lo reintenta con espera creciente. Después de 5 intentos queda como "muerto"
// (dead letter) y se ve en Ajustes. Sin RESEND_API_KEY, en desarrollo se escribe en consola.

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** A dónde llega la respuesta (el correo del negocio en los correos al cliente). */
  replyTo?: string;
}

const MAX_ATTEMPTS = 5;
const BACKOFF_MIN = [1, 10, 60, 6 * 60, 24 * 60];

const apiBase = () => process.env.RESEND_API_BASE ?? "https://api.resend.com";

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

async function deliver(email: Email, idempotencyKey: string): Promise<void> {
  if (!emailConfigured()) {
    if (process.env.NODE_ENV === "production") throw new Error("Correo sin configurar (RESEND_API_KEY / EMAIL_FROM).");
    console.info(`[correo de desarrollo] Para: ${email.to}\nAsunto: ${email.subject}\n${email.text}`);
    return;
  }
  const res = await fetch(`${apiBase()}/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(email.replyTo ? { reply_to: email.replyTo } : {}),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Resend respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

async function attempt(item: { id: string; attempts: number; payload: Email }): Promise<boolean> {
  const db = store();
  const attempts = item.attempts + 1;
  try {
    await deliver(item.payload, `outbox-${item.id}`);
    await db.updateOutbox(item.id, { attempts, sentAt: new Date(), lastError: null });
    return true;
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    const dead = attempts >= MAX_ATTEMPTS;
    await db.updateOutbox(item.id, {
      attempts,
      lastError: error.slice(0, 500),
      deadAt: dead ? new Date() : null,
      nextAttemptAt: new Date(Date.now() + BACKOFF_MIN[Math.min(attempts - 1, BACKOFF_MIN.length - 1)] * 60_000),
    });
    console.error(`[correo] intento ${attempts} falló${dead ? " (se rinde)" : ""}: ${error}`);
    return false;
  }
}

/** Guarda el correo y trata de mandarlo ya. No lanza error: si falla, queda para reintento. */
export async function sendEmail(businessId: string, email: Email): Promise<boolean> {
  const item = await store().enqueueOutbox({ businessId, payload: email });
  return attempt({ id: item.id, attempts: 0, payload: email });
}

/** Reintenta los correos pendientes (lo llama el job diario). */
export async function retryOutbox(limit = 50): Promise<{ sent: number; failed: number }> {
  const due = await store().listDueOutbox(limit);
  let sent = 0;
  for (const item of due) if (await attempt(item)) sent++;
  return { sent, failed: due.length - sent };
}

// ---------------- plantillas (texto propio) ----------------

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Correo sencillo: título, párrafos y un botón opcional. Versión HTML y de texto. */
export function layout(opts: { title: string; paragraphs: string[]; button?: { label: string; url: string }; footer?: string }): {
  html: string;
  text: string;
} {
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:${c.bg};font-family:Arial,Helvetica,sans-serif;color:${c.text}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:520px;background:${c.surface};border-radius:12px;padding:24px" cellpadding="0" cellspacing="0">
<tr><td style="font-size:14px;font-weight:bold;color:${c["accent-text"]};padding-bottom:12px">D' Garden Tacos</td></tr>
<tr><td style="font-size:22px;font-weight:bold;padding-bottom:12px">${esc(opts.title)}</td></tr>
${opts.paragraphs.map((p) => `<tr><td style="font-size:16px;line-height:24px;padding-bottom:12px">${esc(p)}</td></tr>`).join("")}
${opts.button ? `<tr><td style="padding:8px 0 16px"><a href="${esc(opts.button.url)}" style="display:inline-block;background:${c.accent};color:${c["on-accent"]};font-weight:bold;text-decoration:none;padding:12px 20px;border-radius:10px">${esc(opts.button.label)}</a></td></tr>` : ""}
${opts.footer ? `<tr><td style="font-size:13px;color:${c["text-muted"]}">${esc(opts.footer)}</td></tr>` : ""}
</table></td></tr></table></body></html>`;
  const text = [opts.title, "", ...opts.paragraphs, ...(opts.button ? ["", `${opts.button.label}: ${opts.button.url}`] : []), ...(opts.footer ? ["", opts.footer] : [])].join("\n");
  return { html, text };
}
