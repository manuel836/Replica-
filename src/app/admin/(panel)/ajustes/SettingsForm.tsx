"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Save } from "lucide-react";
import type { TemplateKey } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { PhoneField, SelectField, TextareaField, TextField } from "@/components/ui/Field";
import { toast } from "@/components/ui/Toast";
import { guardarAjustes } from "@/server/actions/settings";

interface Values {
  name: string;
  description: string;
  city: string;
  whatsapp: string;
  email: string;
  depositMode: "none" | "optional" | "required";
  depositType: "percent" | "fixed";
  depositValue: string;
  confirmationMode: "auto" | "manual";
  requestHoldHours: string;
  paymentHoldMinutes: string;
  proposalHoldHours: string;
  cancellationPolicy: string;
  refundCutoffDays: string;
  templates: Record<TemplateKey, string>;
}

export function SettingsForm({
  initial,
  templateLabels,
  defaults,
}: {
  initial: Values;
  templateLabels: Record<TemplateKey, string>;
  defaults: Record<TemplateKey, string>;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: Exclude<keyof Values, "templates">) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));
  const keys = Object.keys(defaults) as TemplateKey[];

  return (
    <form
      noValidate
      className="flex flex-col gap-8"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await guardarAjustes(v);
        setBusy(false);
        if (!r.ok) {
          setErrors((r as { fields?: Record<string, string> }).fields ?? {});
          return toast.error(r.error);
        }
        setErrors({});
        toast.success("Ajustes guardados");
        router.refresh();
      }}
    >
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-lg font-semibold text-text">Tu negocio</legend>
        <TextField label="Nombre" required value={v.name} onChange={set("name")} error={errors.name} />
        <TextareaField label="Descripción" optional value={v.description} onChange={set("description")} error={errors.description} hint="Aparece en tu página." />
        <TextField label="Ciudad" required value={v.city} onChange={set("city")} error={errors.city} />
        <PhoneField label="WhatsApp del negocio" optional value={v.whatsapp} onChange={set("whatsapp")} error={errors.whatsapp} hint="Tus clientes te escriben aquí." />
        <TextField label="Correo para avisos" optional type="email" value={v.email} onChange={set("email")} error={errors.email} hint="Te avisamos de cada solicitud nueva." />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-lg font-semibold text-text">Anticipo</legend>
        <SelectField
          label="¿Pides anticipo?"
          value={v.depositMode}
          onChange={set("depositMode")}
          options={[
            { value: "none", label: "No" },
            { value: "optional", label: "Sí, el cliente elige si paga en línea o después" },
            { value: "required", label: "Sí, sin anticipo no se confirma" },
          ]}
        />
        {v.depositMode !== "none" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Tipo"
              value={v.depositType}
              onChange={set("depositType")}
              options={[
                { value: "percent", label: "Porcentaje del total" },
                { value: "fixed", label: "Monto fijo" },
              ]}
            />
            <TextField
              label={v.depositType === "percent" ? "Porcentaje (%)" : "Monto (pesos)"}
              inputMode="decimal"
              value={v.depositValue}
              onChange={set("depositValue")}
              error={errors.depositValue}
            />
          </div>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-lg font-semibold text-text">Confirmación y apartados</legend>
        <SelectField
          label="Las solicitudes en línea…"
          value={v.confirmationMode}
          onChange={set("confirmationMode")}
          options={[
            { value: "manual", label: "Las reviso y acepto yo" },
            { value: "auto", label: "Se confirman solas si hay lugar" },
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Apartar sin pago (horas)" type="number" value={v.requestHoldHours} onChange={set("requestHoldHours")} error={errors.requestHoldHours} />
          <TextField label="Apartar mientras paga (min)" type="number" value={v.paymentHoldMinutes} onChange={set("paymentHoldMinutes")} error={errors.paymentHoldMinutes} />
          <TextField label="Vigencia de propuesta (horas)" type="number" value={v.proposalHoldHours} onChange={set("proposalHoldHours")} error={errors.proposalHoldHours} />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-lg font-semibold text-text">Cancelación</legend>
        <TextareaField
          label="Política de cancelación"
          optional
          rows={4}
          value={v.cancellationPolicy}
          onChange={set("cancellationPolicy")}
          error={errors.cancellationPolicy}
          hint="Tus clientes la ven antes de confirmar y al cancelar."
        />
        <TextField
          label="Días antes para devolver el anticipo"
          type="number"
          value={v.refundCutoffDays}
          onChange={set("refundCutoffDays")}
          error={errors.refundCutoffDays}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-lg font-semibold text-text">Mensajes de WhatsApp</legend>
        <Alert tone="info">
          Puedes usar: {"{nombre} {negocio} {codigo} {fecha} {hora} {invitados} {paquete} {direccion} {enlace} {total} {anticipo} {motivo}"}
        </Alert>
        {keys.map((k) => (
          <div key={k} className="flex flex-col gap-1">
            <TextareaField
              label={templateLabels[k]}
              rows={3}
              value={v.templates[k]}
              onChange={(e) => setV((x) => ({ ...x, templates: { ...x.templates, [k]: e.target.value } }))}
            />
            {v.templates[k] !== defaults[k] && (
              <Button
                size="sm"
                variant="ghost"
                className="w-fit"
                onClick={() => setV((x) => ({ ...x, templates: { ...x.templates, [k]: defaults[k] } }))}
              >
                <RotateCcw aria-hidden className="size-4" />
                Volver al texto original
              </Button>
            )}
          </div>
        ))}
      </fieldset>

      <div className="sticky bottom-20 z-10 md:bottom-4">
        <Button type="submit" size="lg" loading={busy} className="shadow-pop">
          <Save aria-hidden className="size-5" />
          Guardar ajustes
        </Button>
      </div>
    </form>
  );
}
