import type { Page } from "@playwright/test";
import { HELPER, OWNER_STATE, a11y, bookTaquiza, bookingIdByCode, emailLogin, expect, test } from "./helpers";

// Reporte de ventas por mes y CSV (agregados después de /replica-diff).

test.use({ storageState: OWNER_STATE });

/** Lee el CSV y devuelve la fila de una taquiza como objeto (columna → valor). */
async function csvRow(page: Page, mes: string, code: string) {
  const res = await page.request.get(`/admin/reportes/csv?mes=${mes}`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/csv");
  const text = await res.text();
  expect(text.charCodeAt(0)).toBe(0xfeff); // BOM: Excel abre los acentos bien
  const lines = text.slice(1).trim().split("\r\n");
  const split = (l: string) => (l.match(/("([^"]|"")*"|[^,]*)(,|$)/g) ?? []).map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"'));
  const header = split(lines[0]);
  const row = lines.map(split).find((r) => r[0] === code);
  return row ? Object.fromEntries(header.map((h, i) => [h, row[i]])) : null;
}

/** El valor de un cuadro de cifras ("Vendido", "Cobrado"...). */
const tile = (page: Page, label: string) =>
  page.locator("dl > div").filter({ has: page.getByText(label, { exact: true }) }).locator("dd").first();

const money = (s: string) => Number(s.replace(/[^\d.]/g, ""));

test.describe("Reportes", () => {
  test("RP-H1 el reporte y el CSV cuadran con una taquiza pagada y un pago en efectivo", async ({ page }) => {
    const { code } = await bookTaquiza(page, { monthsAhead: 2, dayIndex: 17, payNow: true, name: "=SUMA(1;1) Reporte" });
    const all = await csvRow(page, "todas", code);
    expect(all).not.toBeNull();
    // Excel no debe ejecutar el nombre como fórmula.
    expect(all!["Cliente"]).toBe("'=SUMA(1;1) Reporte");
    expect(all!["Estado"]).toBe("Confirmada");
    expect(all!["Total"]).toBe("6000.00");
    expect(all!["Anticipo"]).toBe("1800.00");
    expect(all!["Pagado"]).toBe("1800.00");
    expect(all!["Por cobrar"]).toBe("4200.00");
    expect(all!["Origen"]).toBe("En línea");
    const mes = all!["Fecha"].slice(0, 7);
    expect(await csvRow(page, mes, code)).toEqual(all);

    await page.goto(`/admin/reportes?mes=${mes}`);
    await a11y(page, "Reportes");
    const cobrado = money(await tile(page, "Cobrado").innerText());
    const porCobrar = money(await tile(page, "Por cobrar").innerText());
    expect(money(await tile(page, "Vendido").innerText())).toBeGreaterThanOrEqual(6000);

    // Un pago en efectivo de $1,000 mueve "Cobrado" y "Por cobrar" lo mismo.
    await page.goto(`/admin/t/${await bookingIdByCode(page, code)}`);
    await page.getByRole("button", { name: "Registrar pago en efectivo o transferencia" }).click();
    await page.getByRole("dialog").getByLabel("Monto en pesos").fill("1000");
    await page.getByRole("dialog").getByRole("button", { name: "Guardar pago" }).click();
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Pago registrado" })).toBeVisible();
    await page.goto(`/admin/reportes?mes=${mes}`);
    expect(money(await tile(page, "Cobrado").innerText())).toBe(cobrado + 1000);
    expect(money(await tile(page, "Por cobrar").innerText())).toBe(porCobrar - 1000);
    expect((await csvRow(page, mes, code))!["Por cobrar"]).toBe("3200.00");
  });

  test("RP-E1 un mes sin taquizas y el celular", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/reportes?mes=2020-01");
    await expect(page.getByRole("heading", { name: "Sin taquizas este mes" })).toBeVisible();
    await page.goto("/admin/reportes");
    await expect(page.getByRole("heading", { level: 2 })).toBeVisible();
    const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(extra).toBeLessThanOrEqual(0);
    await a11y(page, "Reportes 390");
    expect((await page.request.get("/admin/reportes/csv?mes=2026-13")).status()).toBe(400);
  });

  test("RP-N1 el ayudante y alguien sin sesión no ven reportes ni descargan el CSV", async ({ browser, newWatchedPage }) => {
    const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    expect((await anon.request.get("/admin/reportes/csv?mes=todas")).status()).toBe(401);
    await anon.close();
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const helper = await newWatchedPage(ctx);
    await emailLogin(helper, HELPER);
    expect((await helper.request.get("/admin/reportes/csv?mes=todas")).status()).toBe(403);
    await helper.goto("/admin/reportes");
    await expect(helper).toHaveURL(/aviso=sin-permiso/);
    await ctx.close();
  });
});
