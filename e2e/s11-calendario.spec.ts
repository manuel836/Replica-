import type { Page } from "@playwright/test";
import { OWNER_STATE, a11y, bookTaquiza, expect, test } from "./helpers";

test.use({ storageState: OWNER_STATE });

// Vistas de semana y mes de la agenda (S11), agregadas después de /replica-diff.

const isoIn = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

async function noOverflow(page: Page) {
  const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(extra).toBeLessThanOrEqual(0);
}

test.describe("S11 agenda por semana y por mes", () => {
  test("S11-H1 el mes muestra la taquiza, lleva a su detalle y a su semana", async ({ page, browser, newWatchedPage }) => {
    const who = `Calendaria${Date.now() % 100_000}`;
    await bookTaquiza(page, { monthsAhead: 1, dayIndex: 3, name: `${who} Prueba` });

    const ctx = await browser.newContext({ storageState: OWNER_STATE });
    const admin = await newWatchedPage(ctx);
    await admin.goto("/admin");
    await admin.getByRole("navigation", { name: "Vista de la agenda" }).getByRole("link", { name: "Mes" }).click();
    await expect(admin).toHaveURL(/vista=mes/);
    await expect(admin.getByRole("table")).toBeVisible();
    await a11y(admin, "S11 mes");

    // Buscar la taquiza avanzando mes por mes.
    const chip = admin.getByRole("link", { name: new RegExp(who) });
    for (let i = 0; i < 4 && !(await chip.isVisible()); i++) {
      await admin.getByRole("link", { name: "Mes siguiente" }).click();
      await admin.waitForLoadState("domcontentloaded");
    }
    // Puede salir en los días del mes siguiente que completan la cuadrícula: también vale.
    await expect(chip).toBeVisible();

    // Del día a su semana: ahí sale el nombre completo y el lugar ocupado.
    const cell = admin.getByRole("cell").filter({ has: chip });
    await cell.getByRole("link", { name: /Ver la semana/ }).click();
    await expect(admin).toHaveURL(/vista=semana/);
    await expect(admin.getByRole("link", { name: new RegExp(`${who} Prueba`) })).toBeVisible();
    await expect(admin.getByText(/\d de \d/).first()).toBeVisible();
    await a11y(admin, "S11 semana");

    await admin.getByRole("link", { name: new RegExp(`${who} Prueba`) }).click();
    await expect(admin).toHaveURL(/\/admin\/t\//);
    await expect(admin.getByText(`${who} Prueba`).first()).toBeVisible();
    await ctx.close();
  });

  test("S11-H2 un día bloqueado se ve en la semana con su motivo", async ({ page }) => {
    const day = isoIn(47);
    await page.goto("/admin/disponibilidad");
    await page.waitForLoadState("networkidle");
    await page.getByLabel(/^Fecha/).fill(day);
    await page.getByLabel(/^Motivo/).fill("Boda de la familia");
    await page.getByRole("button", { name: "Bloquear", exact: true }).click();
    await expect(page.getByText("Día bloqueado")).toBeVisible();
    try {
      await page.goto(`/admin?vista=semana&fecha=${day}`);
      await expect(page.getByText("Bloqueado: Boda de la familia")).toBeVisible();
      await page.goto(`/admin?vista=mes&fecha=${day}`);
      await expect(page.getByRole("link", { name: /, bloqueado: / })).toHaveCount(1);
    } finally {
      await page.goto("/admin/disponibilidad");
      await page.getByRole("button", { name: /^Desbloquear/ }).first().click();
      await expect(page.getByText("Día desbloqueado")).toBeVisible();
    }
  });

  test("S11-E1 en celular: sin desborde, la semana en columna y el mes con conteos", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin?vista=semana");
    await expect(page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 3 }) })).toHaveCount(7);
    await expect(page.locator('[aria-current="date"]')).toHaveCount(1);
    await noOverflow(page);
    await a11y(page, "S11 semana 390");
    await page.goto("/admin?vista=mes");
    await expect(page.locator('td[aria-current="date"]')).toHaveCount(1);
    await noOverflow(page);
    await a11y(page, "S11 mes 390");
  });

  test("S11-H3 las flechas cambian de periodo y 'Esta semana' / 'Este mes' regresan", async ({ page }) => {
    await page.goto("/admin?vista=semana");
    const title = await page.getByRole("heading", { level: 2 }).filter({ hasText: /\d{4}/ }).innerText();
    await expect(page.getByRole("link", { name: "Esta semana" })).toHaveCount(0);
    await page.getByRole("link", { name: "Semana siguiente" }).click();
    await expect(page.locator('[aria-current="date"]')).toHaveCount(0);
    await page.getByRole("link", { name: "Esta semana" }).click();
    await expect(page.getByRole("heading", { level: 2 }).filter({ hasText: /\d{4}/ })).toHaveText(title);
    await page.getByRole("navigation", { name: "Vista de la agenda" }).getByRole("link", { name: "Mes" }).click();
    await page.getByRole("link", { name: "Mes anterior" }).click();
    await expect(page.locator('td[aria-current="date"]')).toHaveCount(0);
    await page.getByRole("link", { name: "Este mes" }).click();
    await expect(page.locator('td[aria-current="date"]')).toHaveCount(1);
  });

  test("S11-E2 una fecha inválida en la dirección regresa a hoy, sin error", async ({ page }) => {
    await page.goto("/admin?vista=semana&fecha=2026-02-31");
    await expect(page.locator('[aria-current="date"]')).toHaveCount(1);
    await page.goto("/admin?vista=mes&fecha=hola");
    await expect(page.locator('td[aria-current="date"]')).toHaveCount(1);
  });
});
