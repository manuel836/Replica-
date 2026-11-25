"use client";

import { useId } from "react";
import { CreditCard, Lock, MessageCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatMXN } from "@/lib/format";

export type PayMode = "now" | "later";

interface PaymentChoiceProps {
  value: PayMode;
  onChange: (mode: PayMode) => void;
  depositCents: number;
  /** "required": solo se muestra "pagar ahora". "optional": el cliente elige. */
  depositMode: "optional" | "required";
  holdMinutes?: number;
  /** Hasta cuándo se devuelve el anticipo, ya en palabras. */
  refundNote?: string;
}

/**
 * S05. El formulario de tarjeta NO es nuestro: Mercado Pago Checkout Pro lo muestra en su
 * propia página. Aquí solo se elige cómo pagar y se explica qué pasa después.
 */
export function PaymentChoice({ value, onChange, depositCents, depositMode, holdMinutes = 30, refundNote }: PaymentChoiceProps) {
  const name = useId();
  const options: { mode: PayMode; title: string; body: string; icon: typeof CreditCard }[] = [
    {
      mode: "now",
      title: `Pagar anticipo de ${formatMXN(depositCents)} ahora`,
      body: `Con tarjeta o Mercado Pago. Tu fecha queda confirmada al pagar (se aparta ${holdMinutes} minutos mientras pagas).${refundNote ? ` ${refundNote}` : ""}`,
      icon: CreditCard,
    },
    {
      mode: "later",
      title: "Agendar sin pagar en línea",
      body: "Te escribimos por WhatsApp para confirmar y acordar el pago en efectivo o por transferencia.",
      icon: MessageCircle,
    },
  ];
  const visible = depositMode === "required" ? options.slice(0, 1) : options;

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-semibold text-text">¿Cómo quieres apartar?</legend>
      {visible.map(({ mode, title, body, icon: Icon }) => {
        const id = `${name}-${mode}`;
        const checked = value === mode;
        return (
          <div key={mode}>
            <input
              type="radio"
              id={id}
              name={name}
              checked={checked}
              onChange={() => onChange(mode)}
              className="peer sr-only"
            />
            <label
              htmlFor={id}
              className={cn(
                "flex cursor-pointer gap-3 rounded-lg border bg-surface p-4 transition-colors duration-150 ease-brand",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
                checked ? "border-accent ring-2 ring-accent" : "border-border hover:border-border-input",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-pill border",
                  checked ? "border-accent-text" : "border-border-input",
                )}
              >
                {checked && <span className="size-2.5 rounded-pill bg-accent-text" />}
              </span>
              <span className="flex flex-col gap-1">
                <span className="flex items-center gap-2 font-semibold text-text">
                  <Icon aria-hidden className="size-4 text-text-muted" />
                  {title}
                </span>
                <span className="text-sm text-text-muted">{body}</span>
              </span>
            </label>
          </div>
        );
      })}
      {value === "now" && (
        <p className="flex items-center gap-1.5 text-sm text-text-muted">
          <Lock aria-hidden className="size-4" />
          El pago se hace en la página segura de Mercado Pago. Nunca vemos los datos de tu tarjeta.
        </p>
      )}
    </fieldset>
  );
}
