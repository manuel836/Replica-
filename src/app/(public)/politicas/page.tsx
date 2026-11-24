import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { formatMXN } from "@/lib/format";
import { store } from "@/server/data";

export const metadata = { title: "Políticas y preguntas" };

function Item({ q, children, open = false }: { q: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-lg border border-border bg-surface">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 font-semibold text-text [&::-webkit-details-marker]:hidden">
        {q}
        <ChevronDown aria-hidden className="size-5 shrink-0 text-text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-2 px-4 pb-4 text-text-muted">{children}</div>
    </details>
  );
}

export default async function PoliciesPage() {
  const db = store();
  const business = await db.getBusiness();
  const zones = (await db.listZones(business.id)).filter((z) => z.isActive);
  const deposit =
    business.depositMode === "none"
      ? null
      : business.depositType === "percent"
        ? `${business.depositValue} % del total`
        : formatMXN(business.depositValue);

  return (
    <div className="mx-auto flex w-full max-w-flow flex-col gap-6 px-4 py-8">
      <h1 className="text-xl text-text md:text-display">Políticas y preguntas</h1>

      <section aria-labelledby="politicas" className="flex flex-col gap-3">
        <h2 id="politicas" className="text-lg text-text">
          Anticipo y cancelación
        </h2>
        <Item q="¿Tengo que pagar anticipo?" open>
          {deposit ? (
            <p>
              El anticipo es de <strong className="text-text">{deposit}</strong>.{" "}
              {business.depositMode === "required"
                ? "Lo necesitamos para confirmar tu fecha."
                : "Puedes pagarlo en línea al agendar o después, en efectivo o por transferencia."}
            </p>
          ) : (
            <p>No pedimos anticipo. Pagas el día del evento.</p>
          )}
          <p>Mientras pagas en línea, tu fecha queda apartada {business.paymentHoldMinutes} minutos.</p>
        </Item>
        <Item q="¿Qué pasa si cancelo?" open>
          {business.cancellationPolicy && <p className="whitespace-pre-line">{business.cancellationPolicy}</p>}
          <p>
            Si cancelas con {business.refundCutoffDays} días o más de anticipación, te devolvemos el anticipo pagado en línea.
          </p>
        </Item>
        <Item q="¿Puedo cambiar la fecha o los invitados?">
          <p>Sí, desde el enlace de tu taquiza, siempre que haya lugar en la nueva fecha.</p>
        </Item>
      </section>

      <section aria-labelledby="preguntas" className="flex flex-col gap-3">
        <h2 id="preguntas" className="text-lg text-text">
          Preguntas frecuentes
        </h2>
        <Item q="¿Con cuánta anticipación tengo que agendar?">
          <p>
            Con al menos {business.minNoticeDays} días. Puedes agendar hasta {Math.round(business.maxAdvanceDays / 30)} meses antes.
          </p>
        </Item>
        <Item q="¿Hasta dónde llegan?">
          {zones.length ? (
            <ul className="list-disc pl-5">
              {zones.map((z) => (
                <li key={z.id}>
                  {z.name}: {z.travelFeeCents > 0 ? `traslado de ${formatMXN(z.travelFeeCents)}` : "traslado sin costo"}
                </li>
              ))}
            </ul>
          ) : (
            <p>Escríbenos para confirmar si llegamos a tu zona.</p>
          )}
        </Item>
        <Item q="¿Qué incluye cada paquete?">
          <p>
            Lo ves en la página de{" "}
            <a href="/paquetes" className="font-semibold text-accent-text underline underline-offset-4">
              paquetes
            </a>
            .
          </p>
        </Item>
        <Item q="¿Cómo me confirman?">
          <p>Por WhatsApp, al número que nos diste. También puedes ver el estado en el enlace de tu taquiza.</p>
        </Item>
      </section>

      <section aria-labelledby="privacidad" className="flex flex-col gap-3">
        <h2 id="privacidad" className="text-lg text-text">
          Aviso de privacidad
        </h2>
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">
          <p>
            {business.name} usa tu nombre, WhatsApp, correo y la dirección del evento solo para atender y dar seguimiento a tu
            taquiza. No los vendemos. Los procesan, por cuenta nuestra, estos servicios:
          </p>
          <ul className="list-disc pl-5">
            <li>Mercado Pago: cobra el anticipo cuando pagas en línea (nunca vemos los datos de tu tarjeta).</li>
            <li>Supabase: guarda la base de datos y las fotos.</li>
            <li>Vercel: aloja este sitio.</li>
            <li>Resend: manda los correos de aviso al negocio y, si nos dejaste tu correo, tus confirmaciones y recordatorios.</li>
            <li>Cloudflare Turnstile: revisa que las solicitudes no vengan de robots.</li>
            <li>WhatsApp: los mensajes que te mandamos salen desde la app de WhatsApp del negocio.</li>
          </ul>
          <p>Puedes pedirnos ver, corregir o borrar tus datos escribiéndonos por WhatsApp.</p>
          <p className="font-semibold text-warning">
            Texto provisional: debe revisarlo un abogado para cumplir con la ley de protección de datos de México.
          </p>
        </div>
      </section>
    </div>
  );
}
