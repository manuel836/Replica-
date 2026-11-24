import { z } from "zod";

/** 10 dígitos de México → "+52XXXXXXXXXX". Acepta espacios, guiones y "+52" al inicio. */
export function toMexicanE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  const ten = digits.length === 12 && digits.startsWith("52") ? digits.slice(2) : digits;
  return /^[1-9]\d{9}$/.test(ten) ? `+52${ten}` : null;
}

export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige una fecha.");
export const timeStr = z.string().regex(/^\d{2}:\d{2}$/, "Elige una hora.");
const text = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres.`);

export const phone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const e164 = toMexicanE164(v);
    if (!e164) {
      ctx.addIssue({ code: "custom", message: "Escribe los 10 dígitos de tu WhatsApp." });
      return z.NEVER;
    }
    return e164;
  });

export const bookingForm = z.object({
  idempotencyKey: z.uuid(),
  name: z.string().trim().min(2, "Escribe tu nombre.").max(80, "Máximo 80 caracteres."),
  whatsapp: phone,
  email: z
    .string()
    .trim()
    .max(120)
    .transform((v) => v || null)
    .pipe(z.email("Revisa el correo.").nullable()),
  date: dateStr,
  time: timeStr,
  guests: z.coerce.number().int("Escribe un número entero.").min(1, "Mínimo 1 invitado.").max(2000, "Máximo 2000 invitados."),
  packageId: z.string().min(1, "Elige un paquete."),
  zoneId: z
    .string()
    .optional()
    .transform((v) => v || null),
  address: z.string().trim().min(5, "Escribe la calle y el número.").max(200, "Máximo 200 caracteres."),
  neighborhood: text(100).min(2, "Escribe la colonia."),
  addressNotes: text(300),
  eventType: text(60),
  customerNotes: text(1000),
  payMode: z.enum(["now", "later"]),
  acceptPolicies: z.literal(true, { error: "Necesitas aceptar las políticas para continuar." }),
});

export type BookingForm = z.input<typeof bookingForm>;

/** Primer error por campo, para mostrar junto a cada campo. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    out[key] ??= issue.message;
  }
  return out;
}
