import type { TemplateKey } from "@/lib/types";
import { requireAdminPage } from "@/server/auth";
import { store } from "@/server/data";
import { DEFAULT_TEMPLATES, TEMPLATE_LABELS } from "@/server/domain/messages";
import { Alert } from "@/components/ui/Feedback";
import { emailConfigured } from "@/server/email";
import { BusinessPhotos } from "./BusinessPhotos";
import { SettingsForm } from "./SettingsForm";

export const metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  await requireAdminPage("owner");
  const b = await store().getBusiness();
  const dead = await store().listDeadOutbox(b.id);
  const keys = Object.keys(DEFAULT_TEMPLATES) as TemplateKey[];
  return (
    <div className="mx-auto flex max-w-flow flex-col gap-6">
      <h1 className="text-xl text-text">Ajustes</h1>
      {!emailConfigured() && (
        <Alert tone="warning" title="Los correos no están configurados">
          Sin RESEND_API_KEY y EMAIL_FROM no te llegan los avisos de solicitudes nuevas ni el enlace para entrar.
        </Alert>
      )}
      {dead.length > 0 && (
        <Alert tone="danger" title={`${dead.length} correo(s) no se pudieron mandar`}>
          <ul className="mt-1 list-disc pl-5">
            {dead.slice(0, 5).map((d) => (
              <li key={d.id}>
                {d.payload.subject} — {d.lastError}
              </li>
            ))}
          </ul>
        </Alert>
      )}
      <nav aria-label="Más secciones" className="flex flex-wrap gap-2 text-sm md:hidden">
        <a href="/admin/zonas" className="flex min-h-11 items-center rounded-md border border-border bg-surface px-3 font-semibold text-text">
          Zonas
        </a>
        <a href="/admin/clientes" className="flex min-h-11 items-center rounded-md border border-border bg-surface px-3 font-semibold text-text">
          Clientes
        </a>
        <a href="/admin/reportes" className="flex min-h-11 items-center rounded-md border border-border bg-surface px-3 font-semibold text-text">
          Reportes
        </a>
        <a href="/admin/equipo" className="flex min-h-11 items-center rounded-md border border-border bg-surface px-3 font-semibold text-text">
          Equipo
        </a>
      </nav>
      <BusinessPhotos photos={b.photoPaths} />
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
      <p className="border-t border-border pt-6 text-sm text-text-muted">
        Para dar o quitar acceso a un ayudante, ve a{" "}
        <a href="/admin/equipo" className="font-semibold text-accent-text underline underline-offset-4">
          Equipo
        </a>
        . Para cerrar tus sesiones en todos tus dispositivos, ve a{" "}
        <a href="/admin/cuenta" className="font-semibold text-accent-text underline underline-offset-4">
          Mi cuenta
        </a>
        .
      </p>
    </div>
  );
}
