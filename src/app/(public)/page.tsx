import { BadgeCheck, CalendarCheck, CalendarClock, ClipboardList, KeyRound, MapPin, MessageCircle, Receipt, Share2, Truck } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { FaqItem } from "@/components/ui/Faq";
import { Gallery, StarsDisplay } from "@/components/ui/Misc";
import { PackageCard } from "@/components/ui/PackageCard";
import { formatMXN, whatsappLink } from "@/lib/format";
import { store } from "@/server/data";
import { formatDateShort, localDate } from "@/server/domain/time";
import { QuickStart } from "./QuickStart";

export default async function BusinessPage() {
  const db = store();
  const business = await db.getBusiness();
  const [packages, zones, reviews] = await Promise.all([
    db.listPackages(business.id),
    db.listZones(business.id),
    db.listReviews(business.id, { publishedOnly: true }),
  ]);
  const active = packages.filter((p) => p.isActive);
  const activeZones = zones.filter((z) => z.isActive);
  const minGuests = active.length ? Math.min(...active.map((p) => p.minGuests)) : 1;
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const deposit =
    business.depositType === "percent" ? `${business.depositValue} % del total` : formatMXN(business.depositValue);
  const months = Math.round(business.maxAdvanceDays / 30);

  // Lo que prometemos: cada punto es un arreglo de replica/fixes.md, no una función "de catálogo".
  const promises = [
    {
      icon: BadgeCheck,
      title: "Te confirma quien va a servir",
      text: "No un sistema ni un centro de llamadas: el mismo equipo que llega con la plancha. Si algo cambia, te avisamos al momento y te decimos por qué.",
    },
    {
      icon: CalendarClock,
      title: "La fecha que eliges es la que queda",
      text: "Antes de enviar ves el día, el año y la hora. Si algo deja de estar libre mientras agendas, te lo decimos; nunca la cambiamos por ti.",
    },
    {
      icon: Receipt,
      title: "Anticipo sin letras chiquitas",
      text: "Antes de pagar ves hasta qué día te devolvemos el anticipo completo, con fecha y monto. Y si prefieres, apartas sin pagar en línea.",
    },
    {
      icon: KeyRound,
      title: "Sin cuenta, sin contraseña, sin códigos",
      text: "Agendas con tu nombre y tu WhatsApp. Tu taquiza vive en un enlace; si lo pierdes, te lo volvemos a mandar.",
    },
    {
      icon: Share2,
      title: "Avisa a tus invitados con un toque",
      text: "Cuando está confirmada, mandas por WhatsApp la fecha, la hora y cómo llegar.",
    },
  ];

  return (
    <>
      <section className="bg-ink text-on-ink">
        <div className="mx-auto flex max-w-content flex-col gap-6 px-4 pt-10 pb-12 md:pt-16">
          <div className="flex max-w-flow flex-col gap-3">
            <p className="text-sm font-semibold tracking-wide text-brand uppercase">Taquizas · {business.city}</p>
            <h1 className="text-display text-on-ink">La plancha de {business.name} en tu fiesta</h1>
            <p className="text-lg font-normal text-on-ink-muted">{business.description}</p>
            <p className="text-base font-semibold text-on-ink">
              Tú eliges el día. Te confirma por WhatsApp el mismo equipo que llega a servir.
            </p>
          </div>
          {active.length > 0 ? (
            <div className="max-w-flow">
              <QuickStart minGuests={minGuests} />
            </div>
          ) : (
            <Alert tone="warning" title="Por ahora no estamos recibiendo taquizas en línea" className="max-w-flow">
              {business.whatsappE164 ? "Escríbenos por WhatsApp para apartar tu fecha." : "Vuelve pronto."}
            </Alert>
          )}
          {business.whatsappE164 && (
            <ButtonLink
              variant="whatsapp"
              external
              className="w-fit"
              href={whatsappLink(business.whatsappE164, "Hola, quiero información para una taquiza.")}
            >
              <MessageCircle aria-hidden className="size-5" />
              Preguntar por WhatsApp
            </ButtonLink>
          )}
        </div>
      </section>

      <div className="mx-auto flex max-w-content flex-col gap-12 px-4 py-10">
        <section aria-labelledby="fotos">
          <h2 id="fotos" className="sr-only">
            Fotos
          </h2>
          <Gallery photos={business.photoPaths.map((src, i) => ({ src, alt: `${business.name}, foto ${i + 1}` }))} />
        </section>

        <section aria-labelledby="como" className="flex flex-col gap-4">
          <h2 id="como" className="text-xl text-text">
            Así de fácil
          </h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {[
              { icon: CalendarCheck, title: "Elige fecha y hora", text: "Ves en el calendario qué días tenemos libres." },
              { icon: ClipboardList, title: "Cuéntanos de tu evento", text: "Paquete, invitados y dirección. Sin crear cuenta." },
              { icon: Truck, title: "Te confirmamos y llegamos", text: "Nosotros mismos te confirmamos por WhatsApp. El día del evento llegamos con la plancha." },
            ].map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="flex gap-3 rounded-lg border border-border bg-surface p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-accent-subtle text-accent-text">
                  <Icon aria-hidden className="size-5" />
                </span>
                <div>
                  <p className="font-semibold text-text">
                    <span className="sr-only">Paso {i + 1}: </span>
                    {title}
                  </p>
                  <p className="text-sm text-text-muted">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="promesa" className="flex flex-col gap-4">
          <div className="flex max-w-flow flex-col gap-2">
            <h2 id="promesa" className="text-xl text-text">
              Lo que te prometemos
            </h2>
            <p className="text-text-muted">
              Organizar una fiesta ya es bastante. Lo último que quieres es llegar la hora y que nadie tenga tu fecha, o no
              saber si te devuelven el anticipo.
            </p>
          </div>
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {promises.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3 rounded-lg border border-border bg-surface p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-accent-subtle text-accent-text">
                  <Icon aria-hidden className="size-5" />
                </span>
                <div>
                  <h3 className="font-semibold text-text">{title}</h3>
                  <p className="text-sm text-text-muted">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="paquetes" className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-4">
            <h2 id="paquetes" className="text-xl text-text">
              Paquetes
            </h2>
            <a href="/paquetes" className="min-h-11 content-center text-sm font-semibold text-accent-text underline underline-offset-4">
              Ver detalles
            </a>
          </div>
          {active.length === 0 ? (
            <p className="text-text-muted">Estamos preparando nuestros paquetes.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {active.map((p) => (
                <PackageCard
                  key={p.id}
                  pkg={{ ...p, photoUrl: p.photoPath, maxGuests: p.maxGuests }}
                  variant="full"
                />
              ))}
            </div>
          )}
        </section>

        {activeZones.length > 0 && (
          <section aria-labelledby="zona" className="flex flex-col gap-3">
            <h2 id="zona" className="text-xl text-text">
              Dónde damos servicio
            </h2>
            <ul className="flex flex-col gap-2">
              {activeZones.map((z) => (
                <li key={z.id} className="flex items-center gap-2 text-text">
                  <MapPin aria-hidden className="size-4 text-text-muted" />
                  {z.name}
                  <span className="text-sm text-text-muted">
                    · {z.travelFeeCents > 0 ? `traslado ${formatMXN(z.travelFeeCents)}` : "traslado sin costo"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {reviews.length > 0 && (
          <section aria-labelledby="resenas" className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <h2 id="resenas" className="text-xl text-text">
                Lo que dicen nuestros clientes
              </h2>
              <StarsDisplay rating={avg} />
              <span className="text-sm text-text-muted">({reviews.length})</span>
            </div>
            <ul className="grid gap-4 md:grid-cols-2">
              {reviews.slice(0, 6).map((r) => (
                <li key={r.id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
                  <StarsDisplay rating={r.rating} />
                  {r.comment && <p className="text-text">{r.comment}</p>}
                  <p className="text-xs text-text-muted">{formatDateShort(localDate(r.createdAt, business.timezone))}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="preguntas" className="flex max-w-flow flex-col gap-4">
          <h2 id="preguntas" className="text-xl text-text">
            Preguntas frecuentes
          </h2>
          <div className="flex flex-col gap-2">
            <FaqItem q="¿Tengo que crear una cuenta?">
              No. Agendas con tu nombre y tu WhatsApp, y tu taquiza vive en un enlace privado que abre en cualquier celular.
            </FaqItem>
            <FaqItem q="¿Tengo que pagar en línea?">
              {business.depositMode === "none"
                ? "No. Por ahora no pedimos anticipo."
                : business.depositMode === "optional"
                  ? `No. Puedes pagar un anticipo (${deposit}) con tarjeta o Mercado Pago, o apartar sin pagar en línea y pagarnos en efectivo o por transferencia.`
                  : `Para apartar tu fecha pedimos un anticipo (${deposit}) con tarjeta o Mercado Pago.`}
            </FaqItem>
            {business.depositMode !== "none" && (
              <FaqItem q="¿Hasta cuándo me devuelven el anticipo si cancelo?">
                Si cancelas al menos {business.refundCutoffDays} {business.refundCutoffDays === 1 ? "día" : "días"} antes del
                evento, te lo devolvemos completo. Antes de pagar ves la fecha exacta.
              </FaqItem>
            )}
            <FaqItem q="¿Puedo cambiar la fecha o los invitados?">
              Sí, desde tu enlace, mientras haya lugar ese día. Si el cambio necesita nuestra revisión, te confirmamos por WhatsApp.
            </FaqItem>
            <FaqItem q="¿Con cuánta anticipación tengo que agendar?">
              Desde {business.minNoticeDays} {business.minNoticeDays === 1 ? "día" : "días"} antes
              {months > 0 ? ` y hasta ${months} ${months === 1 ? "mes" : "meses"} antes` : ""}. Para fechas más cercanas,
              escríbenos por WhatsApp.
            </FaqItem>
            <FaqItem q="¿Llegan a mi colonia?">
              {activeZones.length > 0
                ? `Damos servicio en: ${activeZones.map((z) => z.name).join(", ")}. Si tu dirección no aparece, pregúntanos.`
                : "Pregúntanos por WhatsApp."}
            </FaqItem>
          </div>
          <a href="/politicas" className="min-h-11 content-center text-sm font-semibold text-accent-text underline underline-offset-4">
            Todas las políticas
          </a>
        </section>
      </div>

      <section aria-labelledby="final" className="bg-ink text-on-ink">
        <div className="mx-auto flex max-w-content flex-col items-start gap-4 px-4 py-12">
          <h2 id="final" className="text-xl text-on-ink md:text-display">
            ¿Ya tienes fecha?
          </h2>
          <p className="max-w-flow text-lg font-normal text-on-ink-muted">
            Ve los días libres, elige tu paquete y aparta en un par de minutos.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/agendar" size="lg">
              <CalendarCheck aria-hidden className="size-5" />
              Ver fechas disponibles
            </ButtonLink>
            {business.whatsappE164 && (
              <ButtonLink
                variant="whatsapp"
                size="lg"
                external
                href={whatsappLink(business.whatsappE164, "Hola, quiero información para una taquiza.")}
              >
                <MessageCircle aria-hidden className="size-5" />
                Preguntar por WhatsApp
              </ButtonLink>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
