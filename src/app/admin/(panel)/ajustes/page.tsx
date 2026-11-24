import type { TemplateKey } from "@/lib/types";
import { requireAdminPage } from "@/server/auth";
import { store } from "@/server/data";
import { DEFAULT_TEMPLATES, TEMPLATE_LABELS } from "@/server/domain/messages";
import { SettingsForm } from "./SettingsForm";

export const metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  await requireAdminPage("owner");
  const b = await store().getBusiness();
  const keys = Object.keys(DEFAULT_TEMPLATES) as TemplateKey[];
  return (
    <div className="mx-auto flex max-w-flow flex-col gap-6">
      <h1 className="text-xl text-text">Ajustes</h1>
      <nav aria-label="Más secciones" className="flex flex-wrap gap-2 text-sm md:hidden">
        <a href="/admin/zonas" className="flex min-h-11 items-center rounded-md border border-border bg-surface px-3 font-semibold text-text">
          Zonas
        </a>
        <a href="/admin/clientes" className="flex min-h-11 items-center rounded-md border border-border bg-surface px-3 font-semibold text-text">
          Clientes
        </a>
      </nav>
      <SettingsForm
        initial={{
          name: b.name,
          description: b.description,
          city: b.city,
          whatsapp: b.whatsappE164 ? b.whatsappE164.replace(/^\+52/, "") : "",
          email: b.email ?? "",
          depositMode: b.depositMode,
          depositType: b.depositType,
          depositValue: String(b.depositType === "fixed" ? b.depositValue / 100 : b.depositValue),
          confirmationMode: b.confirmationMode,
          requestHoldHours: String(b.requestHoldHours),
          paymentHoldMinutes: String(b.paymentHoldMinutes),
          proposalHoldHours: String(b.proposalHoldHours),
          cancellationPolicy: b.cancellationPolicy,
          refundCutoffDays: String(b.refundCutoffDays),
          templates: Object.fromEntries(keys.map((k) => [k, b.whatsappTemplates[k] ?? DEFAULT_TEMPLATES[k]])) as Record<TemplateKey, string>,
        }}
        templateLabels={TEMPLATE_LABELS}
        defaults={DEFAULT_TEMPLATES}
      />
    </div>
  );
}
