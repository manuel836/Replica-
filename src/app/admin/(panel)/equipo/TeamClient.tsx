"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserMinus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import { safe } from "@/lib/safe-action";
import { agregarAyudante, quitarAyudante } from "@/server/actions/settings";

export function AddHelperForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      noValidate
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const r = await safe(agregarAyudante)(email);
        setBusy(false);
        if (!r.ok) return setError(r.error);
        toast.success(`Listo: le mandamos a ${r.data.email} un correo para entrar`);
        setEmail("");
        router.refresh();
      }}
    >
      <TextField
        label="Correo del ayudante"
        type="email"
        autoComplete="off"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={error ?? undefined}
        hint="Le llega un correo con el enlace para entrar. No necesita contraseña."
      />
      <Button type="submit" loading={busy} className="w-fit">
        <UserPlus aria-hidden className="size-4" />
        Dar acceso
      </Button>
    </form>
  );
}

export function RemoveHelperButton({ id, email }: { id: string; email: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="sm" className="text-danger">
          <UserMinus aria-hidden className="size-4" />
          Quitar acceso
          <span className="sr-only"> a {email}</span>
        </Button>
      }
      title="¿Quitar el acceso?"
      description={`${email} ya no podrá entrar al panel. Si tiene una sesión abierta, se cierra.`}
      confirmLabel="Sí, quitar acceso"
      tone="danger"
      onConfirm={async () => {
        const r = await safe(quitarAyudante)(id);
        if (!r.ok) {
          toast.error(r.error);
          return;
        }
        toast.success("Acceso quitado");
        router.refresh();
      }}
    />
  );
}
