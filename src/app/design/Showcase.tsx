"use client";

import { useState, type ReactNode } from "react";
import { addDays, format, startOfMonth } from "date-fns";
import { CalendarX, MessageCircle, Send } from "lucide-react";
import tokens from "../../../replica/design/tokens.json";
import { AdminNav } from "@/components/ui/AdminNav";
import { BookingCalendar, type DayState } from "@/components/ui/BookingCalendar";
import { BookingCard } from "@/components/ui/BookingCard";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Alert, EmptyState } from "@/components/ui/Feedback";
import { PhoneField, SelectField, TextareaField, TextField } from "@/components/ui/Field";
import { GuestStepper } from "@/components/ui/GuestStepper";
import { Gallery, MapLink, StarsDisplay, StarsInput, Timeline } from "@/components/ui/Misc";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { PackageCard, type PackageInfo } from "@/components/ui/PackageCard";
import { PaymentChoice, type PayMode } from "@/components/ui/PaymentChoice";
import { PriceSummary } from "@/components/ui/PriceSummary";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { StatusBadge, type BookingStatus } from "@/components/ui/StatusBadge";
import { StepBar } from "@/components/ui/StepBar";
import { TimeSlots } from "@/components/ui/TimeSlots";
import { toast } from "@/components/ui/Toast";
import { whatsappLink } from "@/lib/format";

// Datos de ejemplo: los paquetes reales los captura el dueño en S15.
const PACKAGES: PackageInfo[] = [
  {
    id: "clasico",
    name: "Paquete de ejemplo A",
    description: "Texto de ejemplo. El dueño escribe qué incluye cada paquete.",
    pricePerGuestCents: 15000,
    minGuests: 30,
    maxGuests: 150,
    includes: ["Tacos de plancha (ejemplo)", "Cebollitas asadas (ejemplo)", "Salsas de la casa (ejemplo)"],
  },
  {
    id: "completo",
    name: "Paquete de ejemplo B",
    pricePerGuestCents: 19900,
    minGuests: 50,
    includes: ["Todo lo del paquete A", "Aguas frescas (ejemplo)"],
  },
  { id: "inactivo", name: "Paquete inactivo", pricePerGuestCents: 12000, minGuests: 20, isActive: false },
];

const ALL_STATUSES: BookingStatus[] = [
  "requested",
  "awaiting_payment",
  "confirmed",
  "proposed",
  "declined",
  "cancelled_by_customer",
  "cancelled_by_business",
  "completed",
  "no_show",
  "expired",
];

