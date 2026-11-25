import { CalendarCheck, ClipboardList, MapPin, MessageCircle, Truck } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
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
      </div>
    </>
  );
}
