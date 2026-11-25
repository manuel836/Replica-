"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { PhotoUpload } from "@/components/PhotoUpload";
import { toast } from "@/components/ui/Toast";
import { quitarFotoNegocio, subirFotoNegocio } from "@/server/actions/settings";
import { safe } from "@/lib/safe-action";

/** Fotos de la galería pública (S01). Máximo 8. */
export function BusinessPhotos({ photos }: { photos: string[] }) {
  const router = useRouter();
  return (
    <section aria-labelledby="fotos-negocio" className="flex flex-col gap-3">
      <h2 id="fotos-negocio" className="text-lg font-semibold text-text">
        Fotos del negocio
      </h2>
      <p className="text-sm text-text-muted">Aparecen en tu página. JPG, PNG o WebP; hasta 8 fotos.</p>
      {photos.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {photos.map((url, i) => (
            <li key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Foto ${i + 1} del negocio`} className="aspect-[4/3] w-full rounded-md object-cover" />
              <button
                type="button"
                aria-label={`Quitar foto ${i + 1}`}
                className="absolute top-1 right-1 flex size-11 items-center justify-center rounded-pill bg-ink/70 text-on-ink hover:bg-ink"
                onClick={async () => {
                  const r = await safe(quitarFotoNegocio)(url);
                  if (!r.ok) return toast.error(r.error);
                  toast.success("Foto quitada");
                  router.refresh();
                }}
              >
                <X aria-hidden className="size-5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {photos.length < 8 && (
        <div>
          <PhotoUpload label="Subir foto" upload={subirFotoNegocio} />
        </div>
      )}
    </section>
  );
}
