import { OWNER_STATE, a11y, bookTaquiza, bookingIdByCode, emailLogin, expect, manageUrlFromPanel, mock, test } from "./helpers";

test.describe("F09 recordatorios y job diario", () => {
  test.use({ storageState: OWNER_STATE });

  test("F09-H1 'Recordatorios de mañana' prepara el WhatsApp de recordatorio", async ({ page, request }) => {
    await page.goto("/admin");
    const box = page.getByRole("region", { name: "Recordatorios de mañana" });
    await expect(box).toContainText("Cliente de prueba 3");
    const href = await box.getByRole("link", { name: /Recordar/ }).first().getAttribute("href");
    const r = await request.get(href!, { maxRedirects: 0 });
    expect(decodeURIComponent(r.headers()["location"])).toContain("Mañana es tu taquiza");
  });

  test("F09-H2 el job diario corre y queda registrado", async ({ request }) => {
    const r = await request.get("/api/cron/diario");
    const body = await r.json();
    expect(r.status()).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.detail.taquizas).toBeTruthy();
  });

  test("F09-E1 con el correo caído no se pierde el aviso: el job lo reintenta", async ({ page, request }) => {
    await mock.failEmail(true);
    const before = (await mock.emails("avisos-dueno@dgarden.test")).length;
    try {
      const customer = page;
      await bookTaquiza(customer, { monthsAhead: 1, dayIndex: 18 });
      expect((await mock.emails("avisos-dueno@dgarden.test")).length).toBe(before);
    } finally {
      await mock.failEmail(false);
    }
    // El primer reintento es a 1 minuto; el job solo toma los vencidos, así que esperamos.
    await expect
      .poll(async () => {
        await request.get("/api/cron/diario");
        return (await mock.emails("avisos-dueno@dgarden.test")).length;
      }, { timeout: 90_000, intervals: [5_000, 10_000, 15_000, 20_000, 30_000] })
      .toBeGreaterThan(before);
  });
});

