import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/Button";

export const metadata = { title: "Entrar al panel", robots: { index: false } };

// Paso intermedio del enlace mágico: el enlace no se gasta hasta tocar el botón.
export default async function ConfirmLogin({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t = "" } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-ink px-4 py-12">
      <form method="post" action="/auth/callback" className="flex w-full max-w-md flex-col gap-5 rounded-lg bg-surface p-6 shadow-pop">
        <p className="font-display text-lg font-extrabold text-text">
          <span className="text-accent-text">D&apos; Garden</span> Tacos
        </p>
        <h1 className="text-xl text-text">Entrar al panel</h1>
        <p className="text-sm text-text-muted">Toca el botón para terminar de entrar. El enlace funciona una sola vez.</p>
        <input type="hidden" name="t" value={t} />
        <Button type="submit" size="lg">
          <LogIn aria-hidden className="size-5" />
          Entrar
        </Button>
      </form>
    </main>
  );
}
