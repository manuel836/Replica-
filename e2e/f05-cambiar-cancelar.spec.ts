import { OWNER_STATE, a11y, bookTaquiza, bookingIdByCode, expect, mock, test } from "./helpers";

test.describe("F05 el cliente cambia o cancela", () => {
  test("F05-H1 cambia la fecha y los invitados (y le llega el correo del cambio)", async ({ page }) => {
    const email = `cambio${Date.now()}@correo.test`;
    const { manageUrl } = await bookTaquiza(page, { monthsAhead: 1, dayIndex: 14, email });
    await page.goto(manageUrl);
    await page.getByRole("link", { name: "Cambiar fecha o invitados" }).click();
    await page.waitForURL(/\/cambiar/);
    await page.getByRole("button", { name: "Mes siguiente", exact: true }).click();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    await page.locator('table[role="grid"] button:not([disabled])').nth(2).click();
    const slot = page.locator("fieldset input[type=radio]:not([disabled])").first();
    await slot.waitFor({ state: "attached" });
    await page.locator(`label[for="${await slot.getAttribute("id")}"]`).click();
    await page.getByRole("button", { name: "Agregar 5 invitados" }).click();
    await a11y(page, "S08");
    await page.getByRole("button", { name: /Guardar cambio/ }).click();
    await page.waitForURL((u) => !u.pathname.endsWith("/cambiar"));
    await expect(page.getByText("45 invitados")).toBeVisible();
    await expect(page.getByText("Cambiaste la fecha o los invitados")).toBeVisible();
    await expect.poll(async () => (await mock.emails(email)).map((e) => e.subject).join()).toMatch(/Guardamos el cambio/);
    expect((await mock.emails(email)).find((e) => /Guardamos el cambio/.test(e.subject))!.text).toContain("Invitados: 45");
  });

  test("F05-H2 cancela con anticipo pagado dentro del plazo: se reembolsa en Mercado Pago", async ({ page }) => {
    await bookTaquiza(page, { monthsAhead: 2, dayIndex: 10, payNow: true });
    const before = (await mock.state()).refunds.length;
    await page.getByRole("button", { name: "Cancelar taquiza" }).click();
    await expect(page.getByRole("dialog")).toContainText(/Si cancelas a más tardar el \S+ \d+ de \S+, te devolvemos \$1,800 del anticipo/);
    await page.getByRole("button", { name: "Sí, cancelar" }).click();
    await expect(page.getByText(/Cancelada\. Te devolvemos/)).toBeVisible();
    const after = (await mock.state()).refunds;
    expect(after.length).toBe(before + 1);
    expect(after.at(-1)!.idem).toMatch(/^refund-/);
    await expect(page.getByText(/Te devolvimos/)).toBeVisible();
  });

  test("F05-E1 cancela fuera del plazo de reembolso: lo advierte y no reembolsa", async ({ page, browser, newWatchedPage }) => {
    const ctx = await browser.newContext({ storageState: OWNER_STATE });
    const admin = await newWatchedPage(ctx);
    const setCutoff = async (days: string) => {
      await admin.goto("/admin/ajustes");
      await admin.getByLabel("Días antes para devolver el anticipo").fill(days);
      await admin.getByRole("button", { name: "Guardar ajustes" }).click();
      await expect(admin.getByText("Ajustes guardados")).toBeVisible();
    };
    await setCutoff("365");
    try {
      await bookTaquiza(page, { monthsAhead: 2, dayIndex: 11, payNow: true });
      const before = (await mock.state()).refunds.length;
      await page.getByRole("button", { name: "Cancelar taquiza" }).click();
      await expect(page.getByRole("dialog")).toContainText("ya no es reembolsable");
      await page.getByRole("button", { name: "Sí, cancelar" }).click();
      await expect(page.getByText("Tu taquiza quedó cancelada.")).toBeVisible();
      expect((await mock.state()).refunds.length).toBe(before);
    } finally {
      await setCutoff("7");
      await ctx.close();
    }
  });

  test("F05-N1 enlace viejo después de 'Nuevo enlace' y código inventado no funcionan", async ({ page, browser, newWatchedPage }) => {
    const { code, manageUrl } = await bookTaquiza(page, { monthsAhead: 1, dayIndex: 15 });
    const ctx = await browser.newContext({ storageState: OWNER_STATE });
    const admin = await newWatchedPage(ctx);
    const id = await bookingIdByCode(admin, code);
    await admin.goto(`/admin/t/${id}`);
    await admin.getByRole("button", { name: "Nuevo enlace" }).click();
    await admin.getByRole("dialog").getByRole("button", { name: "Cambiar enlace" }).click();
    await expect(admin.getByText("Enlace nuevo listo")).toBeVisible();
    await page.goto(manageUrl);
    await expect(page.getByRole("heading", { name: "Este enlace no funciona" })).toBeVisible();
    await page.goto("/t/DGT-ZZZZ?k=inventado");
    await expect(page.getByRole("heading", { name: "Este enlace no funciona", level: 1 })).toBeVisible();
    await a11y(page, "enlace inválido");
    await ctx.close();
  });

  test("F05-E2 el archivo de calendario trae la hora en UTC correcta", async ({ page, request }) => {
    const { manageUrl } = await bookTaquiza(page, { monthsAhead: 1, dayIndex: 16 });
    const u = new URL(manageUrl);
    const ics = await request.get(`${u.pathname}/evento.ics${u.search}`);
    expect(ics.headers()["content-type"]).toContain("text/calendar");
    const body = await ics.text();
    const start = body.match(/DTSTART:(\d{8}T\d{6}Z)/)![1];
    // Lázaro Cárdenas = UTC-6 todo el año: las 12:00 locales son las 18:00 UTC.
    const heading = await page.getByRole("heading", { level: 2 }).first().innerText();
    const localHour = Number(heading.match(/(\d{2}):\d{2}/)![1]);
    expect(Number(start.slice(9, 11))).toBe((localHour + 6) % 24);
  });
});
