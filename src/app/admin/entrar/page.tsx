import { connection } from "next/server";
import { redirect } from "next/navigation";
import { currentAdmin } from "@/server/auth";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Entrar al panel", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await connection();
  if (await currentAdmin()) redirect("/admin");
  const { error } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-ink px-4 py-12">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-lg bg-surface p-6 shadow-pop">
        <div className="flex flex-col gap-1">
          <p className="font-display text-lg font-extrabold text-text">
            <span className="text-accent-text">D&apos; Garden</span> Tacos
          </p>
          <h1 className="text-xl text-text">Entrar al panel</h1>
          <p className="text-sm text-text-muted">Te mandamos un enlace a tu correo. Sin contraseñas.</p>
        </div>
        <LoginForm linkError={error === "enlace"} />
      </div>
    </main>
  );
}
