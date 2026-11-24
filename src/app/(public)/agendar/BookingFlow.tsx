"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, ArrowRight, CalendarDays } from "lucide-react";
import type { DayState, DepositMode, DepositType } from "@/lib/types";
import { BookingCalendar } from "@/components/ui/BookingCalendar";
import { Button } from "@/components/ui/Button";
import { Alert, EmptyState } from "@/components/ui/Feedback";
import { PhoneField, SelectField, TextareaField, TextField } from "@/components/ui/Field";
import { GuestStepper } from "@/components/ui/GuestStepper";
import { PackageCard, type PackageInfo } from "@/components/ui/PackageCard";
import { PaymentChoice, type PayMode } from "@/components/ui/PaymentChoice";
import { PriceSummary } from "@/components/ui/PriceSummary";
import { StepBar } from "@/components/ui/StepBar";
import { TimeSlots, type Slot } from "@/components/ui/TimeSlots";
import { Turnstile } from "@/components/Turnstile";
import { crearTaquiza } from "@/server/actions/public";
import { safe } from "@/lib/safe-action";

interface Props {
  business: {
    name: string;
    whatsappE164: string | null;
    depositMode: DepositMode;
    depositType: DepositType;
    depositValue: number;
    paymentHoldMinutes: number;
    requestHoldHours: number;
    confirmationMode: "auto" | "manual";
    minNoticeDays: number;
  };
  packages: PackageInfo[];
  zones: { id: string; name: string; travelFeeCents: number }[];
  initialGuests: number;
  firstMonth: string;
  lastMonth: string;
}

const STEPS = ["Fecha y hora", "Datos del evento", "Pago"];
const EVENT_TYPES = ["Cumpleaños", "Boda", "XV años", "Bautizo o comunión", "Evento de empresa", "Reunión familiar", "Otro"];

const monthKey = (d: Date) => format(d, "yyyy-MM");
/** Borrador del formulario en esta pestaña: sobrevive a recargar y se borra al enviar. */
const DRAFT_KEY = "dg-agendar-borrador";
const toDate = (ymd: string) => new Date(`${ymd}T12:00:00`);

function deposit(b: Props["business"], total: number) {
  if (b.depositMode === "none" || total === 0) return 0;
  if (b.depositType === "fixed") return Math.min(b.depositValue, total);
  return Math.min(total, Math.ceil((total * b.depositValue) / 100 / 100) * 100);
}

