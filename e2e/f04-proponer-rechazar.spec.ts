import { OWNER_STATE, bookTaquiza, bookingIdByCode, expect, test } from "./helpers";
import type { Browser, Page } from "@playwright/test";

async function ownerOn(browser: Browser, newWatchedPage: (c?: import("@playwright/test").BrowserContext) => Promise<Page>, code: string) {
  const ctx = await browser.newContext({ storageState: OWNER_STATE });
  const admin = await newWatchedPage(ctx);
  const id = await bookingIdByCode(admin, code);
  await admin.goto(`/admin/t/${id}`);
  return { ctx, admin };
}

async function propose(admin: Page) {
  await admin.getByRole("button", { name: "Proponer otra fecha" }).click();
  const dialog = admin.getByRole("dialog");
  const d = new Date(Date.now() + 75 * 86_400_000).toISOString().slice(0, 10);
  await dialog.getByLabel("Fecha").fill(d);
  const slot = dialog.locator("input[type=radio]:not([disabled])").first();
  await slot.waitFor({ state: "attached" });
  await dialog.locator(`label[for="${await slot.getAttribute("id")}"]`).click();
  await dialog.getByRole("button", { name: "Guardar propuesta" }).click();
  await expect(admin.getByText("Propuesta guardada")).toBeVisible();
}

test.describe("F04 rechazar o proponer otra fecha", () => {
  test("F04-H1 el dueño propone otra fecha y el cliente la acepta", async ({ page, browser, newWatchedPage }) => {
    const { code, manageUrl } = await bookTaquiza(page, { monthsAhead: 1, dayIndex: 11 });
    const { ctx, admin } = await ownerOn(browser, newWatchedPage, code);
    await propose(admin);
    await expect(admin.getByText("Esperando respuesta del cliente")).toBeVisible();
    await page.goto(manageUrl);
    await expect(page.getByRole("status").filter({ hasText: "Te propusimos otra fecha" })).toBeVisible();
    await page.getByRole("button", { name: "Aceptar la nueva fecha" }).click();
    await expect(page.getByText("¡Listo! Aceptaste la nueva fecha.")).toBeVisible();
    await expect(page.getByText("Confirmada").first()).toBeVisible();
    await ctx.close();
  });

  test("F04-H2 el cliente rechaza la propuesta", async ({ page, browser, newWatchedPage }) => {
    const { code, manageUrl } = await bookTaquiza(page, { monthsAhead: 1, dayIndex: 12 });
    const { ctx, admin } = await ownerOn(browser, newWatchedPage, code);
    await propose(admin);
    await page.goto(manageUrl);
    await page.getByRole("button", { name: "No me funciona" }).click();
    await expect(page.getByText("Rechazada").first()).toBeVisible();
    await ctx.close();
  });

  test("F04-H3 el dueño rechaza con motivo y el cliente lo ve", async ({ page, browser, newWatchedPage }) => {
    const { code, manageUrl } = await bookTaquiza(page, { monthsAhead: 1, dayIndex: 13 });
    const { ctx, admin } = await ownerOn(browser, newWatchedPage, code);
    await admin.getByRole("button", { name: "Rechazar", exact: true }).click();
    await admin.getByRole("dialog").getByLabel(/^Motivo para el cliente/).fill("Ese día ya tenemos otro evento.");
    await admin.getByRole("dialog").getByRole("button", { name: "Rechazar", exact: true }).click();
    await expect(admin.getByText("Solicitud rechazada")).toBeVisible();
    await page.goto(manageUrl);
    await expect(page.getByText("Esta vez no pudimos atender tu taquiza")).toBeVisible();
    await expect(page.getByText("Ese día ya tenemos otro evento.")).toBeVisible();
    await ctx.close();
  });
});
