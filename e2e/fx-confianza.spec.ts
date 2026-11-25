import type { Browser, Page } from "@playwright/test";
import { OWNER_STATE, a11y, expect, fillDetails, pickDayAndSlot, test } from "./helpers";

// Arreglos de /replica-entrepreneur (replica/fixes.md): que el cliente siempre sepa qué apartó.

async function setDailyGuestLimit(browser: Browser, value: string) {
  const ctx = await browser.newContext({ storageState: OWNER_STATE });
  const admin = await ctx.newPage();
  await admin.goto("/admin/disponibilidad");
  await admin.waitForLoadState("networkidle");
  await admin.getByLabel(/^Invitados por día \(máximo\)/).fill(value);
  await admin.getByRole("button", { name: "Guardar disponibilidad" }).click();
  await expect(admin.getByText("Disponibilidad guardada")).toBeVisible();
  await ctx.close();
}

const typeGuests = async (page: Page, n: number) => {
  const input = page.getByLabel("Invitados", { exact: true });
  await input.fill(String(n));
  await input.blur();
};

test.describe("FX1 la fecha no cambia sola", () => {
  test("FX1-H1 el último paso repite la fecha con año y el botón dice día y hora", async ({ page }) => {
    const when = await pickDayAndSlot(page, { monthsAhead: 1, dayIndex: 2 });
    const time = when.match(/(\d{2}:\d{2})/)![1];
    await page.getByRole("button", { name: "Continuar" }).click();
    await fillDetails(page);
    await page.getByRole("button", { name: "Continuar" }).click();
    const review = page.locator("p", { hasText: "Revisa tu fecha" }).locator("..");
    await expect(review).toContainText(/de 20\d\d · \d{2}:\d{2}/);
    await expect(review).toContainText(time);
    await expect(page.getByRole("button", { name: new RegExp(`^(Enviar solicitud|Ir a pagar el anticipo) · .+, ${time}$`) })).toBeVisible();
    await a11y(page, "S05 con fecha");
    await page.getByRole("button", { name: "Cambiar", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Paso 1 de 3: Fecha y hora" })).toBeVisible();
  });

  test("FX1-E1 si al subir invitados el día ya no tiene lugar, se avisa en vez de soltarlo callado", async ({ page, browser }) => {
    await setDailyGuestLimit(browser, "100");
    try {
      await pickDayAndSlot(page, { monthsAhead: 1, dayIndex: 4, guests: 40 });
      await typeGuests(page, 150);
      await expect(page.getByRole("status").filter({ hasText: "ya no tiene lugar para 150 invitados" })).toBeVisible();
      await expect(page.locator("fieldset input[type=radio]:checked")).toHaveCount(0);
      // Al elegir otra fecha el aviso se va.
      await typeGuests(page, 40);
      await page.locator('table[role="grid"] button:not([disabled])').first().click();
      await expect(page.getByText("Cambió la disponibilidad")).toHaveCount(0);
    } finally {
      await setDailyGuestLimit(browser, "");
    }
  });
});
