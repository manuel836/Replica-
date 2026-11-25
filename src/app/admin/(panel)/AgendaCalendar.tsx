import { Ban, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { StatusMark, statusLabel } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/cn";
import type { BookingStatus } from "@/lib/types";
import { formatDateLong, formatDateShort, formatMonth, formatWeekRange, localTime } from "@/server/domain/time";
import type { CalendarDay, CalendarView } from "@/server/services/views";

// Vistas de semana y mes de la agenda (S11). Sin JavaScript en el navegador: cada flecha es un
// enlace, así que funcionan con teclado, con lector de pantalla y con la red lenta.

const href = (view: CalendarView, date: string) => `/admin?vista=${view}&fecha=${date}`;
const plural = (n: number) => `${n} ${n === 1 ? "taquiza" : "taquizas"}`;
const firstName = (name: string) => name.split(/\s+/)[0] ?? name;

interface Props {
  view: CalendarView;
  timezone: string;
  first: string;
  last: string;
  prev: string;
  next: string;
  current: string;
  total: number;
  days: CalendarDay[];
}

export function AgendaCalendar(p: Props) {
  const title = p.view === "semana" ? formatWeekRange(p.first, p.last) : formatMonth(p.first.slice(0, 7));
  const unit = p.view === "semana" ? "semana" : "mes";
  return (
    <section aria-labelledby="periodo" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="periodo" className="text-lg text-text first-letter:uppercase">
            {title}
          </h2>
          <p className="text-sm text-text-muted" aria-live="polite">
            {p.total === 0 ? `Sin taquizas este ${unit}` : `${plural(p.total)} este ${unit}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ButtonLink size="sm" variant="secondary" href={href(p.view, p.prev)} aria-label={p.view === "semana" ? "Semana anterior" : "Mes anterior"}>
            <ChevronLeft aria-hidden className="size-4" />
          </ButtonLink>
          {p.first !== p.current && (
            <ButtonLink size="sm" variant="secondary" href={href(p.view, p.current)}>
              {p.view === "semana" ? "Esta semana" : "Este mes"}
            </ButtonLink>
          )}
          <ButtonLink size="sm" variant="secondary" href={href(p.view, p.next)} aria-label={p.view === "semana" ? "Semana siguiente" : "Mes siguiente"}>
            <ChevronRight aria-hidden className="size-4" />
          </ButtonLink>
        </div>
      </div>

      {p.view === "semana" ? <Week days={p.days} timezone={p.timezone} /> : <Month days={p.days} timezone={p.timezone} title={title} />}
      <Legend days={p.days} />
    </section>
  );
}

function DayNote({ day }: { day: CalendarDay }) {
  if (day.blocked !== null)
    return (
      <p className="flex items-center gap-1 text-xs font-semibold text-danger">
        <Lock aria-hidden className="size-3.5 shrink-0" />
        <span className="min-w-0 break-words">Bloqueado{day.blocked ? `: ${day.blocked}` : ""}</span>
      </p>
    );
  if (day.closed)
    return (
      <p className="flex items-center gap-1 text-xs text-text-muted">
        <Ban aria-hidden className="size-3.5 shrink-0" />
        Cerrado
      </p>
    );
  if (day.isPast || day.maxBookings === 0 || day.rows.length === 0) return null;
  const full = day.rows.length >= day.maxBookings;
  return (
    <p className={cn("text-xs", full ? "font-semibold text-warning" : "text-text-muted")}>
      {full ? "Lleno · " : ""}
      {day.rows.length} de {day.maxBookings}
      <span className="sr-only"> lugares ocupados</span>
    </p>
  );
}

function Week({ days, timezone }: { days: CalendarDay[]; timezone: string }) {
  return (
    <ol className="grid gap-3 lg:grid-cols-7 lg:gap-2">
      {days.map((d) => (
        <li
          key={d.date}
          aria-current={d.isToday ? "date" : undefined}
          className={cn(
            "flex min-w-0 flex-col gap-2 rounded-lg border p-3 lg:min-h-48 lg:p-2",
            d.isToday ? "border-accent ring-2 ring-accent" : "border-border",
            d.isPast || d.closed || d.blocked !== null ? "bg-surface-muted" : "bg-surface",
          )}
        >
          <h3 className="flex items-center justify-between gap-2 text-sm font-semibold text-text">
            <span aria-hidden className="hidden first-letter:uppercase lg:inline">
              {formatDateShort(d.date).replace(/ \S+$/, "")}
            </span>
            <span className="first-letter:uppercase lg:sr-only">{formatDateLong(d.date)}</span>
            {d.isToday && <span className="rounded-pill bg-accent px-2 py-0.5 text-xs text-on-accent">Hoy</span>}
          </h3>
          <DayNote day={d} />
          {d.rows.length === 0 ? (
            <p className="text-xs text-text-muted">Sin taquizas</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {d.rows.map(({ booking, customer }) => (
                <li key={booking.id}>
                  <a
                    href={`/admin/t/${booking.id}`}
                    className={cn(
                      "flex flex-col gap-0.5 rounded-md border border-border bg-surface p-2 text-xs text-text hover:border-border-input",
                      (booking.status === "requested" || booking.status === "awaiting_payment") && "border-l-4 border-l-accent",
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <StatusMark status={booking.status} />
                      <strong>{localTime(booking.startAt, timezone)}</strong>
                      <span className="text-text-muted lg:sr-only">· {booking.code}</span>
                    </span>
                    <span className="truncate font-semibold">{customer?.name ?? "Cliente"}</span>
                    <span className="text-text-muted">{booking.guests} invitados</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}

const WEEKDAYS = [
  ["lun", "lunes"],
  ["mar", "martes"],
  ["mié", "miércoles"],
  ["jue", "jueves"],
  ["vie", "viernes"],
  ["sáb", "sábado"],
  ["dom", "domingo"],
];
const SHOWN = 3;

function Month({ days, timezone, title }: { days: CalendarDay[]; timezone: string; title: string }) {
  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return (
    <table className="w-full table-fixed border-collapse">
      <caption className="sr-only">Taquizas de {title}</caption>
      <thead>
        <tr>
          {WEEKDAYS.map(([short, long]) => (
            <th key={long} scope="col" className="pb-2 text-xs font-semibold text-text-muted">
              <span aria-hidden>{short}</span>
              <span className="sr-only">{long}</span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((w) => (
          <tr key={w[0].date}>
            {w.map((d) => {
              const quiet = !d.inRange || d.isPast || d.closed || d.blocked !== null;
              const note = d.blocked !== null ? ", bloqueado" : d.closed ? ", cerrado" : "";
              return (
                <td
                  key={d.date}
                  aria-current={d.isToday ? "date" : undefined}
                  className={cn(
                    "relative h-16 border border-border p-1 align-top sm:h-32",
                    quiet ? "bg-surface-muted" : "bg-surface",
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <a
                      href={href("semana", d.date)}
                      className={cn(
                        "inline-flex size-7 items-center justify-center rounded-pill text-xs font-semibold",
                        "max-sm:after:absolute max-sm:after:inset-0",
                        d.isToday ? "bg-accent text-on-accent" : d.inRange ? "text-text hover:bg-surface-muted" : "text-text-muted",
                      )}
                    >
                      <span aria-hidden>{Number(d.date.slice(8))}</span>
                      <span className="sr-only">
                        {formatDateLong(d.date)}
                        {d.isToday ? ", hoy" : ""}
                        {note}: {plural(d.rows.length)}. Ver la semana
                      </span>
                    </a>
                    {d.blocked !== null ? (
                      <Lock aria-hidden className="size-3.5 text-danger" />
                    ) : d.closed ? (
                      <Ban aria-hidden className="size-3.5 text-text-muted" />
                    ) : null}
                  </div>
                  {d.rows.length > 0 && (
                    <>
                      <span aria-hidden className="mt-1 inline-flex rounded-pill bg-accent px-1.5 text-xs font-semibold text-on-accent sm:hidden">
                        {d.rows.length}
                      </span>
                      <ul className="mt-1 hidden flex-col gap-1 sm:flex">
                        {d.rows.slice(0, SHOWN).map(({ booking, customer }) => (
                          <li key={booking.id} className="min-w-0">
                            <a
                              href={`/admin/t/${booking.id}`}
                              className="flex min-w-0 items-center gap-1 rounded-sm px-0.5 text-xs text-text hover:bg-surface-muted"
                            >
                              <StatusMark status={booking.status} />
                              <span className="truncate">
                                <strong>{localTime(booking.startAt, timezone)}</strong> {firstName(customer?.name ?? "Cliente")}
                              </span>
                            </a>
                          </li>
                        ))}
                        {d.rows.length > SHOWN && (
                          <li>
                            <a href={href("semana", d.date)} className="px-0.5 text-xs font-semibold text-accent-text hover:underline">
                              +{d.rows.length - SHOWN} más
                              <span className="sr-only"> el {formatDateLong(d.date)}</span>
                            </a>
                          </li>
                        )}
                      </ul>
                    </>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Legend({ days }: { days: CalendarDay[] }) {
  const shown = [...new Set(days.flatMap((d) => d.rows.map((r) => r.booking.status)))] as BookingStatus[];
  return (
    <div className="flex flex-col gap-2 text-xs text-text-muted">
      {shown.length > 0 && (
        <ul aria-label="Qué significa cada ícono" className="flex flex-wrap gap-x-4 gap-y-1">
          {shown.map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <StatusMark status={s} />
              <span aria-hidden>{statusLabel(s)}</span>
            </li>
          ))}
        </ul>
      )}
      <p>
        Las canceladas, rechazadas y vencidas no ocupan lugar y no salen aquí; están en la vista Lista, en
        &quot;Canceladas&quot;.
      </p>
    </div>
  );
}
