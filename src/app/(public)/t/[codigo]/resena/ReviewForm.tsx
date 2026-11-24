"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { TextareaField } from "@/components/ui/Field";
import { StarsInput } from "@/components/ui/Misc";
import { enviarResena } from "@/server/actions/public";
import { safe } from "@/lib/safe-action";

export function ReviewForm({ code, token }: { code: string; token: string }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <EmptyState icon={Heart} title="¡Gracias por tu reseña!">
        La revisamos antes de publicarla.
      </EmptyState>
    );
  }
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (rating < 1) return setError("Elige de 1 a 5 estrellas.");
        setBusy(true);
        const r = await safe(enviarResena)(code, token, rating, comment);
        setBusy(false);
        if (!r.ok) return setError(r.error);
        setSent(true);
      }}
    >
      <StarsInput value={rating} onChange={(n) => { setRating(n); setError(null); }} />
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <TextareaField
        label="Cuéntanos más"
        optional
        value={comment}
        maxLength={1000}
        onChange={(e) => setComment(e.target.value)}
        hint="¿Qué te gustó? ¿Qué podemos mejorar?"
      />
      <Button type="submit" size="lg" loading={busy} className="w-fit">
        Enviar reseña
      </Button>
    </form>
  );
}
