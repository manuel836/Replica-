import { HELPER, OWNER_STATE, a11y, bookTaquiza, bookingIdByCode, emailLogin, expect, mock, test } from "./helpers";

// Reembolsos del anticipo desde el detalle de la taquiza (S12).

test.describe("S12 reembolsos", () => {
  test("S12-N0 (BUG-008) tras un reembolso completo, 'Pagado' queda en $0, no en negativo", async ({ page, browser, newWatchedPage }) => {
    const { code } = await bookTaquiza(page, { monthsAhead: 2, dayIndex: 13, payNow: true });
    await page.getByRole("button", { name: "Cancelar taquiza" }).click();
    await page.getByRole("button", { name: "Sí, cancelar" }).click();
    await expect(page.getByText(/Cancelada\. Te devolvemos/)).toBeVisible();

    const ctx = await browser.newContext({ storageState: OWNER_STATE });
    const admin = await newWatchedPage(ctx);
    await admin.goto(`/admin/t/${await bookingIdByCode(admin, code)}`);
    await expect(admin.getByText(/^Pagado:/)).toContainText("Pagado: $0 ");
    await ctx.close();
  });

  test("S12-H1 el dueño reembolsa una parte; al cancelar se devuelve solo lo que falta", async ({ page, browser, newWatchedPage }) => {
    const { code } = await bookTaquiza(page, { monthsAhead: 2, dayIndex: 15, payNow: true });
    const ctx = await browser.newContext({ storageState: OWNER_STATE });
    const admin = await newWatchedPage(ctx);
    await admin.goto(`/admin/t/${await bookingIdByCode(admin, code)}`);
    await expect(admin.getByText(/^Pagado:/)).toContainText("Pagado: $1,800 ");
    const before = (await mock.state()).refunds.length;

    await admin.getByRole("button", { name: "Reembolsar parte del anticipo" }).click();
    const dialog = admin.getByRole("dialog");
    await expect(dialog).toContainText("Puedes reembolsar hasta $1,800");
    await a11y(admin, "S12 reembolso");

    // Más de lo pagado y cero: no se aceptan.
    await dialog.getByLabel("Monto en pesos").fill("2000");
    await dialog.getByRole("button", { name: "Reembolsar" }).click();
    await expect(dialog.getByText("Puedes reembolsar hasta $1,800.")).toBeVisible();
    await dialog.getByLabel("Monto en pesos").fill("0");
    await dialog.getByRole("button", { name: "Reembolsar" }).click();
    await expect(dialog.getByText("Escribe un monto mayor a cero.")).toBeVisible();
    expect((await mock.state()).refunds.length).toBe(before);

    await dialog.getByLabel("Monto en pesos").fill("500");
    await dialog.getByLabel(/^Motivo/).fill("Llegamos 40 minutos tarde");
    await dialog.getByRole("button", { name: "Reembolsar" }).click();
    await expect(admin.locator("[data-sonner-toast]").filter({ hasText: "Reembolsaste $500" })).toBeVisible();
    await expect(admin.getByText(/^Pagado:/)).toContainText("Pagado: $1,300 ");
    let refunds = (await mock.state()).refunds;
    expect(refunds.length).toBe(before + 1);
    expect(refunds.at(-1)!.resp.amount).toBe(500);

    // Cancelar después devuelve los $1,300 que faltan, no los $1,800.
    await admin.getByRole("button", { name: "Cancelar taquiza" }).click();
    await admin.getByRole("dialog").getByLabel(/^Motivo para el cliente/).fill("Cambio de planes");
    await admin.getByRole("dialog").getByRole("button", { name: /^Sí, cancelar/ }).click();
    await expect(admin.getByText(/^Pagado:/)).toContainText("Pagado: $0 ");
    refunds = (await mock.state()).refunds;
    expect(refunds.length).toBe(before + 2);
    expect(refunds.at(-1)!.resp.amount).toBe(1300);
    await expect(admin.getByRole("button", { name: "Reembolsar parte del anticipo" })).toHaveCount(0);
    await ctx.close();
  });

  test("S12-N1 el ayudante no ve el botón de reembolso", async ({ page, browser, newWatchedPage }) => {
    const { code } = await bookTaquiza(page, { monthsAhead: 2, dayIndex: 16, payNow: true });
    // Sesión nueva: F11-E1 cierra las sesiones guardadas del ayudante.
    const ctx = await browser.newContext();
    const helper = await newWatchedPage(ctx);
    await emailLogin(helper, HELPER);
    await helper.goto(`/admin/t/${await bookingIdByCode(helper, code)}`);
    await expect(helper.getByText(/^Pagado:/)).toContainText("Pagado: $1,800 ");
    await expect(helper.getByRole("button", { name: "Reembolsar parte del anticipo" })).toHaveCount(0);
    await ctx.close();
  });
});
