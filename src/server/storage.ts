import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { AppError } from "./errors";

// Fotos del negocio y de los paquetes. En producción: Supabase Storage, bucket público,
// servido desde el dominio de Supabase (separado de la app). En desarrollo sin Supabase: en
// disco (.data/uploads) y servido por /dev/media.

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const bucket = () => process.env.STORAGE_BUCKET ?? "fotos";
const supabase = () =>
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? { url: process.env.SUPABASE_URL.replace(/\/$/, ""), key: process.env.SUPABASE_SERVICE_ROLE_KEY }
    : null;
const LOCAL_DIR = join(process.cwd(), ".data", "uploads");

/** El tipo real del archivo por sus primeros bytes (no por lo que diga el navegador). */
export function sniffImage(buf: Buffer): { type: "image/jpeg" | "image/png" | "image/webp"; ext: string } | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { type: "image/png", ext: "png" };
  if (buf.length >= 12 && buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP")
    return { type: "image/webp", ext: "webp" };
  return null;
}

/** Valida y sube una imagen. Devuelve su URL pública. */
export async function uploadImage(file: File, folder: "negocio" | "paquetes"): Promise<string> {
  if (!(file instanceof File) || file.size === 0) throw new AppError("Elige una foto.", "file");
  if (file.size > MAX_IMAGE_BYTES) throw new AppError("La foto pesa más de 4 MB.", "file_size");
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniffImage(buf);
  if (!kind) throw new AppError("Solo se aceptan fotos JPG, PNG o WebP.", "file_type");
  const path = `${folder}/${randomUUID()}.${kind.ext}`;

  const sb = supabase();
  if (sb) {
    const res = await fetch(`${sb.url}/storage/v1/object/${bucket()}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sb.key}`,
        apikey: sb.key,
        "Content-Type": kind.type,
        "cache-control": "31536000",
        "x-upsert": "false",
      },
      body: buf,
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Supabase Storage respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return `${sb.url}/storage/v1/object/public/${bucket()}/${path}`;
  }
  if (process.env.NODE_ENV === "production") {
    throw new AppError("El almacenamiento de fotos no está configurado.", "storage");
  }
  const target = join(LOCAL_DIR, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, buf);
  return `/dev/media/${path}`;
}

/** Borra una foto que subimos nosotros. Ignora URLs ajenas. */
export async function deleteImage(url: string): Promise<void> {
  const sb = supabase();
  const publicPrefix = sb ? `${sb.url}/storage/v1/object/public/${bucket()}/` : null;
  if (publicPrefix && url.startsWith(publicPrefix)) {
    const path = url.slice(publicPrefix.length);
    await fetch(`${sb!.url}/storage/v1/object/${bucket()}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${sb!.key}`, apikey: sb!.key, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: [path] }),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => undefined);
    return;
  }
  if (url.startsWith("/dev/media/")) {
    const rel = normalize(url.slice("/dev/media/".length));
    if (rel.startsWith("..")) return;
    await unlink(join(LOCAL_DIR, rel)).catch(() => undefined);
  }
}

/** Para /dev/media: lee un archivo local de forma segura. */
export function localUploadPath(parts: string[]): string | null {
  const rel = normalize(parts.join("/"));
  if (rel.startsWith("..") || rel.includes("\0")) return null;
  return join(LOCAL_DIR, rel);
}
