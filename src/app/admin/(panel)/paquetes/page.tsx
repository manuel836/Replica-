import { requireAdminPage } from "@/server/auth";
import { store } from "@/server/data";
import { PackagesManager } from "./PackagesClient";

export const metadata = { title: "Paquetes" };

export default async function AdminPackagesPage() {
  await requireAdminPage("owner");
  const db = store();
  const business = await db.getBusiness();
  const packages = await db.listPackages(business.id);
  return (
    <div className="mx-auto flex max-w-flow flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl text-text">Paquetes</h1>
        <p className="text-sm text-text-muted">
          Cambiar un precio no afecta las taquizas ya agendadas: cada una guarda el precio con que se pidió.
        </p>
      </div>
      <PackagesManager
        packages={packages.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price: String(p.pricePerGuestCents / 100),
          minGuests: String(p.minGuests),
          maxGuests: p.maxGuests ? String(p.maxGuests) : "",
          includes: p.includes.join("\n"),
          isActive: p.isActive,
          pricePerGuestCents: p.pricePerGuestCents,
        }))}
      />
    </div>
  );
}
