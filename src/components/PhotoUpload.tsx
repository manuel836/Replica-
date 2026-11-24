"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus } from "lucide-react";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";

type Result = { ok: true; data?: unknown } | { ok: false; error: string };

/** Reduce la foto en el navegador (máx. 2000 px, JPEG) para que suba rápido con datos móviles. */
async function shrink(file: File, max = 2000): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file; // el servidor decide si la acepta
  }
}

export function PhotoUpload({
  label,
  upload,
  fields = {},
  variant = "secondary",
}: {
  label: string;
  upload: (fd: FormData) => Promise<Result>;
  fields?: Record<string, string>;
  variant?: ButtonVariant;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          const fd = new FormData();
          for (const [k, v] of Object.entries(fields)) fd.set(k, v);
          fd.set("foto", new File([await shrink(file)], "foto.jpg", { type: "image/jpeg" }));
          const r = await upload(fd);
          setBusy(false);
          if (!r.ok) return toast.error(r.error);
          toast.success("Foto guardada");
          router.refresh();
        }}
      />
      <Button size="sm" variant={variant} loading={busy} onClick={() => input.current?.click()}>
        <ImagePlus aria-hidden className="size-4" />
        {label}
      </Button>
    </>
  );
}
