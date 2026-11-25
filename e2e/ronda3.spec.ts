import type { Browser } from "@playwright/test";
import { HELPER_STATE, OWNER_STATE, a11y, bookTaquiza, bookingIdByCode, expect, mock, test } from "./helpers";

// Tercera ronda de /replica-test: la marca y los bordes de las pantallas nuevas
// (Equipo, Reportes, Compartir, Recuperar enlace, reembolso parcial).

const noOverflow = async (page: import("@playwright/test").Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

/** Ancho ÷ alto del aro dorado en la imagen para compartir (1 = redondo). */
async function ringRatio(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    const img = new Image();
    img.src = `/opengraph-image?t=${Date.now()}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const W = 195; // el aro vive a la izquierda; el nombre empieza después
    const { data } = ctx.getImageData(0, 0, W, img.height);
    let minX = Infinity, maxX = -1, minY = Infinity, maxY = -1;
    for (let y = 0; y < img.height; y++)
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (Math.abs(data[i] - 242) < 30 && Math.abs(data[i + 1] - 189) < 30 && Math.abs(data[i + 2] - 108) < 40) {
          minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
      }
    return (maxX - minX + 1) / (maxY - minY + 1);
  });
}

async function setBusinessName(browser: Browser, name: string) {
  const ctx = await browser.newContext({ storageState: OWNER_STATE });
  const admin = await ctx.newPage();
  await admin.goto("/admin/ajustes");
  await admin.waitForLoadState("networkidle");
  await admin.getByLabel(/^Nombre/).fill(name);
  await admin.getByRole("button", { name: "Guardar ajustes" }).click();
  await expect(admin.getByText("Ajustes guardados")).toBeVisible();
  await ctx.close();
}

test.describe("R3 marca", () => {
  test("R3-B1 favicon, ícono de iPhone e imagen para compartir: existen, son del tipo correcto y están en el <head>", async ({ page, request }) => {
    await page.goto("/");
    await expect(page.locator('head link[rel="icon"]').first()).toHaveAttribute("href", /icon/);
    await expect(page.locator('head link[rel="apple-touch-icon"]')).toHaveAttribute("href", /apple-icon/);
    await expect(page.locator('head meta[property="og:image"]').first()).toHaveAttribute("content", /opengraph-image/);
    await expect(page.locator('head meta[property="og:image:alt"]').first()).toHaveAttribute("content", /D' Garden Tacos/);
    for (const [path, type] of [
      ["/icon.svg", "image/svg+xml"],
      ["/apple-icon", "image/png"],
      ["/opengraph-image", "image/png"],
    ]) {
      const r = await request.get(path);
      expect(r.status(), path).toBe(200);
      expect(r.headers()["content-type"], path).toContain(type);
    }
  });

  test("R3-B2 la voz: la promesa en la portada y 'ese día llegamos' en la confirmación (no 'te esperamos')", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Te confirma por WhatsApp el mismo equipo que llega a servir.")).toBeVisible();
    await bookTaquiza(page, { monthsAhead: 2, dayIndex: 23, payNow: true });
    await expect(page.getByText(/Te esperamos/)).toHaveCount(0);
  });

  test("R3-B3 nombre de 60 caracteres: la portada no se desborda en celular y la imagen para compartir sigue saliendo", async ({ page, browser, request }) => {
    const long = "Taquería y Taquizas D' Garden Tacos de Lázaro Cárdenas Mich.";
    expect(long.length).toBe(60);
    await setBusinessName(browser, long);
    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toContainText(long);
      await noOverflow(page);
      expect((await request.get("/opengraph-image")).status()).toBe(200);
      // BUG-009: el aro dorado del "DG" debe seguir redondo aunque el nombre sea largo.
      expect(await ringRatio(page)).toBeGreaterThan(0.95);
      await page.goto("/agendar");
      await noOverflow(page);
    } finally {
      await setBusinessName(browser, "D' Garden Tacos");
    }
  });
});

test.describe("R3 bordes de las pantallas nuevas", () => {
  test("R3-E1 doble clic en 'Reembolsar': un solo reembolso", async ({ page, browser, newWatchedPage }) => {
    const { code } = await bookTaquiza(page, { monthsAhead: 2, dayIndex: 24, payNow: true });
    const ctx = await browser.newContext({ storageState: OWNER_STATE });
    const admin = await newWatchedPage(ctx);
    await admin.goto(`/admin/t/${await bookingIdByCode(admin, code)}`);
    const before = (await mock.state()).refunds.length;
    await admin.getByRole("button", { name: "Reembolsar parte del anticipo" }).click();
    const dialog = admin.getByRole("dialog");
    await dialog.getByLabel("Monto en pesos").fill("300");
    await dialog.getByRole("button", { name: "Reembolsar" }).dblclick();
    await expect(admin.locator("[data-sonner-toast]").filter({ hasText: /Reembolsaste \$300|ya estaba hecho/ }).first()).toBeVisible();
    await expect(admin.getByText(/^Pagado:/)).toContainText("Pagado: $1,500 ");
    expect((await mock.state()).refunds.length).toBe(before + 1);
    await ctx.close();
  });

  test("R3-E2 recuperar enlace solo con teclado, en celular, con axe", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    await p.goto("/t/recuperar");
    await p.waitForLoadState("networkidle");
    await noOverflow(p);
    await a11y(p, "Recuperar 390");
    const field = p.getByLabel("Tu WhatsApp");
    for (let i = 0; i < 30 && !(await field.evaluate((el) => el === document.activeElement)); i++) await p.keyboard.press("Tab");
    await expect(p.getByLabel("Tu WhatsApp")).toBeFocused();
    await p.keyboard.type("7531112233");
    await p.keyboard.press("Enter");
    await expect(p.getByText("Si ese número tiene taquizas próximas")).toBeVisible();
    await ctx.close();
  });

  test("R3-E3 recuperar enlace sin conexión: avisa, el número se queda escrito y al volver la red funciona", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const p = await ctx.newPage();
    await p.goto("/t/recuperar");
    await p.waitForLoadState("networkidle");
    await p.getByLabel("Tu WhatsApp").fill("7532223344");
    await ctx.setOffline(true);
    await p.getByRole("button", { name: "Mandarme mi enlace" }).click();
    await expect(p.getByRole("alert").filter({ hasText: "No pudimos conectarnos" })).toBeVisible();
    await expect(p.getByLabel("Tu WhatsApp")).toHaveValue("7532223344");
    await ctx.setOffline(false);
    await p.getByRole("button", { name: "Mandarme mi enlace" }).click();
    await expect(p.getByText("Si ese número tiene taquizas próximas")).toBeVisible();
    await ctx.close();
  });

  test("R3-E4 sesión vencida en Equipo: no agrega a nadie y lo dice", async ({ browser, newWatchedPage }) => {
    const ctx = await browser.newContext({ storageState: OWNER_STATE });
    const owner = await newWatchedPage(ctx);
    await owner.goto("/admin/equipo");
    await owner.waitForLoadState("networkidle");
    await ctx.clearCookies();
    const email = `vencida${Date.now()}@dgarden.test`;
    await owner.getByLabel("Correo del ayudante").fill(email);
    await owner.getByRole("button", { name: "Dar acceso" }).click();
    await expect(owner.getByText("Tu sesión terminó. Vuelve a entrar.")).toBeVisible();
    expect((await mock.emails(email)).length).toBe(0);
    await ctx.close();
  });

  test("R3-E5 acentos y emoji en el nombre llegan intactos al correo del cliente", async ({ page }) => {
    const email = `acentos${Date.now()}@correo.test`;
    await bookTaquiza(page, { monthsAhead: 2, dayIndex: 25, name: "Ñoño Gutiérrez 🌮", email });
    await expect.poll(async () => (await mock.emails(email)).find((e) => /Recibimos tu solicitud/.test(e.subject))?.text ?? "").toContain("Hola, Ñoño.");
  });

  test("R3-N1 el ayudante sí puede usar Compartir, pero no Reportes ni Equipo", async ({ browser, newWatchedPage }) => {
    const ctx = await browser.newContext({ storageState: HELPER_STATE });
    const helper = await newWatchedPage(ctx);
    await helper.goto("/admin/compartir");
    await expect(helper.getByRole("heading", { name: "Comparte tu página", level: 1 })).toBeVisible();
    for (const path of ["/admin/reportes", "/admin/equipo"]) {
      await helper.goto(path);
      await expect(helper).toHaveURL(/aviso=sin-permiso/);
    }
    await ctx.close();
  });
});
