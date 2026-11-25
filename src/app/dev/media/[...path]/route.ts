import { readFile } from "node:fs/promises";
import { type NextRequest } from "next/server";
import { localUploadPath, sniffImage } from "@/server/storage";

// Fotos subidas en desarrollo (sin Supabase Storage). En producción no existe.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  if (process.env.NODE_ENV === "production") return new Response("No encontrado", { status: 404 });
  const file = localUploadPath((await params).path);
  if (!file) return new Response("No encontrado", { status: 404 });
  try {
    const buf = await readFile(file);
    const kind = sniffImage(buf);
    if (!kind) return new Response("No encontrado", { status: 404 });
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": kind.type, "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new Response("No encontrado", { status: 404 });
  }
}
