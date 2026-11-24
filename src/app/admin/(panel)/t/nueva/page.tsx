import { store } from "@/server/data";
import { ManualBookingForm } from "./ManualBookingForm";

export const metadata = { title: "Nueva taquiza" };

export default async function NewBookingPage() {
  const db = store();
  const business = await db.getBusiness();
  const [packages, zones] = await Promise.all([db.listPackages(business.id), db.listZones(business.id)]);
  return (
    <div className="mx-auto flex max-w-flow flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl text-text">Nueva taquiza</h1>
        <p className="text-sm text-text-muted">Para pedidos que llegan por teléfono, Facebook o en persona.</p>
      </div>
      <ManualBookingForm
        packages={packages.map((p) => ({ id: p.id, name: p.name, isActive: p.isActive, minGuests: p.minGuests }))}
        zones={zones.map((z) => ({ id: z.id, name: z.name }))}
      />
    </div>
  );
}
