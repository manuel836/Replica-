"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Package as PackageIcon, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { TextareaField, TextField } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import { formatMXN } from "@/lib/format";
import { PhotoUpload } from "@/components/PhotoUpload";
import { activarPaquete, guardarPaquete, moverPaquete, quitarFotoPaquete, subirFotoPaquete } from "@/server/actions/settings";
import { safe } from "@/lib/safe-action";

interface Row {
  id: string;
  name: string;
  description: string;
  price: string;
  minGuests: string;
  maxGuests: string;
  includes: string;
  isActive: boolean;
  pricePerGuestCents: number;
  photoUrl?: string | null;
}

const EMPTY: Omit<Row, "id" | "pricePerGuestCents" | "photoUrl"> = {
  name: "",
  description: "",
  price: "",
  minGuests: "20",
  maxGuests: "",
  includes: "",
  isActive: true,
};

export function PackagesManager({ packages }: { packages: Row[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<(Omit<Row, "pricePerGuestCents" | "id" | "photoUrl"> & { id?: string }) | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setEditing((x) => x && { ...x, [k]: e.target.value });

  const form = editing && (
    <Modal
      open
      onOpenChange={(o) => !o && setEditing(null)}
      title={editing.id ? "Editar paquete" : "Nuevo paquete"}
      footer={
        <Button
          loading={busy}
          onClick={async () => {
            setBusy(true);
            const r = await safe(guardarPaquete)(editing);
            setBusy(false);
            if (!r.ok) {
              setErrors((r as { fields?: Record<string, string> }).fields ?? {});
              return toast.error(r.error);
            }
            toast.success("Paquete guardado");
            setEditing(null);
            setErrors({});
            router.refresh();
          }}
        >
          Guardar paquete
        </Button>
      }
    >
      <TextField label="Nombre" required value={editing.name} onChange={set("name")} error={errors.name} />
      <TextField
        label="Precio por persona (pesos)"
        required
        inputMode="decimal"
        value={editing.price}
        onChange={set("price")}
        error={errors.price}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Mínimo de invitados" required type="number" inputMode="numeric" value={editing.minGuests} onChange={set("minGuests")} error={errors.minGuests} />
        <TextField label="Máximo" optional type="number" inputMode="numeric" value={editing.maxGuests} onChange={set("maxGuests")} error={errors.maxGuests} />
      </div>
      <TextareaField label="Descripción" optional value={editing.description} onChange={set("description")} error={errors.description} />
      <TextareaField
        label="Qué incluye"
        optional
        rows={4}
        value={editing.includes}
        onChange={set("includes")}
        hint="Una cosa por renglón."
      />
      <label className="flex min-h-11 cursor-pointer items-center gap-3 font-semibold text-text">
        <input
          type="checkbox"
          checked={editing.isActive}
          onChange={(e) => setEditing((x) => x && { ...x, isActive: e.target.checked })}
          className="size-5 accent-accent-text"
        />
        Disponible para agendar
      </label>
      <p className="text-sm text-text-muted">La foto se sube desde la lista de paquetes.</p>
    </Modal>
  );

  return (
    <div className="flex flex-col gap-4">
      <Button className="w-fit" onClick={() => { setErrors({}); setEditing({ ...EMPTY }); }}>
        <Plus aria-hidden className="size-5" />
        Nuevo paquete
      </Button>
      {packages.length === 0 ? (
        <EmptyState as="h2" icon={PackageIcon} title="Sin paquetes">
          Crea al menos uno: sin paquetes, tus clientes no pueden agendar.
        </EmptyState>
      ) : (
        <ol className="flex flex-col gap-3">
          {packages.map((p, i) => (
            <li key={p.id} className={`flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center ${p.isActive ? "bg-surface" : "bg-surface-muted"}`}>
              {p.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.photoUrl} alt={`Foto de ${p.name}`} className="size-16 shrink-0 rounded-md object-cover" />
              ) : null}
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold text-text">
                  {p.name}
                  {!p.isActive && <span className="ml-2 text-sm font-normal text-text-muted">(no disponible)</span>}
                </span>
                <span className="text-sm text-text-muted">
                  {formatMXN(p.pricePerGuestCents)} por persona · {p.minGuests}
                  {p.maxGuests ? ` a ${p.maxGuests}` : " o más"} invitados
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <Button size="sm" variant="ghost" aria-label={`Subir ${p.name}`} disabled={i === 0} onClick={async () => { await safe(moverPaquete)(p.id, -1); router.refresh(); }}>
                  <ArrowUp aria-hidden className="size-4" />
                </Button>
                <Button size="sm" variant="ghost" aria-label={`Bajar ${p.name}`} disabled={i === packages.length - 1} onClick={async () => { await safe(moverPaquete)(p.id, 1); router.refresh(); }}>
                  <ArrowDown aria-hidden className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    const r = await safe(activarPaquete)(p.id, !p.isActive);
                    if (!r.ok) return toast.error(r.error);
                    toast.success(p.isActive ? "Paquete oculto" : "Paquete disponible");
                    router.refresh();
                  }}
                >
                  {p.isActive ? "Ocultar" : "Mostrar"}
                </Button>
                <PhotoUpload label={p.photoUrl ? "Cambiar foto" : "Subir foto"} upload={subirFotoPaquete} fields={{ id: p.id }} />
                {p.photoUrl && (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Quitar foto de ${p.name}`}
                    onClick={async () => {
                      const r = await safe(quitarFotoPaquete)(p.id);
                      if (!r.ok) return toast.error(r.error);
                      toast.success("Foto quitada");
                      router.refresh();
                    }}
                  >
                    Quitar foto
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => { setErrors({}); const { photoUrl: _p, pricePerGuestCents: _c, ...rest } = p; void _p; void _c; setEditing(rest); }} aria-label={`Editar ${p.name}`}>
                  <Pencil aria-hidden className="size-4" />
                  Editar
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
      {form}
    </div>
  );
}
