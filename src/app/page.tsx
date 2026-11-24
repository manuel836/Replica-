import { SiteHeader } from "@/components/ui/SiteHeader";

// Provisional: /replica-build reemplaza esta página por S01 (página del negocio).
export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-content flex-col gap-4 px-4 py-12">
        <h1 className="text-display text-text">Taquizas para tu evento</h1>
        <p className="max-w-flow text-lg font-normal text-text-muted">
          Muy pronto podrás agendar tu taquiza en línea. Mientras tanto, escríbenos por WhatsApp.
        </p>
      </main>
    </>
  );
}
