import { writeFileSync } from "node:fs";
import { OWNER_STATE, a11y, bookTaquiza, bookingIdByCode, expect, test } from "./helpers";

test.use({ storageState: OWNER_STATE });

const isoIn = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

test.describe("F06 disponibilidad", () => {
  test("F06-H1 bloquear un día lo quita del calendario público; quitar el bloqueo lo regresa", async ({ page, request }) => {
    const day = isoIn(52);
    const stateOf = async () => (await (await request.get(`/api/disponibilidad/mes?mes=${day.slice(0, 7)}&invitados=30`)).json())[day];
    await page.goto("/admin/disponibilidad");
    await a11y(page, "S14");
    await page.getByLabel(/^Fecha/).fill(day);
    await page.getByLabel(/^Motivo/).fill("Prueba de bloqueo");
    await page.getByRole("button", { name: "Bloquear", exact: true }).click();
    await expect(page.getByText("Día bloqueado")).toBeVisible();
    expect(await stateOf()).toBe("blocked");
    await page.getByRole("button", { name: /^Desbloquear/ }).first().click();
    await expect(page.getByText("Día desbloqueado")).toBeVisible();
    expect(await stateOf()).not.toBe("blocked");
  });

  test("F06-N1 horario al revés (última hora antes de la primera): no se guarda", async ({ page }) => {
    await page.goto("/admin/disponibilidad");
    // Esperar a que React hidrate: lo escrito antes se pierde (ver "por revisar" en bugs.md).
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Martes: primera hora").fill("20:00");
    await page.getByLabel("Martes: última hora").fill("12:00");
    await expect(page.getByLabel("Martes: primera hora")).toHaveValue("20:00");
    await page.getByRole("button", { name: "Guardar disponibilidad" }).click();
    await expect(page.getByText("La última hora de inicio va después de la primera.")).toBeVisible();
  });
});

test.describe("F07 paquetes", () => {
  test("F07-H1 crear un paquete lo publica; ocultarlo lo quita", async ({ page, request }) => {
    const name = `Paquete E2E ${Date.now()}`;
    await page.goto("/admin/paquetes");
    await a11y(page, "S15");
    await page.getByRole("button", { name: "Nuevo paquete" }).click();
    await page.getByRole("dialog").getByLabel(/^Nombre/).fill(name);
    await page.getByRole("dialog").getByLabel(/^Precio por persona/).fill("130");
    await page.getByRole("dialog").getByLabel(/^Qué incluye/).fill("Tacos de asada\nSalsas");
    await page.getByRole("dialog").getByRole("button", { name: "Guardar paquete" }).click();
    await expect(page.getByText("Paquete guardado")).toBeVisible();
    expect(await (await request.get("/paquetes")).text()).toContain(name);
    await page.getByRole("listitem").filter({ hasText: name }).getByRole("button", { name: "Ocultar" }).click();
    await expect(page.getByText("Paquete oculto")).toBeVisible();
    expect(await (await request.get("/paquetes")).text()).not.toContain(name);
  });

  test("F07-N1 paquete sin nombre ni precio: marca los errores", async ({ page }) => {
    await page.goto("/admin/paquetes");
    await page.getByRole("button", { name: "Nuevo paquete" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Guardar paquete" }).click();
    await expect(page.getByRole("dialog").getByText("Escribe el nombre.")).toBeVisible();
    await expect(page.getByRole("dialog").getByText(/Revisa el precio|Escribe el precio por persona/)).toBeVisible();
  });

  test("F07-E1 foto del paquete: una imagen se sube; un archivo falso se rechaza", async ({ page }) => {
    const png = "test-results/e2e-foto.png";
    const fake = "test-results/e2e-falsa.jpg";
    writeFileSync(png, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
    writeFileSync(fake, "esto no es una imagen");
    await page.goto("/admin/paquetes");
    const row = page.getByRole("listitem").filter({ hasText: "Paquete de ejemplo A" });
    await row.locator("input[type=file]").setInputFiles(png);
    await expect(page.getByText("Foto guardada")).toBeVisible();
    await expect(row.getByRole("img", { name: "Foto de Paquete de ejemplo A" })).toBeVisible();
    await row.locator("input[type=file]").setInputFiles(fake);
    await expect(page.getByText("Solo se aceptan fotos JPG, PNG o WebP.")).toBeVisible();
  });

  test("F07-E2 cambiar el precio no cambia taquizas ya agendadas", async ({ page, browser, newWatchedPage }) => {
    const customer = await newWatchedPage();
    const { code } = await bookTaquiza(customer, { monthsAhead: 1, dayIndex: 17, guests: 40 });
    const setPrice = async (price: string) => {
      await page.goto("/admin/paquetes");
      await page.getByRole("button", { name: "Editar Paquete de ejemplo A" }).click();
      await page.getByRole("dialog").getByLabel(/^Precio por persona/).fill(price);
      await page.getByRole("dialog").getByRole("button", { name: "Guardar paquete" }).click();
      await expect(page.getByText("Paquete guardado")).toBeVisible();
    };
    await setPrice("175");
    try {
      const id = await bookingIdByCode(page, code);
      await page.goto(`/admin/t/${id}`);
      await expect(page.getByText(/40 × \$150/)).toBeVisible();
    } finally {
      await setPrice("150");
    }
    void browser;
  });
});

test.describe("F08 taquiza registrada a mano", () => {
  test("F08-H1 registrar una taquiza de teléfono y, si el horario se cruza, forzarla", async ({ page }) => {
    const day = isoIn(60);
    const fill = async (name: string) => {
      await page.goto("/admin/t/nueva");
      await page.getByLabel(/^Nombre/).fill(name);
      await page.getByLabel(/^WhatsApp/).fill(`753${Date.now().toString().slice(-7)}`);
      await page.getByLabel(/^Fecha/).fill(day);
      await expect(page.getByLabel(/^Hora de inicio/).locator("option")).not.toHaveCount(1);
      await page.getByLabel(/^Hora de inicio/).selectOption("14:00");
      await page.getByLabel(/^Dirección/).fill("Calle Teléfono 1");
    };
    await fill("Cliente Teléfono A");
    await a11y(page, "S13");
    await page.getByRole("button", { name: "Guardar taquiza" }).click();
    await page.waitForURL(/\/admin\/t\/[0-9a-f-]{36}$/);
    await expect(page.getByText("registrada en el panel")).toBeVisible();

    await fill("Cliente Teléfono B");
    await expect(page.getByText("Ese horario se cruza con otra taquiza")).toBeVisible();
    await page.getByRole("button", { name: "Guardar taquiza" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /ocupar|lleno/ })).toBeVisible();
    await page.getByLabel(/Guardar aunque esté lleno/).check();
    await page.getByRole("button", { name: "Guardar taquiza" }).click();
    await page.waitForURL(/\/admin\/t\/[0-9a-f-]{36}$/);
    await expect(page.getByText("se forzó la capacidad")).toBeVisible();
  });
});