test.describe("F10 después del evento", () => {
  test("F10-H1 completar → reseña del cliente → publicar → aparece en la página", async ({ page, browser, newWatchedPage }) => {
    const { code } = await bookTaquiza(page, { monthsAhead: 1, dayIndex: 19 });
    const ctx = await browser.newContext({ storageState: OWNER_STATE });
    const admin = await newWatchedPage(ctx);
    const id = await bookingIdByCode(admin, code);
    await admin.goto(`/admin/t/${id}`);
    await admin.getByRole("button", { name: "Aceptar", exact: true }).click();
    await expect(admin.getByText("Taquiza aceptada")).toBeVisible();
    await admin.getByRole("button", { name: "Completada" }).click();
    await expect(admin.getByText("Marcada como completada")).toBeVisible();
    const review = (await manageUrlFromPanel(ctx.request, id, "review_request")).replace(/\?k=/, "?k=");
    expect(review).toContain("/resena?k=");
    await page.goto(review);
    await a11y(page, "S19");
    const comment = `Muy ricos los tacos ${Date.now()}`;
    await page.getByRole("button", { name: "Enviar reseña" }).click();
    await expect(page.getByText("Elige de 1 a 5 estrellas.")).toBeVisible();
    await page.locator("label").filter({ hasText: "5 estrellas" }).click();
    await page.getByLabel(/^Cuéntanos más/).fill(comment);
    await page.getByRole("button", { name: "Enviar reseña" }).click();
    await expect(page.getByText("¡Gracias por tu reseña!")).toBeVisible();

    await admin.goto("/admin");
    const queue = admin.getByRole("region", { name: "Reseñas nuevas" });
    await queue.getByRole("listitem").filter({ hasText: comment }).getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(admin.getByText("Reseña publicada")).toBeVisible();
    await page.goto("/");
    await expect(page.getByText(comment)).toBeVisible();
    await ctx.close();
  });

  test("F10-N1 reseña antes del evento: todavía no se puede", async ({ page }) => {
    const { manageUrl } = await bookTaquiza(page, { monthsAhead: 1, dayIndex: 20 });
    await page.goto(manageUrl.replace(/\/t\/(DGT-[A-Z0-9]+)\?/, "/t/$1/resena?"));
    await expect(page.getByRole("heading", { name: "Todavía no es momento", level: 1 })).toBeVisible();
    await a11y(page, "reseña antes del evento");
  });

  test("F10-E1 'No publicar' saca la reseña de la cola y no vuelve a aparecer", async ({ page, browser, newWatchedPage }) => {
    const { code } = await bookTaquiza(page, { monthsAhead: 1, dayIndex: 21 });
    const ctx = await browser.newContext({ storageState: OWNER_STATE });
    const admin = await newWatchedPage(ctx);
    const id = await bookingIdByCode(admin, code);
    await admin.goto(`/admin/t/${id}`);
    await admin.getByRole("button", { name: "Aceptar", exact: true }).click();
    await expect(admin.getByText("Taquiza aceptada")).toBeVisible();
    await admin.getByRole("button", { name: "Completada" }).click();
    await expect(admin.getByText("Marcada como completada")).toBeVisible();
    await page.goto(await manageUrlFromPanel(ctx.request, id, "review_request"));
    const comment = `No me gustó ${Date.now()}`;
    await page.locator("label").filter({ hasText: "2 estrellas" }).click();
    await page.getByLabel(/^Cuéntanos más/).fill(comment);
    await page.getByRole("button", { name: "Enviar reseña" }).click();
    await expect(page.getByText("¡Gracias por tu reseña!")).toBeVisible();

    await admin.goto("/admin");
    const item = admin.getByRole("region", { name: "Reseñas nuevas" }).getByRole("listitem").filter({ hasText: comment });
    await item.getByRole("button", { name: "No publicar" }).click();
    await expect(admin.getByText("Reseña guardada sin publicar")).toBeVisible();
    await admin.reload();
    await expect(admin.getByText(comment)).toHaveCount(0);
    await ctx.close();
  });

  test("F10-H2 registrar el saldo en efectivo baja lo que falta por cobrar", async ({ page, browser, newWatchedPage }) => {
    const { code } = await bookTaquiza(page, { monthsAhead: 1, dayIndex: 22, guests: 40 });
    const ctx = await browser.newContext({ storageState: OWNER_STATE });
    const admin = await newWatchedPage(ctx);
    const id = await bookingIdByCode(admin, code);
    await admin.goto(`/admin/t/${id}`);
    await expect(admin.getByText("Por cobrar: $6,000")).toBeVisible();
    await admin.getByRole("button", { name: "Registrar pago en efectivo o transferencia" }).click();
    const dialog = admin.getByRole("dialog");
    await dialog.getByLabel("Concepto").selectOption("deposit");
    await dialog.getByLabel("Monto en pesos").fill("1800");
    await dialog.getByRole("button", { name: "Guardar pago" }).click();
    await expect(admin.getByText("Pago registrado")).toBeVisible();
    await expect(admin.getByText("Por cobrar: $4,200")).toBeVisible();
    await ctx.close();
  });
});

test.describe("F11 acceso al panel", () => {
  test("F11-N3 sin sesión, el panel manda a entrar", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/entrar/);
    await a11y(page, "S10");
  });

  test("F11-H1/N1 el enlace del correo entra una sola vez", async ({ page, newWatchedPage }) => {
    const link = await emailLogin(page, "dueno@dgarden.test");
    await expect(page).toHaveURL("/admin");
    const other = await newWatchedPage();
    await other.goto(link);
    await other.getByRole("button", { name: "Entrar" }).click();
    await expect(other).toHaveURL(/\/admin\/entrar\?error=enlace/);
    await expect(other.getByText("Ese enlace ya no sirve")).toBeVisible();
  });

  test("F11-N2 correo desconocido: misma respuesta y no sale ningún correo", async ({ page }) => {
    const before = (await mock.emails()).length;
    await page.goto("/admin/entrar");
    await page.getByLabel("Correo").fill("nadie@ejemplo.test");
    await page.getByRole("button", { name: /Mandarme el enlace/ }).click();
    await expect(page.getByText("Revisa tu correo")).toBeVisible();
    expect((await mock.emails()).length).toBe(before);
  });

  test("F11-E1 'cerrar sesión en todos lados' también sirve para el ayudante", async ({ page, newWatchedPage }) => {
    await emailLogin(page, "ayudante@dgarden.test");
    const other = await newWatchedPage();
    await emailLogin(other, "ayudante@dgarden.test");
    await page.getByRole("link", { name: "Mi cuenta" }).click();
    await page.getByRole("button", { name: /Cerrar sesión en todos lados/ }).click();
    await expect(page).toHaveURL(/aviso=todas/);
    await other.goto("/admin");
    await expect(other).toHaveURL(/\/admin\/entrar/);
  });
});
