"use client";

import { useState } from "react";
import { MailCheck } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { TextField } from "@/components/ui/Field";
import { pedirEnlaceAcceso } from "@/server/actions/admin";

export function LoginForm({ linkError, signedOutEverywhere = false }: { linkError: boolean; signedOutEverywhere?: boolean }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ devLink: string | null } | null>(null);

  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success" title="Revisa tu correo">
          Si {email} tiene acceso, te llegará un enlace para entrar. Funciona una vez y vence en 15 minutos.
        </Alert>
        {sent.devLink && (
          <Alert tone="warning" title="Modo de desarrollo" action={<ButtonLink href={sent.devLink}>Entrar con el enlace</ButtonLink>}>
            Todavía no se mandan correos; usa este enlace.
          </Alert>
        )}
        <Button variant="ghost" onClick={() => setSent(null)}>
          Usar otro correo
        </Button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const r = await pedirEnlaceAcceso(email);
        setBusy(false);
        if (!r.ok) return setError(r.error);
        setSent({ devLink: r.devLink });
      }}
    >
      {linkError && <Alert tone="danger" title="Ese enlace ya no sirve">Ya se usó o venció. Pide uno nuevo; duran 15 minutos.</Alert>}
      {signedOutEverywhere && <Alert tone="success" title="Cerraste sesión en todos tus dispositivos" />}
      <TextField
        label="Correo"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={error ?? undefined}
      />
      <Button type="submit" size="lg" loading={busy}>
        <MailCheck aria-hidden className="size-5" />
        Mandarme el enlace
      </Button>
    </form>
  );
}
