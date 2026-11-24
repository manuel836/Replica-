import { NextResponse, type NextRequest } from "next/server";
import { store } from "@/server/data";
import { retryOutbox } from "@/server/email";
import { safeEqual } from "@/server/tokens";
import { dailyHousekeeping } from "@/server/services/bookings";

// Job diario (Vercel Cron, 14:00 UTC = 08:00 en Lázaro Cárdenas). Protegido con CRON_SECRET.
// Cada paso corre aunque otro falle; la corrida queda en job_runs con su resultado.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (process.env.NODE_ENV === "production" && (!secret || !safeEqual(auth, `Bearer ${secret}`))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const db = store();
  const runId = await db.startJobRun("diario");
  const detail: Record<string, unknown> = {};
  const errors: string[] = [];
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      detail[name] = await fn();
    } catch (e) {
      errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  await step("taquizas", dailyHousekeeping);
  await step("correos", () => retryOutbox(100));
  await step("limpieza", () => db.purgeExpired());
  await db.finishJobRun(runId, errors.length ? "failed" : "ok", detail, errors.join("\n") || null);
  return NextResponse.json({ ok: errors.length === 0, detail, errors }, { status: errors.length ? 500 : 200 });
}
