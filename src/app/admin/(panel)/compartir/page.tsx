import { Download } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { requireAdminPage } from "@/server/auth";
import { baseUrl } from "@/server/context";
import { store } from "@/server/data";
import { qrSvg, shareTexts } from "@/server/share";
import { CopyBlock } from "./CopyBlock";

export const metadata = { title: "Comparte tu página" };

export default async function SharePage() {
  await requireAdminPage();
  const business = await store().getBusiness();
  const link = `${await baseUrl()}/agendar`;
  const qr = `data:image/svg+xml;utf8,${encodeURIComponent(await qrSvg(link))}`;
  const texts = shareTexts(business, link);

  return (
    <div className="mx-auto flex max-w-flow flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl text-text">Comparte tu página</h1>
        <p className="text-sm text-text-muted">
          Pon este enlace en tu Facebook, tu Instagram y tu WhatsApp. Las taquizas que llegan por aquí son directo contigo: sin
          comisión por invitado y con los datos del cliente en tu panel.
        </p>
      </div>

      <section aria-labelledby="enlace" className="flex flex-col gap-3">
        <h2 id="enlace" className="text-lg text-text">
          Tu enlace para agendar
        </h2>
        <CopyBlock label="Tu enlace para agendar" text={link} mono />
      </section>

      <section aria-labelledby="qr" className="flex flex-col gap-3">
        <h2 id="qr" className="text-lg text-text">
          Código QR
        </h2>
        <p className="text-sm text-text-muted">Para imprimir en volantes, en tu puesto o en la camioneta. Se abre con la cámara del celular.</p>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG generado aquí mismo */}
          <img src={qr} alt={`Código QR que abre ${link}`} className="size-48 rounded-md border border-border bg-surface" />
          <ButtonLink variant="secondary" href="/admin/compartir/qr.svg" download>
            <Download aria-hidden className="size-4" />
            Descargar QR
          </ButtonLink>
        </div>
      </section>

      <section aria-labelledby="textos" className="flex flex-col gap-3">
        <h2 id="textos" className="text-lg text-text">
          Textos listos
        </h2>
        {texts.map((t) => (
          <CopyBlock key={t.id} label={t.label} text={t.text} />
        ))}
      </section>
    </div>
  );
}
