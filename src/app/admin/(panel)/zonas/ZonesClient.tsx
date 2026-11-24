"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { TextField } from "@/components/ui/Field";
import { toast } from "@/components/ui/Toast";
import { guardarZona } from "@/server/actions/settings";

interface Zone {
  id?: string;
  name: string;
  fee: string;
  isActive: boolean;
}

function ZoneRow({ zone, onSaved }: { zone: Zone; onSaved: () => void }) {
  const [z, setZ] = useState(zone);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(z) !== JSON.stringify(zone);
  return (
    <form
      className={`grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-[1fr_9rem_auto_auto] sm:items-end ${z.isActive ? "bg-surface" : "bg-surface-muted"}`}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await guardarZona(z);
        setBusy(false);
        if (!r.ok) {
          setErrors((r as { fields?: Record<string, string> }).fields ?? {});
          return toast.error(r.error);
        }
        setErrors({});
        toast.success("Zona guardada");
        onSaved();
      }}
    >
      <TextField label="Zona o colonia" required value={z.name} onChange={(e) => setZ({ ...z, name: e.target.value })} error={errors.name} />
      <TextField label="Traslado (pesos)" inputMode="decimal" value={z.fee} onChange={(e) => setZ({ ...z, fee: e.target.value })} error={errors.fee} />
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-text">
        <input type="checkbox" checked={z.isActive} onChange={(e) => setZ({ ...z, isActive: e.target.checked })} className="size-5 accent-accent-text" />
        Activa
      </label>
      <Button type="submit" variant={zone.id ? "secondary" : "primary"} loading={busy} disabled={!dirty && !!zone.id}>
        <Save aria-hidden className="size-4" />
        {zone.id ? "Guardar" : "Agregar"}
      </Button>
    </form>
  );
}

export function ZonesManager({ zones }: { zones: Zone[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const refresh = () => {
    setAdding(false);
    router.refresh();
  };
  return (
    <div className="flex flex-col gap-3">
      {zones.length === 0 && !adding && (
        <EmptyState icon={MapPin} title="Sin zonas">
          Sin zonas, el formulario no pregunta la zona y no se cobra traslado.
        </EmptyState>
      )}
      {zones.map((z) => (
        <ZoneRow key={`${z.id}-${z.name}-${z.fee}-${z.isActive}`} zone={z} onSaved={refresh} />
      ))}
      {adding ? (
        <ZoneRow zone={{ name: "", fee: "0", isActive: true }} onSaved={refresh} />
      ) : (
        <Button variant="secondary" className="w-fit" onClick={() => setAdding(true)}>
          <Plus aria-hidden className="size-5" />
          Agregar zona
        </Button>
      )}
    </div>
  );
}
