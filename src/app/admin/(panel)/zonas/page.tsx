import { requireAdminPage } from "@/server/auth";
import { store } from "@/server/data";
import { ZonesManager } from "./ZonesClient";

export const metadata = { title: "Zonas de cobertura" };

export default async function ZonesPage() {
  await requireAdminPage("owner");
  const db = store();
  const business = await db.getBusiness();
  const zones = await db.listZones(business.id);
  return (
    <div className="mx-auto flex max-w-flow flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl text-text">Zonas de cobertura</h1>
        <p className="text-sm text-text-muted">El cliente elige su zona al agendar y el cargo por traslado se suma al total.</p>
      </div>
      <ZonesManager zones={zones.map((z) => ({ id: z.id, name: z.name, fee: String(z.travelFeeCents / 100), isActive: z.isActive }))} />
    </div>
  );
}
