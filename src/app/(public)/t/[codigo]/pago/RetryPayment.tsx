"use client";

import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { pagarAnticipo } from "@/server/actions/public";
import { safe } from "@/lib/safe-action";

export function RetryPayment({ code, token, manageHref }: { code: string; token: string; manageHref: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap justify-center gap-3">
        <Button
          loading={busy}
          onClick={async () => {
            setBusy(true);
            const r = await safe(pagarAnticipo)(code, token);
            if (!r.ok) {
              setBusy(false);
              return setError(r.error);
            }
            window.location.assign(r.data.redirectTo);
          }}
        >
          Intentar de nuevo
        </Button>
        <ButtonLink variant="secondary" href={manageHref}>
          Ver mi taquiza
        </ButtonLink>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
