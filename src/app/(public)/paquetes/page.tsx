import { Package as PackageIcon } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { PackageCard } from "@/components/ui/PackageCard";
import { store } from "@/server/data";

export const metadata = { title: "Paquetes" };

export default async function PackagesPage() {
  const db = store();
  const business = await db.getBusiness();
  const packages = (await db.listPackages(business.id)).filter((p) => p.isActive);

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-6 px-4 py-8">
      <div className="flex max-w-flow flex-col gap-2">
        <h1 className="text-xl text-text md:text-display">Paquetes</h1>
        <p className="text-lg font-normal text-text-muted">
          Precio por persona. El total depende de tus invitados y la zona; lo ves antes de confirmar.
        </p>
      </div>
      {packages.length === 0 ? (
        <EmptyState as="h2" icon={PackageIcon} title="Estamos preparando nuestros paquetes" action={<ButtonLink href="/">Volver al inicio</ButtonLink>}>
          Vuelve pronto.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {packages.map((p) => (
            <li key={p.id} className="flex flex-col gap-3">
              <PackageCard pkg={{ ...p, photoUrl: p.photoPath }} headingLevel="h2" />
              <ButtonLink href={`/agendar?invitados=${Math.max(p.minGuests, 1)}`} variant="secondary" aria-label={`Agendar con ${p.name}`}>
                Agendar con este paquete
              </ButtonLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
