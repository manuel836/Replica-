import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Showcase } from "./Showcase";

export const metadata: Metadata = { title: "Sistema de diseño", robots: { index: false } };

// Página de revisión de los componentes. En producción solo existe si SHOW_DESIGN=1.
export default function DesignPage() {
  if (process.env.NODE_ENV === "production" && process.env.SHOW_DESIGN !== "1") notFound();
  return <Showcase />;
}
