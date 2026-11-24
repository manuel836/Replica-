import { HELPER_STATE, OWNER_STATE, a11y, bookTaquiza, bookingIdByCode, expect, test } from "./helpers";

test.describe("F03 el dueño revisa y acepta", () => {
  test("F03-H1 acepta y el WhatsApp sale con el enlace correcto", async ({ page, browser, newWatchedPage }) => {
    const { code } = await bookTaquiza(page, { monthsAhead: 1, dayIndex: 7 });
    const ctx = await browser.newContext({ storageState: OWNER_STATE });
    const admin = await newWatchedPage(ctx);
    await admin.goto("/admin");
    await a11y(admin, "S11");
    const id = await bookingIdByCode(admin, code);
    await admin.goto(`/admin/t/${id}`);
    await a11y(admin, "S12");
    await admin.getByRole("button", { name: "Aceptar", exact: true }).click();
    await expect(admin.getByText("Taquiza aceptada")).toBeVisible();
    await expect(admin.getByRole("main").locator("header")).toContainText("Confirmada");
    const href = await admin.getByRole("link", { name: "Avisar al cliente por WhatsApp" }).getAttribute("href");
    const text = decodeURIComponent(href!.split("text=")[1]);
    expect(text).toContain("quedó confirmada");
    const link = text.match(/http:\/\/localhost:3100\/t\/\S+/)![0];
    await page.goto(link);
    await expect(page.getByText("Confirmada").first()).toBeVisible();
    await ctx.close();
  });

  test("F03-E1 el día se cerró después de la solicitud: avisa y permite aceptar de todos modos", async ({ page, browser, newWatchedPage }) => {
    const { code } = await bookTaquiza(page, { monthsAhead: 1, dayIndex: 8 });
    const ctx = await browser.newContext({ storageState: OWNER_STATE });
    const admin = await newWatchedPage(ctx);
    const id = await bookingIdByCode(admin, code);
    await admin.goto(`/admin/t/${id}`);
    const weekday = (await admin.getByRole("main").locator("header p").first().innerText()).split(" ")[0];
    const label = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    const toggleDay = async (open: boolean) => {
      await admin.goto("/admin/disponibilidad");
      await admin.getByRole("checkbox", { name: label }).setChecked(open);
      await admin.getByRole("button", { name: "Guardar disponibilidad" }).click();
      await expect(admin.getByText("Disponibilidad guardada")).toBeVisible();
    };
    await toggleDay(false);
    try {
      await admin.goto(`/admin/t/${id}`);
      await admin.getByRole("button", { name: "Aceptar", exact: true }).click();
      await expect(admin.getByRole("alert").filter({ hasText: "Ese día no trabajamos" })).toBeVisible();
      await admin.getByRole("button", { name: "Aceptar de todos modos" }).click();
      await expect(admin.getByText("Aceptada (se forzó la capacidad)")).toBeVisible();
      await expect(admin.getByRole("main").locator("header")).toContainText("Confirmada");
    } finally {
      await toggleDay(true);
      await ctx.close();
    }
  });

  test("F03-N1 sesión vencida a medio camino: la acción no pasa y lo dice", async ({ page, browser, newWatchedPage }) => {
    const { code } = await bookTaquiza(page, { monthsAhead: 1, dayIndex: 9 });
    const ctx = await browser.newContext({ storageState: OWNER_STATE });
    const admin = await newWatchedPage(ctx);
    const id = await bookingIdByCode(admin, code);
    await admin.goto(`/admin/t/${id}`);
    await ctx.clearCookies();
    await admin.getByRole("button", { name: "Aceptar", exact: true }).click();
    await expect(admin.getByRole("alert").filter({ hasText: "Tu sesión terminó" })).toBeVisible();
    await ctx.close();
  });

  test("F03-N2 el ayudante acepta, pero no entra a Ajustes ni cancela", async ({ page, browser, newWatchedPage }) => {
    const { code } = await bookTaquiza(page, { monthsAhead: 1, dayIndex: 10 });
    const ctx = await browser.newContext({ storageState: HELPER_STATE });
    const helper = await newWatchedPage(ctx);
    await helper.goto("/admin/ajustes");
    await expect(helper).toHaveURL(/\/admin\?aviso=sin-permiso/);
    await expect(helper.getByText("Esa sección es solo para el dueño")).toBeVisible();
    const id = await bookingIdByCode(helper, code);
    await helper.goto(`/admin/t/${id}`);
    await helper.getByRole("button", { name: "Aceptar", exact: true }).click();
    await expect(helper.getByText("Taquiza aceptada")).toBeVisible();
    await helper.getByRole("button", { name: "Cancelar taquiza" }).click();
    await helper.getByRole("dialog").getByRole("button", { name: "Sí, cancelar" }).click();
    await expect(helper.getByRole("alert").filter({ hasText: "Solo el dueño puede hacer esto." })).toBeVisible();
    await ctx.close();
  });
});
