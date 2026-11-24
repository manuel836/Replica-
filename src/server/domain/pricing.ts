import type { Business, Package, Zone } from "@/lib/types";

export interface Price {
  pricePerGuestCents: number;
  subtotalCents: number;
  travelFeeCents: number;
  addonsCents: number;
  totalCents: number;
  depositCents: number;
}

/** El precio se congela en la taquiza al agendar; cambiar el paquete después no lo toca. */
export function priceFor(business: Business, pkg: Package, guests: number, zone: Zone | null): Price {
  const subtotalCents = pkg.pricePerGuestCents * guests;
  const travelFeeCents = zone?.travelFeeCents ?? 0;
  const addonsCents = 0;
  const totalCents = subtotalCents + travelFeeCents + addonsCents;
  return {
    pricePerGuestCents: pkg.pricePerGuestCents,
    subtotalCents,
    travelFeeCents,
    addonsCents,
    totalCents,
    depositCents: depositFor(business, totalCents),
  };
}

/** Porcentaje redondeado hacia arriba al peso, o monto fijo topado al total. */
export function depositFor(business: Business, totalCents: number): number {
  if (business.depositMode === "none" || totalCents === 0) return 0;
  if (business.depositType === "fixed") return Math.min(business.depositValue, totalCents);
  const raw = (totalCents * business.depositValue) / 100;
  return Math.min(totalCents, Math.ceil(raw / 100) * 100);
}