function demoDays(month: Date): Record<string, DayState> {
  const out: Record<string, DayState> = {};
  const first = startOfMonth(month);
  for (let i = 0; i < 31; i++) {
    const d = addDays(first, i);
    if (d.getMonth() !== first.getMonth()) break;
    const n = d.getDate();
    out[format(d, "yyyy-MM-dd")] =
      n < 4 ? "out" : n % 7 === 1 ? "closed" : n === 12 || n === 25 ? "blocked" : n % 5 === 0 ? "full" : n % 3 === 0 ? "few" : "available";
  }
  return out;
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 border-t border-border py-8">
      <h2 id={id} className="text-xl text-text">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Showcase() {
  const [guests, setGuests] = useState(60);
  const [month, setMonth] = useState(startOfMonth(addDays(new Date(), 30)));
  const [day, setDay] = useState<Date | undefined>();
  const [time, setTime] = useState<string | undefined>("14:00");
  const [pkg, setPkg] = useState("clasico");
  const [pay, setPay] = useState<PayMode>("now");
  const [stars, setStars] = useState(4);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-content flex-col px-4 pb-24">
        <header className="flex flex-col gap-2 py-8">
          <h1 className="text-display text-text">Sistema de diseño</h1>
          <p className="max-w-flow text-base text-text-muted">
            Componentes base de las taquizas de D&apos; Garden Tacos, con sus estados. Los textos de ejemplo no son
            definitivos.
          </p>
        </header>

        <Section id="colores" title="Colores (roles)">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {Object.entries(tokens.color).map(([name, hex]) => (
              <li key={name} className="flex flex-col gap-1.5">
                <span className="h-12 rounded-md border border-border" style={{ backgroundColor: `var(--dg-color-${name})` }} />
                <span className="text-xs font-semibold text-text">{name}</span>
                <span className="font-mono text-xs text-text-muted">{hex}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="tipografia" title="Tipografía">
          <div className="flex flex-col gap-2">
            <p className="font-display text-display text-text">Display 40 · Bricolage Grotesque</p>
            <p className="font-display text-xl text-text">XL 28 · Títulos de sección</p>
            <p className="text-lg text-text">LG 20 · Subtítulos y precios</p>
            <p className="text-base text-text">Base 16 · Texto y campos (16px evita el zoom en iPhone)</p>
            <p className="text-sm text-text-muted">SM 14 · Ayudas y etiquetas</p>
            <p className="text-xs text-text-muted">XS 12 · Insignias y notas</p>
          </div>
        </Section>

        <Section id="botones" title="Botones">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Agendar taquiza</Button>
            <Button variant="secondary">Cambiar fecha</Button>
            <Button variant="ghost">Volver</Button>
            <Button variant="danger">Cancelar taquiza</Button>
            <ButtonLink variant="whatsapp" external href={whatsappLink("+527530000000", "Hola, quiero una taquiza")}>
              <MessageCircle aria-hidden className="size-5" />
              Enviar por WhatsApp
            </ButtonLink>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Pequeño</Button>
            <Button size="md">Mediano</Button>
            <Button size="lg">Grande</Button>
            <Button loading>Guardando</Button>
            <Button disabled>Deshabilitado</Button>
          </div>
        </Section>

        <Section id="campos" title="Campos de formulario">
          <div className="grid max-w-flow gap-4">
            <TextField label="Nombre" required placeholder="Como te llamas" autoComplete="name" />
            <PhoneField label="WhatsApp" required hint="Ahí te confirmamos la taquiza." placeholder="753 123 4567" />
            <TextField label="Correo" optional type="email" autoComplete="email" />
            <TextField label="Dirección del evento" required error="Escribe la calle y el número." />
            <SelectField
              label="Tipo de evento"
              required
              defaultValue=""
              placeholder="Elige uno"
              options={[
                { value: "cumple", label: "Cumpleaños" },
                { value: "boda", label: "Boda" },
                { value: "empresa", label: "Evento de empresa" },
                { value: "otro", label: "Otro" },
              ]}
            />
            <TextareaField label="Notas" optional hint="Alergias, horarios de acceso, etc." />
            <TextField label="Deshabilitado" disabled defaultValue="No editable" />
          </div>
        </Section>

        <Section id="agendar" title="Agendar: pasos, invitados, calendario y horarios">
          <StepBar steps={["Fecha y hora", "Datos del evento", "Pago"]} current={0} label="Ejemplo: paso 1" />
          <StepBar steps={["Fecha y hora", "Datos del evento", "Pago"]} current={2} label="Ejemplo: paso 3" />
          <GuestStepper value={guests} onChange={setGuests} min={20} max={300} hint="Mínimo 20 invitados." />
          <GuestStepper value={10} onChange={() => {}} min={20} error="Este paquete es desde 30 invitados." />
          <div className="flex flex-col gap-6 lg:flex-row">
            <BookingCalendar
              days={demoDays(month)}
              month={month}
              onMonthChange={setMonth}
              selected={day}
              onSelect={setDay}
            />
            <div className="max-w-flow flex-1">
              <TimeSlots
                value={time}
                onChange={setTime}
                slots={[
                  { time: "12:00", free: true },
                  { time: "12:30", free: true },
                  { time: "13:00", free: false },
                  { time: "13:30", free: false },
                  { time: "14:00", free: true },
                  { time: "14:30", free: true },
                  { time: "18:00", free: true },
                  { time: "18:30", free: false },
                ]}
              />
              <div className="mt-6">
                <TimeSlots slots={[]} onChange={() => {}} />
              </div>
            </div>
          </div>
        </Section>

        <Section id="paquetes" title="Paquetes">
          <div className="grid gap-4 md:grid-cols-3">
            {PACKAGES.map((p) => (
              <PackageCard key={p.id} pkg={p} />
            ))}
          </div>
          <fieldset className="grid gap-3 md:grid-cols-3">
            <legend className="sr-only">Paquete</legend>
            {PACKAGES.map((p) => (
              <PackageCard
                key={p.id}
                pkg={p}
                variant="compact"
                selectable={{ name: "paquete", checked: pkg === p.id, onChange: () => setPkg(p.id) }}
              />
            ))}
          </fieldset>
        </Section>

        <Section id="pago" title="Resumen y pago">
          <div className="grid gap-6 lg:grid-cols-2">
            <PriceSummary
              packageName="Paquete A"
              guests={guests}
              pricePerGuestCents={15000}
              travelFeeCents={25000}
              depositCents={Math.ceil((15000 * guests + 25000) * 0.3 / 100) * 100}
              estimated
            />
            <PaymentChoice value={pay} onChange={setPay} depositCents={Math.ceil((15000 * guests + 25000) * 0.3 / 100) * 100} depositMode="optional" />
          </div>
        </Section>

        <Section id="estados" title="Estados de una taquiza">
          <div className="flex flex-wrap gap-2">
            {ALL_STATUSES.map((s) => (
              <StatusBadge key={s} status={s} />
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <BookingCard
              href="#"
              booking={{
                id: "1",
                code: "DGT-4K7Q",
                customerName: "Cliente de ejemplo",
                when: "sáb 14 dic · 14:00",
                guests: 80,
                packageName: "Paquete A",
                neighborhood: "Colonia de ejemplo",
                status: "requested",
              }}
            />
            <BookingCard
              href="#"
              booking={{
                id: "2",
                code: "DGT-9PZ2",
                customerName: "Otro cliente",
                when: "dom 15 dic · 13:00",
                guests: 45,
                packageName: "Paquete B",
                status: "confirmed",
                needsAttention: true,
              }}
            />
          </div>
        </Section>

        <Section id="avisos" title="Avisos, vacíos y diálogos">
          <div className="grid max-w-flow gap-3">
            <Alert tone="info" title="Tu fecha está apartada 24 horas">
              Te escribiremos por WhatsApp para confirmar.
            </Alert>
            <Alert tone="warning" title="Fuera de la zona de servicio">
              Esa colonia tiene cargo de traslado o necesitamos confirmarla contigo.
            </Alert>
            <Alert tone="danger" title="Ese horario se acaba de ocupar">
              Elige otra hora; tus datos no se pierden.
            </Alert>
            <Alert tone="success" title="Pago recibido">
              Tu taquiza quedó confirmada.
            </Alert>
          </div>
          <EmptyState icon={CalendarX} title="Sin taquizas por ahora" action={<Button size="sm">Registrar una taquiza</Button>}>
            Cuando un cliente agende, aparecerá aquí.
          </EmptyState>
          <div className="flex flex-wrap gap-3">
            <Modal trigger={<Button variant="secondary">Abrir diálogo</Button>} title="Proponer otra fecha" description="El cliente recibe la propuesta y puede aceptarla o rechazarla.">
              <p className="text-sm text-text-muted">Aquí va el calendario.</p>
            </Modal>
            <ConfirmDialog
              trigger={<Button variant="danger">Cancelar taquiza</Button>}
              title="¿Cancelar esta taquiza?"
              description="Se avisa al cliente. Si pagó anticipo dentro del plazo, se le devuelve."
              confirmLabel="Sí, cancelar"
              onConfirm={async () => {
                await new Promise((r) => setTimeout(r, 600));
                toast.success("Taquiza cancelada");
              }}
            />
            <Button variant="secondary" onClick={() => toast.success("Cambios guardados")}>
              <Send aria-hidden className="size-4" />
              Probar aviso
            </Button>
            <Button variant="secondary" onClick={() => toast.error("No se pudo guardar. Intenta de nuevo.")}>
              Probar error
            </Button>
          </div>
        </Section>

        <Section id="otros" title="Galería, mapa, reseñas e historial">
          <Gallery photos={[]} />
          <MapLink address="Av. Ejemplo 123, Lázaro Cárdenas, Michoacán" />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-12">
            <div className="flex flex-col gap-2">
              <StarsDisplay rating={4.6} />
              <StarsInput value={stars} onChange={setStars} />
            </div>
            <Timeline
              items={[
                { id: "c", title: "Confirmada", at: "12 dic, 18:04", actor: "negocio" },
                { id: "b", title: "Anticipo pagado", at: "12 dic, 17:58", actor: "sistema" },
                { id: "a", title: "Solicitud recibida", at: "12 dic, 17:51", actor: "cliente" },
              ]}
            />
          </div>
        </Section>

        <Section id="panel" title="Navegación del panel">
          <div className="flex min-h-80 overflow-hidden rounded-lg border border-border">
            <AdminNav current="/admin" />
            <div className="flex-1 bg-bg p-4 text-sm text-text-muted">
              Contenido del panel. En celular, la navegación pasa a una barra fija abajo (visible al final de esta página).
            </div>
          </div>
        </Section>
      </main>
    </>
  );
}
