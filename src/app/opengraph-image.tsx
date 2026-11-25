import { ImageResponse } from "next/og";
import { connection } from "next/server";
import tokens from "../../replica/design/tokens.json";
import { store } from "@/server/data";

// La imagen que sale al pegar tu enlace en WhatsApp, Facebook o Instagram.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "D' Garden Tacos: taquizas para tu evento";

const c = tokens.color;

export default async function OpenGraphImage() {
  // En cada petición: el nombre y la ciudad se cambian en Ajustes.
  await connection();
  const business = await store().getBusiness();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: c.ink,
          color: c["on-ink"],
          padding: 72,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              width: 120,
              height: 120,
              flexShrink: 0, // BUG-009: con un nombre largo el aro se aplastaba
              borderRadius: 60,
              border: `8px solid ${c.brand}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 48,
              fontWeight: 800,
            }}
          >
            DG
          </div>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 800, color: c.brand }}>{business.name}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", fontSize: 58, fontWeight: 800, lineHeight: 1.1 }}>Tu taquiza, confirmada por quien la va a servir.</div>
          <div style={{ display: "flex", fontSize: 32, color: c["on-ink-muted"] }}>
            Taquizas para tu evento en {business.city}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
