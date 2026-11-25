import type { Browser, Page } from "@playwright/test";
import { OWNER_STATE, a11y, expect, fillDetails, mock, pickDayAndSlot, test } from "./helpers";

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

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
/** "Domingo 6 de diciembre de 2026" → Date (mediodía UTC). */
const parseEs = (s: string) => {
  const m = s.match(/(\d+) de (\S+) de (\d{4})/)!;
  return new Date(Date.UTC(Number(m[3]), MONTHS.indexOf(m[2].toLowerCase()), Number(m[1]), 12));
};

test.describe("FX3 anticipo claro, con fecha y monto", () => {
  test("FX3-H1 al pagar, en Mi taquiza y en el correo se dice hasta qué día y cuánto se devuelve", async ({ page }) => {
    const email = `anticipo${Date.now()}@correo.test`;
    await pickDayAndSlot(page, { monthsAhead: 2, dayIndex: 18 });
    await page.getByRole("button", { name: "Continuar" }).click();
    await fillDetails(page, { email });
    await page.getByRole("button", { name: "Continuar" }).click();
    const eventDate = parseEs(await page.locator("p", { hasText: "Revisa tu fecha" }).locator("..").innerText());
    const deadline = new Date(eventDate.getTime() - 7 * 86_400_000); // política de demo: 7 días
    const terms = new RegExp(`Si cancelas a más tardar el \\S+ ${deadline.getUTCDate()} de ${MONTHS[deadline.getUTCMonth()]}, te devolvemos los \\$1,800 completos\\.`);
    await expect(page.getByText(terms)).toBeVisible();

    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /Ir a pagar el anticipo/ }).click();
    await page.waitForURL(/localhost:4010\/checkout\//);
    await page.getByRole("button", { name: "Aprobar pago" }).click();
    await page.waitForURL(/\/pago\?resultado=aprobado/);
    await page.getByRole("link", { name: "Ver mi taquiza" }).click();
    const s07 = new RegExp(`Si cancelas a más tardar el \\S+ ${deadline.getUTCDate()} de ${MONTHS[deadline.getUTCMonth()]}, te devolvemos \\$1,800 del anticipo`);
    await expect(page.getByRole("status").filter({ hasText: "Anticipo pagado" })).toContainText(s07);

    await expect
      .poll(async () => (await mock.emails(email)).find((e) => /está confirmada/.test(e.subject))?.text ?? "")
      .toMatch(new RegExp(`te devolvemos tu anticipo de \\$1,800`));
  });

  test("FX3-E1 si faltan menos días que el plazo, se avisa antes de pagar que ya no se devuelve", async ({ page }) => {
    await pickDayAndSlot(page, { monthsAhead: 0, dayIndex: 0 });
    await page.getByRole("button", { name: "Continuar" }).click();
    await fillDetails(page);
    await page.getByRole("button", { name: "Continuar" }).click();
    const eventDate = parseEs(await page.locator("p", { hasText: "Revisa tu fecha" }).locator("..").innerText());
    test.skip(eventDate.getTime() - Date.now() > 7 * 86_400_000, "El primer día libre ya cae fuera del plazo");
    await expect(page.getByText("Faltan menos de 7 días: si después cancelas, el anticipo ya no se devuelve.")).toBeVisible();
  });
});
