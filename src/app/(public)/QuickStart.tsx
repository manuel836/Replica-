"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarSearch } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { GuestStepper } from "@/components/ui/GuestStepper";

/** Mini widget de S01: cuántos invitados → calendario con disponibilidad real. */
export function QuickStart({ minGuests }: { minGuests: number }) {
  const router = useRouter();
  const [guests, setGuests] = useState(Math.max(minGuests, 50));
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-col gap-4 rounded-lg bg-surface p-4 text-text shadow-pop sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        router.push(`/agendar?invitados=${guests}`);
      }}
    >
      <GuestStepper label="¿Cuántos invitados?" value={guests} onChange={setGuests} min={1} max={2000} step={10} />
      <Button type="submit" size="lg" loading={busy} className="sm:flex-1">
        <CalendarSearch aria-hidden className="size-5" />
        Ver fechas disponibles
      </Button>
    </form>
  );
}
