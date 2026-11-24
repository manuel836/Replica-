import { LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cerrarSesion, cerrarSesionEnTodos } from "@/server/actions/admin";
import { requireAdminPage } from "@/server/auth";

export const metadata = { title: "Mi cuenta" };

const ROLE = { owner: "Dueño", helper: "Ayudante" } as const;

// Para todas las personas del panel (dueño y ayudantes).
export default async function AccountPage() {
  const admin = await requireAdminPage();
  return (
    <div className="mx-auto flex max-w-flow flex-col gap-6">
      <h1 className="text-xl text-text">Mi cuenta</h1>
      <dl className="grid gap-3 rounded-lg border border-border bg-surface p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-text-muted">Correo</dt>
          <dd className="break-all text-text">{admin.email}</dd>
        </div>
        <div>
          <dt className="text-text-muted">Rol</dt>
          <dd className="text-text">{ROLE[admin.role]}</dd>
        </div>
      </dl>
      <section aria-labelledby="seguridad" className="flex flex-col gap-3">
        <h2 id="seguridad" className="flex items-center gap-2 text-lg text-text">
          <ShieldCheck aria-hidden className="size-5 text-text-muted" />
          Seguridad
        </h2>
        <p className="text-sm text-text-muted">
          Si perdiste tu celular o entraste en una computadora ajena, cierra la sesión en todos tus dispositivos. Para volver a
          entrar te mandamos un enlace a tu correo.
        </p>
        <div className="flex flex-wrap gap-2">
          <form action={cerrarSesionEnTodos}>
            <Button type="submit" variant="secondary">
              <LogOut aria-hidden className="size-4" />
              Cerrar sesión en todos lados
            </Button>
          </form>
          <form action={cerrarSesion}>
            <Button type="submit" variant="ghost">
              Salir solo aquí
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
