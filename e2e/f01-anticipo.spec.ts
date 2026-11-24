import { OWNER_STATE, a11y, bookTaquiza, bookingIdByCode, expect, fillDetails, mock, pickDayAndSlot, test } from "./helpers";

test.describe("F01 el cliente agenda pagando el anticipo en línea", () => {
  test("F01-H1 paga el anticipo y la taquiza queda confirmada (cliente y panel)", async ({ page, browser, newWatchedPage }) => {
    const { code } = await bookTaquiza(page, { payNow: true, monthsAhead: 1 });
    await expect(page.getByText("Confirmada").first()).toBeVisible();
    await expect(page.getByText(/Anticipo pagado/)).toBeVisible();
    await a11y(page, "S07 confirmada");

    const ctx = await browser.newContext({ storageState: OWNER_STATE });
    const admin = await newWatchedPage(ctx);
    const id = await bookingIdByCode(admin, code);
    await admin.goto(`/admin/t/${id}`);
    await expect(admin.getByRole("main").getByText("Confirmada").first()).toBeVisible();
    await expect(admin.getByRole("list", { name: "Pagos" }).getByText(/Anticipo · tarjeta · aprobado/)).toHaveCount(1);
    await ctx.close();
  });

  test("F01-N1 tarjeta rechazada: avisa, no confirma y deja reintentar", async ({ page }) => {
    await pickDayAndSlot(page, { monthsAhead: 1, dayIndex: 1 });
    await page.getByRole("button", { name: "Continuar" }).click();
    await fillDetails(page, { name: "Cliente Rechazo" });
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Ir a pagar el anticipo" }).click();
    await page.getByRole("button", { name: "Rechazar pago" }).click();
    await page.waitForURL(/\/pago\?resultado=rechazado/);
    await expect(page.getByRole("heading", { name: "El pago no pasó" })).toBeVisible();
    await a11y(page, "regreso de pago rechazado");
    await page.getByRole("button", { name: "Intentar de nuevo" }).click();
    await page.getByRole("button", { name: "Aprobar pago" }).click();
    await expect(page.getByRole("heading", { name: /Pago recibido/ })).toBeVisible();
  });

  test("F01-E1 doble clic en enviar crea una sola taquiza", async ({ page, browser, newWatchedPage }) => {
    const name = `Doble Clic ${Date.now()}`;
    await pickDayAndSlot(page, { monthsAhead: 2 });
    await page.getByRole("button", { name: "Continuar" }).click();
    await fillDetails(page, { name });
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByText("Agendar sin pagar en línea").click();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Enviar solicitud" }).dblclick();
    await page.waitForURL(/\/t\/DGT-/);

    const ctx = await browser.newContext({ storageState: OWNER_STATE });
    const admin = await newWatchedPage(ctx);
    await admin.goto("/admin?tab=pendientes");
    await expect(admin.locator('main a[href^="/admin/t/"]').filter({ hasText: name })).toHaveCount(1);
    await ctx.close();
  });

  test("F01-E2 dos clientes piden el mismo horario a la vez: solo uno lo obtiene", async ({ page, newWatchedPage }) => {
    const other = await newWatchedPage();
    const prepare = async (p: typeof page, n: number) => {
      const when = await pickDayAndSlot(p, { monthsAhead: 3, dayIndex: 2 });
      await p.getByRole("button", { name: "Continuar" }).click();
      await fillDetails(p, { name: `Carrera ${n}` });
      await p.getByRole("button", { name: "Continuar" }).click();
      await p.getByText("Agendar sin pagar en línea").click();
      await p.getByRole("checkbox").check();
      return when;
    };
    const [a, b] = await Promise.all([prepare(page, 1), prepare(other, 2)]);
    expect(a).toBe(b);
    await Promise.all([page, other].map((p) => p.getByRole("button", { name: "Enviar solicitud" }).click()));
    const outcome = async (p: typeof page) => {
      await expect(p.locator("body")).toContainText(/Recibimos tu solicitud|No pudimos guardar/);
      return p.url().includes("/t/DGT-") ? "agendada" : "rechazada";
    };
    expect([await outcome(page), await outcome(other)].sort()).toEqual(["agendada", "rechazada"]);
    const loser = page.url().includes("/t/DGT-") ? other : page;
    await expect(loser.getByRole("heading", { name: "Paso 1 de 3: Fecha y hora" })).toBeVisible();
    await expect(loser.getByRole("alert").filter({ hasText: /ocupar|lleno/ })).toBeVisible();
    // Sus datos siguen ahí al volver a elegir hora.
    await loser.locator("fieldset input[type=radio]:not([disabled])").first().evaluate((el: HTMLInputElement) => el.click());
    await loser.getByRole("button", { name: "Continuar" }).click();
    await expect(loser.getByLabel("Tu nombre")).toHaveValue(/Carrera/);
  });

  test("F01-E3 sin conexión al enviar: avisa y deja volver a intentar", async ({ page, context, problems }) => {
    await pickDayAndSlot(page, { monthsAhead: 2, dayIndex: 3 });
    await page.getByRole("button", { name: "Continuar" }).click();
    await fillDetails(page, { name: "Cliente Sin Red" });
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByText("Agendar sin pagar en línea").click();
    await page.getByRole("checkbox").check();
    await context.setOffline(true);
    const send = page.getByRole("button", { name: "Enviar solicitud" });
    await send.click();
    await expect(page.getByRole("alert").filter({ hasText: /conexión/i })).toBeVisible();
    await expect(send).toBeEnabled();
    await context.setOffline(false);
    // Los errores de red del navegador son esperados aquí.
    problems.splice(0, problems.length, ...problems.filter((p) => !/Failed to fetch|ERR_INTERNET_DISCONNECTED|network/i.test(p)));
    await send.click();
    await page.waitForURL(/\/t\/DGT-/);
  });

  test("F01-E4 regreso del pago en otro dispositivo: mensaje neutro, sin datos", async ({ newWatchedPage }) => {
    const p = await newWatchedPage();
    await p.goto("/t/DGT-SEED1/pago?resultado=aprobado");
    await expect(p.getByRole("heading", { name: "Estamos revisando tu pago" })).toBeVisible();
  });

  test("F01-E5 cliente con el teléfono en otra zona horaria: se guarda la fecha y hora que eligió", async ({ browser, newWatchedPage }) => {
    const ctx = await browser.newContext({ locale: "es-MX", timezoneId: "Asia/Tokyo", extraHTTPHeaders: { "x-forwarded-for": "10.9.9.9" } });
    const p = await newWatchedPage(ctx);
    const { when } = await bookTaquiza(p, { monthsAhead: 2, dayIndex: 4 });
    // "Viernes 15 de enero a las 14:00" → la página muestra "viernes 15 de enero · 14:00"
    const [, day, time] = when.match(/(\d+ de \w+) a las (\d{2}:\d{2})/)!;
    await expect(p.getByRole("heading", { level: 2 }).filter({ hasText: day })).toContainText(time);
    await ctx.close();
  });

  test("F01-H2 la preferencia de pago sale bien armada y sin el token del cliente", async ({ page }) => {
    await pickDayAndSlot(page, { monthsAhead: 3, dayIndex: 0 });
    await page.getByRole("button", { name: "Continuar" }).click();
    await fillDetails(page, { name: "Cliente Preferencia" });
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Ir a pagar el anticipo" }).click();
    await page.waitForURL(/localhost:4010\/checkout\//);
    const id = page.url().match(/pref-[\w-]+/)![0];
    const pref = (await mock.state()).prefs[id];
    expect(pref.body.items[0].currency_id).toBe("MXN");
    expect(pref.body.binary_mode).toBe(true);
    expect(pref.body.payment_methods.excluded_payment_types.map((t) => t.id).sort()).toEqual(["atm", "bank_transfer", "ticket"]);
    expect(pref.body.notification_url).toMatch(/\/api\/webhooks\/mercadopago$/);
    expect(pref.idem).toBeTruthy();
    expect(JSON.stringify(pref.body)).not.toContain("?k=");
  });
});
