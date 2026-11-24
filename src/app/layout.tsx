import "@fontsource-variable/inter";
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import tokens from "../../replica/design/tokens.json";
import { Toaster } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: { default: "D' Garden Tacos · Taquizas", template: "%s · D' Garden Tacos" },
  description: "Agenda tu taquiza con D' Garden Tacos en Lázaro Cárdenas, Michoacán.",
};

export const viewport: Viewport = {
  themeColor: tokens.color.ink,
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-MX">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
