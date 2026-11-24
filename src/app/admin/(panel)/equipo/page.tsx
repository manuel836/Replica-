import { ShieldCheck, UserRound } from "lucide-react";
import { requireAdminPage } from "@/server/auth";
import { listTeam } from "@/server/services/team";
import { AddHelperForm, RemoveHelperButton } from "./TeamClient";

export const metadata = { title: "Equipo" };

const ROLE = { owner: "Dueño", helper: "Ayudante" } as const;

export default async function TeamPage() {
  const admin = await requireAdminPage("owner");
  const team = await listTeam(admin.businessId);
  const helpers = team.filter((a) => a.role === "helper");

  return (
    <div className="mx-auto flex max-w-flow flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl text-text">Equipo</h1>
        <p className="text-sm text-text-muted">
          Un ayudante entra con su propio correo. Puede ver la agenda, responder solicitudes y registrar taquizas y pagos. No
          puede cambiar horarios, paquetes, zonas ni ajustes, ni cancelar, reembolsar o publicar reseñas.
        </p>
      </div>

      <section aria-labelledby="con-acceso" className="flex flex-col gap-3">
        <h2 id="con-acceso" className="text-lg text-text">
          Con acceso
        </h2>
        <ul className="flex flex-col gap-2">
          {team.map((a) => (
            <li key={a.id} className="flex min-h-14 flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface px-4 py-2">
              <span className="flex min-w-0 items-center gap-3">
                {a.role === "owner" ? (
                  <ShieldCheck aria-hidden className="size-5 shrink-0 text-accent-text" />
                ) : (
                  <UserRound aria-hidden className="size-5 shrink-0 text-text-muted" />
                )}
                <span className="min-w-0">
                  <span className="block break-all font-semibold text-text">{a.email}</span>
                  <span className="text-sm text-text-muted">
                    {ROLE[a.role]}
                    {a.id === admin.id ? " · tú" : ""}
                  </span>
                </span>
              </span>
              {a.role === "helper" && <RemoveHelperButton id={a.id} email={a.email} />}
            </li>
          ))}
        </ul>
        {helpers.length === 0 && <p className="text-sm text-text-muted">Todavía no agregas ayudantes.</p>}
      </section>

      <section aria-labelledby="agregar" className="flex flex-col gap-3">
        <h2 id="agregar" className="text-lg text-text">
          Agregar un ayudante
        </h2>
        <AddHelperForm />
      </section>
    </div>
  );
}
