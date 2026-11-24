import "server-only";

// Cloudflare Turnstile (opcional): si hay TURNSTILE_SECRET_KEY, cada solicitud pública debe
// traer un token válido. Sin llave, no se revisa (desarrollo o mientras se configura).
export async function verifyTurnstile(token: string | null | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(8_000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
