import { OWNER_STATE, a11y, expect, test } from "./helpers";

// Portada como página de lanzamiento (replica-launch): promesa, preguntas con los ajustes reales
// y llamada final. Nada de pruebas inventadas: no hay testimonios, cifras ni logos de prensa.

test.describe("Portada de lanzamiento", () => {
  test("L-H1 promesa con los 5 arreglos, preguntas con los ajustes reales y llamada final", async ({ page }) => {
    await page.goto("/");
    const promise = page.getByRole("region", { name: "Lo que te prometemos" });
    await expect(promise.getByRole("listitem")).toHaveCount(5);
    await expect(promise).toContainText("Te confirma quien va a servir");

    const faq = page.getByRole("region", { name: "Preguntas frecuentes" });
    await faq.getByText("¿Hasta cuándo me devuelven el anticipo si cancelo?").click();
    await expect(faq).toContainText(/Si cancelas al menos \d+ días antes del evento, te lo devolvemos completo/);
    // Con el teclado también se abre.
    await faq.getByText("¿Con cuánta anticipación tengo que agendar?").focus();
    await page.keyboard.press("Enter");
    await expect(faq).toContainText(/Desde \d+ días? antes/);

    await expect(page.getByText(/miles de clientes|★★★★★|Como se vio en/)).toHaveCount(0);
    await a11y(page, "Portada");

    await page.getByRole("region", { name: "¿Ya tienes fecha?" }).getByRole("link", { name: /Ver fechas disponibles/ }).click();
    await expect(page).toHaveURL(/\/agendar$/);
  });

  test("L-H2 si el dueño cambia el plazo de devolución, la pregunta lo dice", async ({ page, browser }) => {
    const ctx = await browser.newContext({ storageState: OWNER_STATE });
    const admin = await ctx.newPage();
    const setCutoff = async (days: string) => {
      await admin.goto("/admin/ajustes");
      await admin.waitForLoadState("networkidle");
      await admin.getByLabel("Días antes para devolver el anticipo").fill(days);
      await admin.getByRole("button", { name: "Guardar ajustes" }).click();
      await expect(admin.getByText("Ajustes guardados")).toBeVisible();
    };
    await setCutoff("10");
    try {
      await page.goto("/");
      const faq = page.getByRole("region", { name: "Preguntas frecuentes" });
      await faq.getByText("¿Hasta cuándo me devuelven el anticipo si cancelo?").click();
      await expect(faq).toContainText("Si cancelas al menos 10 días antes del evento");
    } finally {
      await setCutoff("7");
      await ctx.close();
    }
  });

  test("L-E1 en celular: sin desborde y axe en la portada completa", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await a11y(page, "Portada 390");
  });
});
