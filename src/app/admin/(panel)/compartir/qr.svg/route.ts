import { currentAdmin } from "@/server/auth";
import { baseUrl } from "@/server/context";
import { qrSvg } from "@/server/share";

// El código QR de tu página de agendar, para imprimirlo (volantes, el puesto, la camioneta).
export async function GET() {
  if (!(await currentAdmin())) return new Response("Tu sesión terminó. Vuelve a entrar.", { status: 401 });
  const svg = await qrSvg(`${await baseUrl()}/agendar`);
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": 'attachment; filename="qr-agendar.svg"',
      "Cache-Control": "no-store",
    },
  });
}
