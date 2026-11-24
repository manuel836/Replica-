"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { StarsDisplay } from "@/components/ui/Misc";
import { toast } from "@/components/ui/Toast";
import { publicarResena } from "@/server/actions/admin";

/** Reseñas nuevas: el dueño decide si se publican en la página. */
export function ReviewQueue({ reviews }: { reviews: { id: string; rating: number; comment: string }[] }) {
  const [hidden, setHidden] = useState<string[]>([]);
  const visible = reviews.filter((r) => !hidden.includes(r.id));
  if (visible.length === 0) return null;
  return (
    <section aria-labelledby="resenas-nuevas" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <h2 id="resenas-nuevas" className="text-lg text-text">
        Reseñas nuevas
      </h2>
      <ul className="flex flex-col gap-3">
        {visible.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 border-t border-border pt-3 first:border-0 first:pt-0">
            <StarsDisplay rating={r.rating} />
            <p className="text-sm text-text">{r.comment || <span className="text-text-muted">Sin comentario</span>}</p>
            <div className="flex gap-2">
              {[
                { label: "Publicar", publish: true },
                { label: "No publicar", publish: false },
              ].map(({ label, publish }) => (
                <Button
                  key={label}
                  size="sm"
                  variant={publish ? "primary" : "secondary"}
                  onClick={async () => {
                    const res = await publicarResena(r.id, publish);
                    if (!res.ok) return toast.error(res.error);
                    setHidden((h) => [...h, r.id]);
                    toast.success(publish ? "Reseña publicada" : "Reseña guardada sin publicar");
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
