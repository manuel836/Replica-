const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const mxnWhole = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

/** Centavos a "$1,234.50". Sin decimales cuando son pesos cerrados. */
export function formatMXN(cents: number): string {
  return cents % 100 === 0 ? mxnWhole.format(cents / 100) : mxn.format(cents / 100);
}

/** Enlace de WhatsApp con el mensaje ya escrito. El número va en E.164 ("+52...") y wa.me lo pide sin "+". */
export function whatsappLink(phoneE164: string, text: string): string {
  const digits = phoneE164.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** WhatsApp sin número: abre la app para que la persona elija a quién mandarlo. */
export function whatsappShareLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Búsqueda de una dirección en Google Maps (Maps URLs, la forma pública y oficial). */
export function mapsLink(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
