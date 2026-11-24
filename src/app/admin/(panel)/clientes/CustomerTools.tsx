"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, UserX } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextareaField } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import { anonimizarCliente, guardarNotasCliente } from "@/server/actions/settings";

export function CustomerTools({ id, notes: initial, canAnonymize }: { id: string; notes: string; canAnonymize: boolean }) {
  const router = useRouter();
  const [notes, setNotes] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <TextareaField label="Notas del cliente" hint="Gustos, alergias, cómo llegar. Solo las ve tu equipo." value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          loading={busy}
          disabled={notes === initial}
          onClick={async () => {
            setBusy(true);
            const r = await guardarNotasCliente(id, notes);
            setBusy(false);
            if (!r.ok) return toast.error(r.error);
            toast.success("Notas guardadas");
            router.refresh();
          }}
        >
          <Save aria-hidden className="size-4" />
          Guardar notas
        </Button>
        {canAnonymize && (
          <ConfirmDialog
            trigger={
              <Button variant="ghost" className="text-danger">
                <UserX aria-hidden className="size-4" />
                Borrar sus datos
              </Button>
            }
            title="¿Borrar los datos de este cliente?"
            description="Se quitan su nombre, teléfono, correo y direcciones. Los montos de sus taquizas se conservan para tus cuentas. No se puede deshacer."
            confirmLabel="Borrar datos"
            onConfirm={async () => {
              const r = await anonimizarCliente(id);
              if (!r.ok) return void toast.error(r.error);
              toast.success("Datos borrados");
              router.refresh();
            }}
          />
        )}
      </div>
    </div>
  );
}
