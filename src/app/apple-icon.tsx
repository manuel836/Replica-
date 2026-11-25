import { ImageResponse } from "next/og";
import tokens from "../../replica/design/tokens.json";

// Ícono para "Agregar a pantalla de inicio" en iPhone. Sin transparencia, como pide iOS.
// Provisional hasta tener el logo real (ver replica/brand.md, "Brief del logo").
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const c = tokens.color;

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: c.ink }}>
        <div
          style={{
            width: 148,
            height: 148,
            borderRadius: 74,
            border: `8px solid ${c.brand}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: c["on-ink"],
            fontSize: 64,
            fontWeight: 800,
          }}
        >
          DG
        </div>
      </div>
    ),
    { ...size },
  );
}
