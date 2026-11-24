import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, BarChart3, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { cn } from "@/lib/cn";
import { formatMXN } from "@/lib/format";
import { requireAdminPage } from "@/server/auth";
import { store } from "@/server/data";
import { addMonthsLocal, formatMonth, todayLocal } from "@/server/domain/time";
import { monthReport } from "@/server/services/reports";

export const metadata = { title: "Reportes" };

/** Cambio contra el mes anterior: flecha y signo, nunca solo color. */
function Delta({ now, before, money, label }: { now: number; before: number; money?: boolean; label: string }) {
  const diff = now - before;
  if (diff === 0 || before === 0) return <p className="text-xs text-text-muted">{before === 0 ? `Sin datos en ${label}` : `Igual que en ${label}`}</p>;
  const up = diff > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const value = money ? formatMXN(Math.abs(diff)) : String(Math.abs(diff));
  return (
    <p className={cn("flex items-center gap-1 text-xs font-semibold", up ? "text-success" : "text-danger")}>
      <Icon aria-hidden className="size-3.5" />
      {up ? "+" : "−"}
      {value}
      <span className="font-normal text-text-muted"> vs {label}</span>
    </p>
  );
}

function Tile({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="text-xl font-semibold text-text">{value}</dd>
      {children && <dd>{children}</dd>}
    </div>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  await requireAdminPage("owner");
  const { mes } = await searchParams;
  const business = await store().getBusiness();
  const current = todayLocal(business.timezone).slice(0, 7);
  const month = mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : current;
  const r = await monthReport(month);
  const prevMonth = addMonthsLocal(`${month}-01`, -1).slice(0, 7);
  const nextMonth = addMonthsLocal(`${month}-01`, 1).slice(0, 7);
  const prevLabel = formatMonth(prevMonth).replace(/ de \d{4}$/, "");
  const t = r.totals;
  const empty = t.sold === 0 && r.pending === 0 && r.cancelled === 0 && r.noShow === 0;

  return (
    <div className="mx-auto flex max-w-content flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl text-text">Reportes</h1>
        <div className="flex flex-wrap gap-2">
          <ButtonLink size="sm" variant="secondary" href={`/admin/reportes/csv?mes=${month}`} download>
            <Download aria-hidden className="size-4" />
            CSV del mes
          </ButtonLink>
          <ButtonLink size="sm" variant="ghost" href="/admin/reportes/csv?mes=todas" download>
            <Download aria-hidden className="size-4" />
            CSV de todas
          </ButtonLink>
        </div>
      </div>

      <section aria-labelledby="mes" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="mes" className="text-lg text-text first-letter:uppercase">
              {formatMonth(month)}
            </h2>
            <p className="text-sm text-text-muted">Por fecha del evento. Cuentan las taquizas confirmadas y las completadas.</p>
          </div>
          <div className="flex items-center gap-2">
            <ButtonLink size="sm" variant="secondary" href={`/admin/reportes?mes=${prevMonth}`} aria-label="Mes anterior">
              <ChevronLeft aria-hidden className="size-4" />
            </ButtonLink>
            {month !== current && (
              <ButtonLink size="sm" variant="secondary" href="/admin/reportes">
                Este mes
              </ButtonLink>
            )}
            <ButtonLink size="sm" variant="secondary" href={`/admin/reportes?mes=${nextMonth}`} aria-label="Mes siguiente">
              <ChevronRight aria-hidden className="size-4" />
            </ButtonLink>
          </div>
        </div>

        {empty ? (
          <EmptyState as="h3" icon={BarChart3} title="Sin taquizas este mes">
            Cuando haya taquizas confirmadas en este mes, aquí verás cuánto vendiste y cuánto falta por cobrar.
          </EmptyState>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <Tile label="Taquizas" value={String(t.sold)}>
                <Delta now={t.sold} before={r.previous.sold} label={prevLabel} />
              </Tile>
              <Tile label="Vendido" value={formatMXN(t.soldCents)}>
                <Delta now={t.soldCents} before={r.previous.soldCents} money label={prevLabel} />
              </Tile>
              <Tile label="Invitados" value={t.guests.toLocaleString("es-MX")} />
              <Tile label="Cobrado" value={formatMXN(t.paidCents)} />
              <Tile label="Por cobrar" value={formatMXN(t.dueCents)} />
              <Tile label="Promedio por taquiza" value={t.sold ? formatMXN(Math.round(t.soldCents / t.sold / 100) * 100) : "—"} />
            </dl>

            <div className="grid gap-6 lg:grid-cols-2">
              <section aria-labelledby="paquetes" className="flex flex-col gap-3">
                <h3 id="paquetes" className="text-base font-semibold text-text">
                  Por paquete
                </h3>
                {r.byPackage.length === 0 ? (
                  <p className="text-sm text-text-muted">Todavía no hay taquizas confirmadas este mes.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border bg-surface">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-text-muted">
                          <th scope="col" className="px-3 py-2 font-semibold">Paquete</th>
                          <th scope="col" className="px-3 py-2 text-right font-semibold">Taquizas</th>
                          <th scope="col" className="px-3 py-2 text-right font-semibold">Invitados</th>
                          <th scope="col" className="px-3 py-2 text-right font-semibold">Vendido</th>
                        </tr>
                      </thead>
                      <tbody className="tabular-nums">
                        {r.byPackage.map((p) => (
                          <tr key={p.name} className="border-b border-border last:border-0">
                            <th scope="row" className="px-3 py-2 text-left font-normal text-text">{p.name}</th>
                            <td className="px-3 py-2 text-right text-text">{p.count}</td>
                            <td className="px-3 py-2 text-right text-text">{p.guests}</td>
                            <td className="px-3 py-2 text-right text-text">{formatMXN(p.cents)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section aria-labelledby="detalle" className="flex flex-col gap-3">
                <h3 id="detalle" className="text-base font-semibold text-text">
                  Detalle del mes
                </h3>
                <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface text-sm">
                  {[
                    ["Completadas", r.completed],
                    ["Confirmadas por realizar", r.upcoming],
                    ["Agendadas en línea", r.online],
                    ["Registradas a mano", r.manual],
                    ["Solicitudes sin cerrar", r.pending],
                    ["No se realizaron", r.noShow],
                    ["Canceladas, rechazadas o vencidas", r.cancelled],
                  ].map(([label, n]) => (
                    <li key={label} className="flex justify-between gap-3 px-3 py-2">
                      <span className="text-text">{label}</span>
                      <span className="font-semibold tabular-nums text-text">{n}</span>
                    </li>
                  ))}
                  <li className="flex justify-between gap-3 px-3 py-2">
                    <span className="text-text">Reembolsado</span>
                    <span className="font-semibold tabular-nums text-text">{formatMXN(r.refundedCents)}</span>
                  </li>
                </ul>
              </section>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
