import { store } from "@/server/data";
import { RecoverForm } from "./RecoverForm";

export const metadata = { title: "Recupera el enlace de tu taquiza", robots: { index: false } };

export default async function RecoverPage() {
  const business = await store().getBusiness();
  return (
    <div className="mx-auto flex w-full max-w-flow flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl text-text md:text-display">¿Perdiste el enlace de tu taquiza?</h1>
        <p className="text-base text-text-muted">
          Escribe el WhatsApp con el que agendaste. Si nos dejaste tu correo, te mandamos ahí el enlace. Sin cuentas ni
          códigos.
        </p>
      </div>
      <RecoverForm businessWhatsapp={business.whatsappE164} />
    </div>
  );
}
