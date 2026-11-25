"use client";

import { useState } from "react";
import { MailCheck, MessageCircle } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { PhoneField } from "@/components/ui/Field";
import { Turnstile } from "@/components/Turnstile";
import { whatsappLink } from "@/lib/format";
import { safe } from "@/lib/safe-action";
import { recuperarEnlace } from "@/server/actions/public";

export function RecoverForm({ businessWhatsapp }: { businessWhatsapp: string | null }) {
  const [whatsapp, setWhatsapp] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [banner, setBanner] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const askBusiness = businessWhatsapp
    ? whatsappLink(businessWhatsapp, `Hola, perdí el enlace de mi taquiza. Agendé con el WhatsApp ${whatsapp}.`)
    : null;

  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success" title="Listo">
          <span className="flex items-start gap-2">
            <MailCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
            Si ese número tiene taquizas próximas y nos dejaste tu correo, ya te mandamos tus enlaces. Revisa también la
            carpeta de spam.
          </span>
        </Alert>
        <p className="text-sm text-text-muted">¿No dejaste correo o no te llegó? Pídenos el enlace por WhatsApp.</p>
        {askBusiness && (
          <ButtonLink variant="whatsapp" external href={askBusiness} className="w-fit">
            <MessageCircle aria-hidden className="size-5" />
            Pedir mi enlace por WhatsApp
          </ButtonLink>
        )}
      </div>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setBanner(null);
        const r = await safe(recuperarEnlace)({ whatsapp, turnstileToken: token });
        setBusy(false);
        if (r.ok) return setSent(true);
        const field = (r as { fields?: { whatsapp?: string } }).fields?.whatsapp;
        if (field) setError(field);
        else setBanner(r.error);
      }}
    >
      {banner && <Alert tone="danger" title={banner} />}
      <PhoneField
        label="Tu WhatsApp"
        value={whatsapp}
        onChange={(e) => {
          setWhatsapp(e.target.value);
          setError(undefined);
        }}
        error={error}
        placeholder="753 123 4567"
      />
      <Turnstile onToken={setToken} />
      <Button type="submit" loading={busy} className="w-fit">
        Mandarme mi enlace
      </Button>
    </form>
  );
}
