import { store } from "@/server/data";
import { addDaysLocal, todayLocal } from "@/server/domain/time";
import { BookingFlow } from "./BookingFlow";

export const metadata = { title: "Agenda tu taquiza" };

export default async function AgendarPage({ searchParams }: { searchParams: Promise<{ invitados?: string }> }) {
  const db = store();
  const business = await db.getBusiness();
  const [packages, zones] = await Promise.all([db.listPackages(business.id), db.listZones(business.id)]);
  const active = packages.filter((p) => p.isActive);
  const { invitados } = await searchParams;
  const minGuests = active.length ? Math.min(...active.map((p) => p.minGuests)) : 1;
  const parsed = Number(invitados);
  const initialGuests = Number.isInteger(parsed) && parsed >= 1 && parsed <= 2000 ? parsed : Math.max(minGuests, 50);
  const today = todayLocal(business.timezone);

  return (
    <div className="mx-auto w-full max-w-content px-4 py-8">
      <h1 className="mb-6 text-xl text-text md:text-display">Agenda tu taquiza</h1>
      <BookingFlow
        business={{
          name: business.name,
          whatsappE164: business.whatsappE164,
          depositMode: business.depositMode,
          depositType: business.depositType,
          depositValue: business.depositValue,
          paymentHoldMinutes: business.paymentHoldMinutes,
          requestHoldHours: business.requestHoldHours,
          confirmationMode: business.confirmationMode,
          minNoticeDays: business.minNoticeDays,
        }}
        packages={active.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          pricePerGuestCents: p.pricePerGuestCents,
          minGuests: p.minGuests,
          maxGuests: p.maxGuests,
          includes: p.includes,
          photoUrl: p.photoPath,
        }))}
        zones={zones.filter((z) => z.isActive).map((z) => ({ id: z.id, name: z.name, travelFeeCents: z.travelFeeCents }))}
        initialGuests={initialGuests}
        today={today}
        firstMonth={addDaysLocal(today, business.minNoticeDays).slice(0, 7)}
        lastMonth={addDaysLocal(today, business.maxAdvanceDays).slice(0, 7)}
      />
    </div>
  );
}
