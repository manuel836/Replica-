import { OWNER_STATE, a11y, bookingIdByCode, expect, fillDetails, mock, pickDayAndSlot, test } from "./helpers";

const toStep3 = async (page: import("@playwright/test").Page, o: Parameters<typeof fillDetails>[1] = {}, pick = {}) => {
  await pickDayAndSlot(page, { monthsAhead: 1, ...pick });
  await page.getByRole("button", { name: "Continuar" }).click();
  await fillDetails(page, o);
  await page.getByRole("button", { name: "Continuar" }).click();
};

test.describe("F02 el cliente agenda sin pagar en línea", () => {
  test("F02-H1 solicitud recibida, aparece en el panel y avisa al dueño por correo", async ({ page, browser, newWatchedPage }) => {
    await page.goto("/");
    await a11y(page, "S01");
    await page.getByRole("button", { name: /Ver fechas disponibles/ }).click();
    await page.waitForURL(/\/agendar/);
    await pickDayAndSlot(page, { monthsAhead: 1, dayIndex: 5 });
    await a11y(page, "S03");
    await page.getByRole("button", { name: "Continuar" }).click();
    const name = `Solicitud ${Date.now()}`;
    await fillDetails(page, { name });
    await a11y(page, "S04");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByText("Agendar sin pagar en línea").click();
    await page.getByRole("checkbox").check();
    await a11y(page, "S05");
    await page.getByRole("button", { name: "Enviar solicitud" }).click();
    await expect(page.getByRole("heading", { name: "Recibimos tu solicitud" })).toBeVisible();
    await a11y(page, "S06");
    const code = new URL(page.url()).pathname.split("/")[2];

    const mails = await mock.emails("avisos-dueno@dgarden.test");
    expect(mails.some((m) => m.subject === `Nueva solicitud ${code}`)).toBe(true);

    const ctx = await browser.newContext({ storageState: OWNER_STATE });
    const admin = await newWatchedPage(ctx);
    await admin.goto("/admin?tab=pendientes");
    await expect(admin.locator('main a[href^="/admin/t/"]').filter({ hasText: name })).toHaveCount(1);
    await ctx.close();
  });

  test("F02-E1 campos vacíos: marca los 5 obligatorios y enfoca el primero", async ({ page }) => {
    await pickDayAndSlot(page, { monthsAhead: 1 });
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.locator("[aria-invalid='true']")).toHaveCount(5);
    await expect(page.getByLabel("Tu nombre")).toBeFocused();
    await a11y(page, "S04 con errores");
  });

  test("F02-E2 nombre de 81 caracteres: el servidor lo rechaza y señala el campo", async ({ page }) => {
    await toStep3(page, { name: "N".repeat(81) });
    await page.getByText("Agendar sin pagar en línea").click();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Enviar solicitud" }).click();
    await expect(page.getByRole("heading", { name: "Paso 2 de 3: Datos del evento" })).toBeVisible();
    await expect(page.getByText("Máximo 80 caracteres.")).toBeVisible();
  });

  test("F02-E3 acentos y emoji llegan intactos al panel y al WhatsApp", async ({ page, browser, newWatchedPage }) => {
    const name = "José Ñúñez Gutiérrez 🌮";
    await toStep3(page, { name, notes: "Sin cebolla, por favor 🙏 — gracias" });
    await page.getByText("Agendar sin pagar en línea").click();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Enviar solicitud" }).click();
    await expect(page.getByText(`A nombre de ${name}`)).toBeVisible();
    const code = new URL(page.url()).pathname.split("/")[2];

    const ctx = await browser.newContext({ storageState: OWNER_STATE });
    const admin = await newWatchedPage(ctx);
    const id = await bookingIdByCode(admin, code);
    await admin.goto(`/admin/t/${id}`);
    await expect(admin.getByRole("heading", { level: 1 })).toHaveText(name);
    await expect(admin.getByText("Sin cebolla, por favor 🙏 — gracias")).toBeVisible();
    await ctx.close();
  });

  test("F02-E4 WhatsApp: rechaza 5 dígitos y acepta +52 con espacios", async ({ page }) => {
    await pickDayAndSlot(page, { monthsAhead: 1 });
    await page.getByRole("button", { name: "Continuar" }).click();
    await fillDetails(page, { phone: "75312" });
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText("Escribe los 10 dígitos de tu WhatsApp.")).toBeVisible();
    await page.getByLabel("WhatsApp").fill("+52 753 123 4567");
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("heading", { name: "Paso 3 de 3: Pago" })).toBeVisible();
  });

  test("F02-E5 botón Atrás del navegador: regresa de paso sin perder datos", async ({ page }) => {
    await toStep3(page, { name: "Cliente Atrás" });
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Paso 2 de 3: Datos del evento" })).toBeVisible();
    await expect(page.getByLabel("Tu nombre")).toHaveValue("Cliente Atrás");
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Paso 1 de 3: Fecha y hora" })).toBeVisible();
    await expect(page.locator("fieldset input[type=radio]:checked")).toHaveCount(1);
  });

  test("F02-E6 recargar la página a mitad: no se pierden los datos", async ({ page }) => {
    await pickDayAndSlot(page, { monthsAhead: 1 });
    await page.getByRole("button", { name: "Continuar" }).click();
    await fillDetails(page, { name: "Cliente Recarga" });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Paso 2 de 3: Datos del evento" })).toBeVisible();
    await expect(page.getByLabel("Tu nombre")).toHaveValue("Cliente Recarga");
  });

  test("F02-E7 se puede agendar solo con teclado", async ({ page }) => {
    const tabTo = async (pred: () => boolean, what: string) => {
      for (let i = 0; i < 60; i++) {
        await page.keyboard.press("Tab");
        if (await page.evaluate(pred)) return;
      }
      throw new Error(`No llegué con Tab a ${what}`);
    };
    await page.goto("/agendar?invitados=30");
    await page.getByRole("button", { name: "Mes siguiente", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    await tabTo(() => !!document.activeElement?.closest('table[role="grid"]'), "el calendario");
    for (let i = 0; i < 40; i++) {
      if (await page.evaluate(() => !(document.activeElement as HTMLButtonElement).disabled)) break;
      await page.keyboard.press("ArrowRight");
    }
    await page.keyboard.press("Enter");
    await page.waitForSelector("fieldset input[type=radio]:not([disabled])", { state: "attached" });
    await tabTo(() => document.activeElement?.matches("input[type=radio]") ?? false, "los horarios");
    await page.keyboard.press("Space");
    await tabTo(() => document.activeElement?.textContent?.includes("Continuar") ?? false, "Continuar");
    await page.keyboard.press("Enter");
    const typeInto = async (label: string, text: string) => {
      await page.evaluate((l) => ((window as unknown as { __want: string }).__want = l), label);
      await tabTo(() => {
        const el = document.activeElement;
        return !!(el?.id && document.querySelector(`label[for="${el.id}"]`)?.textContent?.startsWith((window as unknown as { __want: string }).__want));
      }, label);
      await page.keyboard.type(text);
    };
    await typeInto("Tu nombre", "Solo Teclado");
    await typeInto("WhatsApp", `753${Date.now().toString().slice(-7)}`);
    await page.evaluate(() => ((window as unknown as { __want: string }).__want = "Zona"));
    await tabTo(() => document.activeElement?.tagName === "SELECT" && !!document.querySelector(`label[for="${document.activeElement.id}"]`)?.textContent?.startsWith("Zona"), "Zona");
    await page.keyboard.press("ArrowDown");
    await typeInto("Calle y número", "Calle Teclado 5");
    await typeInto("Colonia", "Centro");
    await tabTo(() => document.activeElement?.textContent?.includes("Continuar") ?? false, "Continuar 2");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Paso 3 de 3: Pago" })).toBeVisible();
    await tabTo(() => document.activeElement?.matches("input[type=radio]") ?? false, "forma de pago");
    await page.keyboard.press("ArrowDown");
    await tabTo(() => document.activeElement?.matches("input[type=checkbox]") ?? false, "políticas");
    await page.keyboard.press("Space");
    await tabTo(() => document.activeElement?.textContent?.includes("Enviar solicitud") ?? false, "Enviar");
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/t\/DGT-/);
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)).toBe("solid");
  });

  test("F02-E8 en celular (390 px): sin desborde y accesible en cada paso", async ({ browser, newWatchedPage }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "es-MX", timezoneId: "America/Mexico_City", extraHTTPHeaders: { "x-forwarded-for": "10.8.8.8" } });
    const p = await newWatchedPage(ctx);
    const overflow = () => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await p.goto("/");
    expect(await overflow()).toBe(0);
    await pickDayAndSlot(p, { monthsAhead: 1, dayIndex: 6 });
    expect(await overflow()).toBe(0);
    await a11y(p, "S03 en celular");
    await p.getByRole("button", { name: "Continuar" }).click();
    await fillDetails(p, { name: "Cliente Celular" });
    expect(await overflow()).toBe(0);
    await p.getByRole("button", { name: "Continuar" }).click();
    expect(await overflow()).toBe(0);
    await a11y(p, "S05 en celular");
    await ctx.close();
  });

  test("F02-N1 sin aceptar las políticas no se envía", async ({ page }) => {
    await toStep3(page);
    await page.getByText("Agendar sin pagar en línea").click();
    await page.getByRole("button", { name: "Enviar solicitud" }).click();
    await expect(page.getByText("Necesitas aceptar las políticas para continuar.")).toBeVisible();
    await expect(page).toHaveURL(/\/agendar/);
  });

  test("F02-N2 más de 3 solicitudes del mismo WhatsApp en una hora: lo frena", async ({ page }) => {
    const phone = `753${Date.now().toString().slice(-7)}`;
    for (let i = 0; i < 3; i++) {
      await toStep3(page, { phone, name: `Repetido ${i}` }, { monthsAhead: 2, dayIndex: 5 + i });
      await page.getByText("Agendar sin pagar en línea").click();
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "Enviar solicitud" }).click();
      await page.waitForURL(/\/t\/DGT-/);
    }
    await toStep3(page, { phone, name: "Repetido 4" }, { monthsAhead: 2, dayIndex: 9 });
    await page.getByText("Agendar sin pagar en línea").click();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Enviar solicitud" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Ya recibimos varias solicitudes de este número" })).toBeVisible();
  });
});
