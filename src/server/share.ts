import "server-only";
import QRCode from "qrcode";
import tokens from "../../replica/design/tokens.json";
import type { Business } from "@/lib/types";

// Tu página para compartir: el enlace de agendar, su código QR y textos listos para redes
// (replica/fixes.md, FX6). Los pedidos que llegan por aquí no pagan comisión a nadie.

/** Código QR en SVG, tinta oscura sobre blanco (de los tokens) para que cualquier celular lo lea. */
export function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: tokens.color.ink, light: tokens.color.surface },
  });
}

export function shareTexts(business: Pick<Business, "name" | "city">, link: string) {
  return [
    {
      id: "publicacion",
      label: "Publicación para Facebook o Instagram",
      text: `🌮 ¿Tienes fiesta? Llevamos la taquiza a tu evento en ${business.city}.\nElige fecha, hora y paquete, y aparta tu día en línea:\n${link}`,
    },
    {
      id: "whatsapp",
      label: "Mensaje o estado de WhatsApp",
      text: `¡Agenda tu taquiza con ${business.name}! Ves los días libres y apartas en un minuto: ${link}`,
    },
    { id: "bio", label: "Para la bio de Instagram o Facebook", text: `Taquizas para tu evento · Agenda aquí: ${link}` },
  ];
}
