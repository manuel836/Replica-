import type { Page } from "@playwright/test";
import { OWNER_STATE, bookTaquiza, bookingIdByCode, expect, mock, test } from "./helpers";

// Correos al cliente cuando deja su correo (agregado después de /replica-diff).
// Las respuestas llegan al correo de avisos del negocio (auth.setup.ts lo captura en Ajustes).

const NOTICE = "avisos-dueno@dgarden.test";
const newAddress = () => `cliente${Date.now()}${Math.floor(Math.random() * 1000)}@correo.test`;
const linkIn = (text: string) => text.match(/http:\/\/localhost:3100\/t\/\S+/)?.[0];

async function waitEmail(to: string, subject: RegExp) {
  const matching = async () => (await mock.emails(to)).filter((e) => subject.test(e.subject));
  await expect.poll(async () => (await matching()).length, { message: `correo ${subject} a ${to}` }).toBeGreaterThan(0);
  return (await matching()).at(-1)!;
}

async function ownerPage(browser: import("@playwright/test").Browser, newWatchedPage: (c?: import("@playwright/test").BrowserContext) => Promise<Page>, code: string) {
  const ctx = await browser.newContext({ storageState: OWNER_STATE });
  const admin = await newWatchedPage(ctx);
  const id = await bookingIdByCode(admin, code);
  await admin.goto(`/admin/t/${id}`);
  return { ctx, admin };
}

test.describe("Correos al cliente", () => {
  test("CE-H1 solicitud, confirmación y cancelación llegan por correo con su enlace", async ({ page, browser, newWatchedPage }) => {
    const to = newAddress();
    const { code } = await bookTaquiza(page, { monthsAhead: 1, dayIndex: 5, email: to });

    const received = await waitEmail(to, /Recibimos tu solicitud/);
    expect(received.subject).toContain(code);
    expect(received.replyTo).toBe(NOTICE);
    const link = linkIn(received.text);
    expect(link).toContain(`/t/${code}?k=`);

    const { ctx, admin } = await ownerPage(browser, newWatchedPage, code);
    await admin.getByRole("button", { name: "Aceptar", exact: true }).click();
    await expect(admin.getByText("Taquiza aceptada")).toBeVisible();
    const confirmed = await waitEmail(to, /está confirmada/);
    expect(confirmed.text).toContain("Ahí estaremos el");
    await admin.reload();
    await expect(admin.getByText("Correo al cliente: taquiza confirmada")).toBeVisible();

    // El enlace del correo abre su taquiza; desde ahí cancela y le llega la confirmación.
    await page.goto(link!);
    await page.getByRole("button", { name: "Cancelar taquiza" }).click();
    await page.getByRole("button", { name: "Sí, cancelar" }).click();
    await expect(page.getByText("Tu taquiza quedó cancelada.")).toBeVisible();
    const cancelled = await waitEmail(to, /quedó cancelada/);
    expect(cancelled.text).toContain("Cancelaste tu taquiza");
    await ctx.close();
  });

  test("CE-H2 sin correo no se le manda nada al cliente (solo el aviso al dueño)", async ({ page }) => {
    const { code } = await bookTaquiza(page, { monthsAhead: 1, dayIndex: 6 });
    await expect
      .poll(async () => (await mock.emails()).filter((e) => e.subject.includes(code)).map((e) => e.to))
      .toEqual([NOTICE]);
  });

  test("CE-H3 recordatorio un día antes, una sola vez aunque el job corra dos veces", async ({ page, browser, newWatchedPage, request }) => {
    const to = newAddress();
    const { code, manageUrl } = await bookTaquiza(page, { monthsAhead: 1, dayIndex: 7, email: to });
    const { ctx, admin } = await ownerPage(browser, newWatchedPage, code);

    // Para proponer mañana hay que permitir agendar con 0 días de anticipación (se regresa al final).
    const setNotice = async (days: string) => {
      await admin.goto("/admin/disponibilidad");
      await admin.waitForLoadState("networkidle");
      await admin.getByLabel("Mínimo de días antes").fill(days);
      await admin.getByRole("button", { name: "Guardar disponibilidad" }).click();
      await expect(admin.getByText("Disponibilidad guardada")).toBeVisible();
    };
    await setNotice("0");
    try {
      const id = await bookingIdByCode(admin, code);
      await admin.goto(`/admin/t/${id}`);
      await admin.getByRole("button", { name: "Proponer otra fecha" }).click();
      const dialog = admin.getByRole("dialog");
      const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString("sv-SE", { timeZone: "America/Mexico_City" });
      await dialog.getByLabel("Fecha").fill(tomorrow);
      const slot = dialog.locator("input[type=radio]:not([disabled])").first();
      const open = await slot.waitFor({ state: "attached", timeout: 5_000 }).then(() => true, () => false);
      test.skip(!open, "Mañana no hay horario libre (día cerrado o lleno): no se puede probar hoy.");
      await dialog.locator(`label[for="${await slot.getAttribute("id")}"]`).click();
      await dialog.getByRole("button", { name: "Guardar propuesta" }).click();
      await expect(admin.getByText("Propuesta guardada")).toBeVisible();
      const proposal = await waitEmail(to, /otra fecha/);
      expect(proposal.text).toContain("Acepta o rechaza");

      await page.goto(manageUrl);
      await page.getByRole("button", { name: "Aceptar la nueva fecha" }).click();
      await expect(page.getByText("¡Listo! Aceptaste la nueva fecha.")).toBeVisible();
      await waitEmail(to, /está confirmada/);

      expect((await request.get("/api/cron/diario")).ok()).toBe(true);
      expect((await request.get("/api/cron/diario")).ok()).toBe(true);
      const reminder = await waitEmail(to, /Mañana es tu taquiza/);
      expect(reminder.text).toContain("Mañana,");
      expect((await mock.emails(to)).filter((e) => /Mañana es tu taquiza/.test(e.subject))).toHaveLength(1);
    } finally {
      await setNotice("3");
      await ctx.close();
    }
  });
});
