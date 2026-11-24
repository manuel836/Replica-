import { requireAdminPage } from "@/server/auth";
import { store } from "@/server/data";
import { todayLocal } from "@/server/domain/time";
import { AvailabilityForm, BlockedDates } from "./AvailabilityClient";

export const metadata = { title: "Disponibilidad" };

export default async function AvailabilityPage() {
  await requireAdminPage("owner");
  const db = store();
  const business = await db.getBusiness();
  const [rules, blocked] = await Promise.all([db.listRules(business.id), db.listBlockedDates(business.id)]);
  const today = todayLocal(business.timezone);
  const base = rules[0];

  return (
    <div className="mx-auto flex max-w-flow flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl text-text">Disponibilidad</h1>
        <p className="text-sm text-text-muted">Cuándo trabajas y cuántas taquizas puedes atender. El calendario de tus clientes se arma con esto.</p>
      </div>
      <AvailabilityForm
        initial={{
          days: Array.from({ length: 7 }, (_, weekday) => {
            const r = rules.find((x) => x.weekday === weekday);
            return { weekday, isOpen: r?.isOpen ?? false, firstStart: r?.firstStart ?? "12:00", lastStart: r?.lastStart ?? "20:00" };
          }),
          slotIntervalMin: String(base?.slotIntervalMin ?? 30),
          eventDurationHours: String((base?.eventDurationMin ?? 240) / 60),
          travelBufferMin: String(base?.travelBufferMin ?? 60),
          maxBookingsPerDay: String(base?.maxBookingsPerDay ?? 2),
          maxGuestsPerDay: base?.maxGuestsPerDay ? String(base.maxGuestsPerDay) : "",
          minNoticeDays: String(business.minNoticeDays),
          maxAdvanceDays: String(business.maxAdvanceDays),
          teams: String(business.teams),
        }}
      />
      <BlockedDates dates={blocked.filter((b) => b.date >= today).map((b) => ({ date: b.date, reason: b.reason }))} today={today} />
    </div>
  );
}
