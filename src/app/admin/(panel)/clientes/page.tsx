import { Search, Users } from "lucide-react";
import { BookingCard } from "@/components/ui/BookingCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { cn } from "@/lib/cn";
import { requireAdminPage } from "@/server/auth";
import { store } from "@/server/data";
import { formatDateShort, localTime, todayLocal } from "@/server/domain/time";
import { CustomerTools } from "./CustomerTools";

export const metadata = { title: "Clientes" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; c?: string }> }) {
  const admin = await requireAdminPage();
  const { q = "", c } = await searchParams;
  const db = store();
  const business = await db.getBusiness();
  const rows = await db.listCustomers(business.id, q);
  const selected = c ? await db.getCustomer(business.id, c) : null;
  const history = selected ? (await db.listBookings(business.id, { customerId: selected.id })).reverse() : [];
  const packages = await db.listPackages(business.id);
  const today = todayLocal(business.timezone);

  return (
    <div className="mx-auto flex max-w-content flex-col gap-6">
      <h1 className="text-xl text-text">Clientes</h1>
      <form role="search" className="flex max-w-flow gap-2" action="/admin/clientes">
        <label htmlFor="q" className="sr-only">
          Buscar por nombre o WhatsApp
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Nombre o WhatsApp"
          className="h-11 flex-1 rounded-md border border-border-input bg-surface px-3 text-base text-text placeholder:text-text-muted"
        />
        <Button type="submit" variant="secondary">
          <Search aria-hidden className="size-4" />
          Buscar
        </Button>
      </form>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {rows.length === 0 ? (
          <EmptyState icon={Users} title={q ? "Nadie con esa búsqueda" : "Todavía no hay clientes"}>
            {q ? "Prueba con otra parte del nombre o del número." : "Aparecerán cuando alguien agende."}
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Clientes">
            {rows.map((r) => (
              <li key={r.id}>
                <a
                  href={`/admin/clientes?${new URLSearchParams({ ...(q ? { q } : {}), c: r.id })}`}
                  aria-current={r.id === c ? "true" : undefined}
                  className={cn(
                    "flex min-h-14 flex-wrap items-center justify-between gap-2 rounded-md border bg-surface px-4 py-2",
                    r.id === c ? "border-accent ring-2 ring-accent" : "border-border hover:border-border-input",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-text">{r.name}</span>
                    <span className="text-sm text-text-muted">{r.whatsappE164 ?? "sin teléfono"}</span>
                  </span>
                  <span className="text-sm text-text-muted">
                    {r.bookingCount} {r.bookingCount === 1 ? "taquiza" : "taquizas"}
                    {r.lastEventDate && ` · ${formatDateShort(r.lastEventDate)}`}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}

        {selected && (
          <section aria-labelledby="cliente-sel" className="flex flex-col gap-4">
            <h2 id="cliente-sel" className="text-lg text-text">
              {selected.name}
            </h2>
            <CustomerTools id={selected.id} notes={selected.notes} canAnonymize={admin.role === "owner" && !selected.anonymizedAt} />
            <div className="flex flex-col gap-3">
              {history.map((b) => (
                <BookingCard
                  key={b.id}
                  href={`/admin/t/${b.id}`}
                  booking={{
                    id: b.id,
                    code: b.code,
                    customerName: selected.name,
                    when: `${formatDateShort(b.eventDate)} · ${localTime(b.startAt, business.timezone)}`,
                    guests: b.guests,
                    packageName: packages.find((p) => p.id === b.packageId)?.name ?? "",
                    status: b.status,
                    past: b.eventDate < today,
                  }}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