export function BookingFlow({ business, packages, zones, initialGuests, firstMonth, lastMonth }: Props) {
  const searchParams = useSearchParams();
  const urlStep = Math.min(2, Math.max(0, (Number(searchParams.get("paso")) || 1) - 1));
  const [detailsOk, setDetailsOk] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [guests, setGuests] = useState(initialGuests);
  const [month, setMonth] = useState(toDate(`${firstMonth}-01`));
  const [days, setDays] = useState<Record<string, DayState>>({});
  const [daysLoading, setDaysLoading] = useState(true);
  const [daysError, setDaysError] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotsError, setSlotsError] = useState(false);
  const [time, setTime] = useState<string | undefined>();
  const [packageId, setPackageId] = useState(() => packages.find((p) => initialGuests >= p.minGuests)?.id ?? "");
  const [form, setForm] = useState({
    name: "",
    whatsapp: "",
    email: "",
    zoneId: zones.length === 1 ? zones[0].id : "",
    address: "",
    neighborhood: "",
    addressNotes: "",
    eventType: "",
    customerNotes: "",
  });
  const [payMode, setPayMode] = useState<PayMode>(business.depositMode === "none" ? "later" : "now");
  const [accept, setAccept] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const idempotencyKey = useRef<string>("");
  if (!idempotencyKey.current && typeof crypto !== "undefined") idempotencyKey.current = crypto.randomUUID();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // ---- Paso actual: va en la URL (?paso=2), así Atrás y Adelante del navegador funcionan ----
  // No se puede estar en un paso sin haber completado los anteriores.
  const step = !date || !time ? 0 : urlStep === 2 && !detailsOk ? 1 : urlStep;
  const goTo = useCallback((next: number) => {
    const p = new URLSearchParams(window.location.search);
    p.set("paso", String(next + 1));
    window.history.pushState(null, "", `?${p}`);
    requestAnimationFrame(() => headingRef.current?.focus());
  }, []);

  // ---- Borrador: se recupera al recargar a mitad del flujo ----
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      const midFlow = new URLSearchParams(window.location.search).has("paso");
      if (raw && midFlow) {
        const d = JSON.parse(raw);
        if (d?.v === 1) {
          setGuests(d.guests);
          if (d.month) setMonth(toDate(`${d.month}-01`));
          setDate(d.date ?? null);
          setTime(d.time ?? undefined);
          if (d.packageId) setPackageId(d.packageId);
          setForm((f) => ({ ...f, ...d.form }));
          if (d.payMode) setPayMode(d.payMode);
          setDetailsOk(Boolean(d.detailsOk));
          if (d.key) idempotencyKey.current = d.key;
        }
      } else if (!midFlow) {
        sessionStorage.removeItem(DRAFT_KEY);
      }
    } catch {
      /* sin sessionStorage (modo privado estricto): el flujo funciona igual, sin borrador */
    }
    setDraftReady(true);
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    try {
      sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ v: 1, guests, month: monthKey(month), date, time, packageId, form, payMode, detailsOk, key: idempotencyKey.current }),
      );
    } catch {
      /* ignorar */
    }
  }, [draftReady, guests, month, date, time, packageId, form, payMode, detailsOk]);

  // ---- Disponibilidad del mes (se recalcula si cambian los invitados) ----
  const loadMonth = useCallback(async (m: Date, g: number, signal?: AbortSignal) => {
    setDaysLoading(true);
    setDaysError(false);
    try {
      const res = await fetch(`/api/disponibilidad/mes?mes=${monthKey(m)}&invitados=${g}`, { signal, cache: "no-store" });
      if (!res.ok) throw new Error();
      setDays(await res.json());
    } catch (e) {
      if ((e as Error).name !== "AbortError") setDaysError(true);
    } finally {
      if (!signal?.aborted) setDaysLoading(false);
    }
  }, []);
  useEffect(() => {
    const ctrl = new AbortController();
    setDaysLoading(true); // de inmediato: no evaluar el mes nuevo con los días del anterior
    const t = setTimeout(() => loadMonth(month, guests, ctrl.signal), 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [month, guests, loadMonth]);

  const loadDay = useCallback(async (d: string, g: number) => {
    setSlots(null);
    setSlotsError(false);
    try {
      const res = await fetch(`/api/disponibilidad/dia?fecha=${d}&invitados=${g}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      setSlots(await res.json());
    } catch {
      setSlotsError(true);
      setSlots([]);
    }
  }, []);
  useEffect(() => {
    if (date) loadDay(date, guests);
  }, [date, guests, loadDay]);

  // Si al cambiar invitados la fecha elegida ya no está libre, se suelta.
  useEffect(() => {
    if (date && days[date] && !["available", "few"].includes(days[date])) {
      setDate(null);
      setTime(undefined);
    }
  }, [days, date]);

  const shownDays = Object.entries(days).filter(([d]) => d.startsWith(monthKey(month)));
  const noneThisMonth =
    !daysLoading && !daysError && shownDays.length > 0 && !shownDays.some(([, s]) => s === "available" || s === "few");
  const canGoNext = monthKey(month) < lastMonth;

  const pkg = packages.find((p) => p.id === packageId) ?? null;
  const zone = zones.find((z) => z.id === form.zoneId) ?? null;
  const total = pkg ? pkg.pricePerGuestCents * guests + (zone?.travelFeeCents ?? 0) : 0;
  const depositCents = deposit(business, total);
  const fits = (p: PackageInfo) => guests >= p.minGuests && (!p.maxGuests || guests <= p.maxGuests);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const when = useMemo(
    () => (date && time ? `${format(toDate(date), "EEEE d 'de' MMMM", { locale: es })} a las ${time}` : null),
    [date, time],
  );

  function validateDetails(): boolean {
    const e: Record<string, string> = {};
    if (!pkg) e.packageId = "Elige un paquete.";
    else if (!fits(pkg)) e.packageId = `Este paquete es para ${pkg.minGuests}${pkg.maxGuests ? ` a ${pkg.maxGuests}` : " o más"} invitados.`;
    if (form.name.trim().length < 2) e.name = "Escribe tu nombre.";
    if (form.whatsapp.replace(/\D/g, "").length !== 10) e.whatsapp = "Escribe los 10 dígitos de tu WhatsApp.";
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Revisa el correo.";
    if (zones.length > 0 && !form.zoneId) e.zoneId = "Elige la zona del evento.";
    if (form.address.trim().length < 5) e.address = "Escribe la calle y el número.";
    if (form.neighborhood.trim().length < 2) e.neighborhood = "Escribe la colonia.";
    setErrors(e);
    if (Object.keys(e).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
      return false;
    }
    return true;
  }

  async function submit() {
    if (!accept) {
      setErrors({ acceptPolicies: "Necesitas aceptar las políticas para continuar." });
      return;
    }
    setSubmitting(true);
    setBanner(null);
    const res = await safe(crearTaquiza)({
      idempotencyKey: idempotencyKey.current,
      ...form,
      whatsapp: form.whatsapp,
      date,
      time,
      guests,
      packageId,
      payMode: depositCents > 0 ? payMode : "later",
      acceptPolicies: accept,
      turnstileToken,
    });
    if (res.ok) {
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignorar */
      }
      window.location.assign(res.redirectTo);
      return;
    }
    setSubmitting(false);
    const fields = res.fields ?? {};
    if (["time_taken", "day_full", "guests_full", "blocked_date", "closed_day", "too_soon", "too_far", "outside_hours"].includes(res.code ?? "")) {
      setBanner(`${res.error} Elige otro horario; tus datos se guardan.`);
      setTime(undefined);
      if (date) loadDay(date, guests);
      loadMonth(month, guests);
      goTo(0);
    } else if (Object.keys(fields).some((k) => k !== "acceptPolicies" && k !== "payMode")) {
      setErrors(fields);
      setBanner(res.error);
      goTo(1);
    } else {
      setBanner(res.error);
    }
  }

  if (packages.length === 0) {
    return (
      <EmptyState icon={CalendarDays} title="Por ahora no hay paquetes disponibles">
        Estamos preparando nuestros paquetes. Vuelve pronto o escríbenos.
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <StepBar steps={STEPS} current={step} />
        <h2 ref={headingRef} tabIndex={-1} className="text-lg text-text focus:outline-none">
          Paso {step + 1} de 3: {STEPS[step]}
        </h2>
        {banner && (
          <Alert tone="danger" title="No pudimos guardar">
            {banner}
          </Alert>
        )}

        {step === 0 && (
          <div className="flex flex-col gap-6">
            <GuestStepper
              value={guests}
              onChange={setGuests}
              min={1}
              max={2000}
              step={10}
              hint="Puedes escribir el número exacto."
            />
            <div className="flex flex-col gap-6 md:flex-row md:items-start">
              <div>
                {daysError ? (
                  <Alert
                    tone="danger"
                    title="No pudimos cargar el calendario"
                    action={
                      <Button size="sm" variant="secondary" onClick={() => loadMonth(month, guests)}>
                        Reintentar
                      </Button>
                    }
                  >
                    Revisa tu conexión.
                  </Alert>
                ) : (
                  <BookingCalendar
                    days={days}
                    loading={daysLoading}
                    month={month}
                    onMonthChange={setMonth}
                    startMonth={toDate(`${firstMonth}-01`)}
                    endMonth={toDate(`${lastMonth}-01`)}
                    selected={date ? toDate(date) : undefined}
                    onSelect={(d) => {
                      setTime(undefined);
                      setDate(d ? format(d, "yyyy-MM-dd") : null);
                    }}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1" aria-live="polite">
                {!date && noneThisMonth ? (
                  <Alert
                    tone="warning"
                    title={`No quedan fechas en ${format(month, "MMMM", { locale: es })}`}
                    action={
                      canGoNext && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1, 12))}
                        >
                          Ver el mes siguiente
                          <ArrowRight aria-hidden className="size-4" />
                        </Button>
                      )
                    }
                  >
                    {guests > 1 ? "Prueba otro mes o cambia el número de invitados." : "Prueba otro mes."}
                  </Alert>
                ) : !date ? (
                  <p className="rounded-md bg-surface-muted p-4 text-sm text-text-muted">
                    Elige un día en el calendario para ver los horarios. Agendamos con al menos {business.minNoticeDays} días de
                    anticipación.
                  </p>
                ) : slotsError ? (
                  <Alert
                    tone="danger"
                    title="No pudimos cargar los horarios"
                    action={
                      <Button size="sm" variant="secondary" onClick={() => loadDay(date, guests)}>
                        Reintentar
                      </Button>
                    }
                  >
                    Revisa tu conexión.
                  </Alert>
                ) : slots === null ? (
                  <p className="p-4 text-sm text-text-muted">Buscando horarios…</p>
                ) : (
                  <TimeSlots slots={slots} value={time} onChange={setTime} legend={`Hora de inicio · ${format(toDate(date), "d 'de' MMMM", { locale: es })}`} />
                )}
              </div>
            </div>
            <div className="flex justify-end">
              <Button size="lg" disabled={!date || !time} onClick={() => goTo(1)}>
                Continuar
                <ArrowRight aria-hidden className="size-5" />
              </Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <form
            noValidate
            className="flex flex-col gap-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (validateDetails()) {
                setDetailsOk(true);
                goTo(2);
              }
            }}
          >
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-2 text-sm font-semibold text-text">Paquete</legend>
              <div className="grid gap-3 md:grid-cols-2">
                {packages.map((p) => (
                  <PackageCard
                    key={p.id}
                    pkg={{ ...p, isActive: fits(p) }}
                    variant="compact"
                    selectable={{ name: "paquete", checked: packageId === p.id, onChange: () => setPackageId(p.id) }}
                  />
                ))}
              </div>
              {packages.every((p) => !fits(p)) && (
                <Alert tone="warning">Ningún paquete es para {guests} invitados. Cambia el número en el paso anterior.</Alert>
              )}
              {errors.packageId && <p className="text-sm font-medium text-danger">{errors.packageId}</p>}
            </fieldset>

            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Tu nombre" required autoComplete="name" value={form.name} onChange={set("name")} error={errors.name} />
              <PhoneField
                label="WhatsApp"
                required
                value={form.whatsapp}
                onChange={set("whatsapp")}
                error={errors.whatsapp}
                hint="Ahí te confirmamos."
                placeholder="753 123 4567"
              />
              <TextField
                label="Correo"
                optional
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={set("email")}
                error={errors.email}
              />
              <SelectField
                label="Tipo de evento"
                optional
                value={form.eventType}
                onChange={set("eventType")}
                placeholder="Elige uno"
                options={EVENT_TYPES.map((t) => ({ value: t, label: t }))}
              />
            </div>

            <fieldset className="grid gap-4 md:grid-cols-2">
              <legend className="mb-2 text-sm font-semibold text-text">¿Dónde es el evento?</legend>
              {zones.length > 0 && (
                <SelectField
                  label="Zona"
                  required
                  value={form.zoneId}
                  onChange={set("zoneId")}
                  error={errors.zoneId}
                  placeholder="Elige la zona"
                  options={zones.map((z) => ({
                    value: z.id,
                    label: `${z.name}${z.travelFeeCents > 0 ? ` (traslado $${z.travelFeeCents / 100})` : ""}`,
                  }))}
                />
              )}
              <TextField
                label="Calle y número"
                required
                autoComplete="street-address"
                value={form.address}
                onChange={set("address")}
                error={errors.address}
              />
              <TextField label="Colonia" required value={form.neighborhood} onChange={set("neighborhood")} error={errors.neighborhood} />
              <TextField
                label="Referencias"
                optional
                value={form.addressNotes}
                onChange={set("addressNotes")}
                hint="Entre calles, color de la casa, dónde estacionarse."
              />
            </fieldset>

            <TextareaField
              label="Notas"
              optional
              value={form.customerNotes}
              onChange={set("customerNotes")}
              hint="Alergias, horario de acceso o lo que debamos saber."
            />

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <Button variant="ghost" onClick={() => history.back()}>
                <ArrowLeft aria-hidden className="size-5" />
                Atrás
              </Button>
              <Button type="submit" size="lg">
                Continuar
                <ArrowRight aria-hidden className="size-5" />
              </Button>
            </div>
          </form>
        )}

        {step === 2 && pkg && (
          <div className="flex flex-col gap-6">
            <PriceSummary
              packageName={pkg.name}
              guests={guests}
              pricePerGuestCents={pkg.pricePerGuestCents}
              travelFeeCents={zone?.travelFeeCents ?? 0}
              depositCents={depositCents}
              estimated
            />
            {depositCents > 0 && (
              <PaymentChoice
                value={payMode}
                onChange={setPayMode}
                depositCents={depositCents}
                depositMode={business.depositMode === "required" ? "required" : "optional"}
                holdMinutes={business.paymentHoldMinutes}
              />
            )}
            {(depositCents === 0 || payMode === "later") && (
              <p className="text-sm text-text-muted">
                {business.confirmationMode === "auto"
                  ? "Tu taquiza queda confirmada al enviar."
                  : `Apartamos tu fecha ${business.requestHoldHours} horas mientras te confirmamos por WhatsApp.`}
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="flex min-h-11 cursor-pointer items-start gap-3 text-base text-text">
                <input
                  type="checkbox"
                  checked={accept}
                  onChange={(e) => {
                    setAccept(e.target.checked);
                    setErrors((x) => ({ ...x, acceptPolicies: "" }));
                  }}
                  aria-invalid={errors.acceptPolicies ? true : undefined}
                  aria-describedby={errors.acceptPolicies ? "accept-error" : undefined}
                  className="mt-1 size-5 shrink-0 accent-accent-text"
                />
                <span>
                  Leí las{" "}
                  <a href="/politicas" target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-text underline underline-offset-4">
                    políticas de anticipo y cancelación<span className="sr-only"> (se abre en otra pestaña)</span>
                  </a>{" "}
                  y el aviso de privacidad.
                </span>
              </label>
              {errors.acceptPolicies && (
                <p id="accept-error" className="text-sm font-medium text-danger">
                  {errors.acceptPolicies}
                </p>
              )}
            </div>
            <Turnstile onToken={setTurnstileToken} />
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <Button variant="ghost" onClick={() => history.back()} disabled={submitting}>
                <ArrowLeft aria-hidden className="size-5" />
                Atrás
              </Button>
              <Button size="lg" loading={submitting} onClick={submit}>
                {depositCents > 0 && payMode === "now" ? "Ir a pagar el anticipo" : "Enviar solicitud"}
              </Button>
            </div>
          </div>
        )}
      </div>

      <aside aria-label="Tu taquiza" className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 lg:sticky lg:top-24 lg:w-80">
        <h2 className="font-display text-lg text-text">Tu taquiza</h2>
        <dl className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-text-muted">Invitados</dt>
            <dd className="font-semibold text-text">{guests}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-text-muted">Cuándo</dt>
            <dd className="text-right font-semibold text-text first-letter:uppercase">{when ?? "Por elegir"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-text-muted">Paquete</dt>
            <dd className="text-right font-semibold text-text">{step > 0 && pkg ? pkg.name : "Por elegir"}</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}
