import type { Browser, Page } from "@playwright/test";
import { OWNER_STATE, a11y, bookTaquiza, bookingIdByCode, expect, fillDetails, mock, pickDayAndSlot, test } from "./helpers";

// Arreglos de /replica-entrepreneur (replica/fixes.md): que el cliente siempre sepa qué apartó.

async function setDailyGuestLimit(browser: Browser, value: string) {
  const ctx = await browser.newContext({ storageState: OWNER_STATE });
  const admin = await ctx.newPage();
  await admin.goto("/admin/disponibilidad");
  await admin.waitForLoadState("networkidle");
  await admin.getByLabel(/^Invitados por día \(máximo\)/).fill(value);
  await admin.getByRole("button", { name: "Guardar disponibilidad" }).click();
  await expect(admin.getByText("Disponibilidad guardada")).toBeVisible();
  await ctx.close();
}

const typeGuests = async (page: Page, n: number) => {
  const input = page.getByLabel("Invitados", { exact: true });
  await input.fill(String(n));
  await input.blur();
};

test.describe("FX1 la fecha no cambia sola", () => {
  test("FX1-H1 el último paso repite la fecha con año y el botón dice día y hora", async ({ page }) => {
    const when = await pickDayAndSlot(page, { monthsAhead: 1, dayIndex: 2 });
    const time = when.match(/(\d{2}:\d{2})/)![1];
    await page.getByRole("button", { name: "Continuar" }).click();
    await fillDetails(page);
    await page.getByRole("button", { name: "Continuar" }).click();
    const review = page.locator("p", { hasText: "Revisa tu fecha" }).locator("..");
    await expect(review).toContainText(/de 20\d\d · \d{2}:\d{2}/);
    await expect(review).toContainText(time);
    await expect(page.getByRole("button", { name: new RegExp(`^(Enviar solicitud|Ir a pagar el anticipo) · .+, ${time}$`) })).toBeVisible();
    await a11y(page, "S05 con fecha");
    await page.getByRole("button", { name: "Cambiar", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Paso 1 de 3: Fecha y hora" })).toBeVisible();
  });

  test("FX1-E1 si al subir invitados el día ya no tiene lugar, se avisa en vez de soltarlo callado", async ({ page, browser }) => {
    await setDailyGuestLimit(browser, "100");
    try {
      await pickDayAndSlot(page, { monthsAhead: 1, dayIndex: 4, guests: 40 });
      await typeGuests(page, 150);
      await expect(page.getByRole("status").filter({ hasText: "ya no tiene lugar para 150 invitados" })).toBeVisible();
      await expect(page.locator("fieldset input[type=radio]:checked")).toHaveCount(0);
      // Al elegir otra fecha el aviso se va.
      await typeGuests(page, 40);
      await page.locator('table[role="grid"] button:not([disabled])').first().click();
      await expect(page.getByText("Cambió la disponibilidad")).toHaveCount(0);
    } finally {
      await setDailyGuestLimit(browser, "");
    }
  });
});

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
/** "Domingo 6 de diciembre de 2026" → Date (mediodía UTC). */
const parseEs = (s: string) => {
  const m = s.match(/(\d+) de (\S+) de (\d{4})/)!;
  return new Date(Date.UTC(Number(m[3]), MONTHS.indexOf(m[2].toLowerCase()), Number(m[1]), 12));
};

test.describe("FX3 anticipo claro, con fecha y monto", () => {
  test("FX3-H1 al pagar, en Mi taquiza y en el correo se dice hasta qué día y cuánto se devuelve", async ({ page }) => {
    const email = `anticipo${Date.now()}@correo.test`;
    await pickDayAndSlot(page, { monthsAhead: 2, dayIndex: 18 });
    await page.getByRole("button", { name: "Continuar" }).click();
    await fillDetails(page, { email });
    await page.getByRole("button", { name: "Continuar" }).click();
    const eventDate = parseEs(await page.locator("p", { hasText: "Revisa tu fecha" }).locator("..").innerText());
    const deadline = new Date(eventDate.getTime() - 7 * 86_400_000); // política de demo: 7 días
    const terms = new RegExp(`Si cancelas a más tardar el \\S+ ${deadline.getUTCDate()} de ${MONTHS[deadline.getUTCMonth()]}, te devolvemos los \\$1,800 completos\\.`);
    await expect(page.getByText(terms)).toBeVisible();

    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /Ir a pagar el anticipo/ }).click();
    await page.waitForURL(/localhost:4010\/checkout\//);
    await page.getByRole("button", { name: "Aprobar pago" }).click();
    await page.waitForURL(/\/pago\?resultado=aprobado/);
    await page.getByRole("link", { name: "Ver mi taquiza" }).click();
    const s07 = new RegExp(`Si cancelas a más tardar el \\S+ ${deadline.getUTCDate()} de ${MONTHS[deadline.getUTCMonth()]}, te devolvemos \\$1,800 del anticipo`);
    await expect(page.getByRole("status").filter({ hasText: "Anticipo pagado" })).toContainText(s07);

    await expect
      .poll(async () => (await mock.emails(email)).find((e) => /está confirmada/.test(e.subject))?.text ?? "")
      .toMatch(new RegExp(`te devolvemos tu anticipo de \\$1,800`));
  });

  test("FX3-E1 si faltan menos días que el plazo, se avisa antes de pagar que ya no se devuelve", async ({ page }) => {
    await pickDayAndSlot(page, { monthsAhead: 0, dayIndex: 0 });
    await page.getByRole("button", { name: "Continuar" }).click();
    await fillDetails(page);
    await page.getByRole("button", { name: "Continuar" }).click();
    const eventDate = parseEs(await page.locator("p", { hasText: "Revisa tu fecha" }).locator("..").innerText());
    test.skip(eventDate.getTime() - Date.now() > 7 * 86_400_000, "El primer día libre ya cae fuera del plazo");
    await expect(page.getByText("Faltan menos de 7 días: si después cancelas, el anticipo ya no se devuelve.")).toBeVisible();
  });
});

test.describe("FX2 si cancelamos, sabes por qué", () => {
  test("FX2-H1 rechazar pide motivo; la sugerencia de un toque llega al cliente en su enlace y en su correo", async ({ page, browser, newWatchedPage }) => {
    const email = `rechazo${Date.now()}@correo.test`;
    const { code, manageUrl } = await bookTaquiza(page, { monthsAhead: 1, dayIndex: 9, email });
    const ctx = await browser.newContext({ storageState: OWNER_STATE });
    const admin = await newWatchedPage(ctx);
    await admin.goto(`/admin/t/${await bookingIdByCode(admin, code)}`);
    await admin.getByRole("button", { name: "Rechazar", exact: true }).click();
    const dialog = admin.getByRole("dialog");
    await expect(dialog).toContainText("mejor usa «Proponer otra fecha»");
    await dialog.getByRole("button", { name: "Rechazar", exact: true }).click();
    await expect(dialog.getByText("Escribe el motivo: el cliente lo va a ver.")).toBeVisible();
    await a11y(admin, "S12 rechazar");
    await dialog.getByRole("group", { name: "Motivos frecuentes" }).getByRole("button", { name: "No llegamos a esa zona" }).click();
    await expect(dialog.getByLabel(/^Motivo para el cliente/)).toHaveValue("No llegamos a esa zona");
    await dialog.getByRole("button", { name: "Rechazar", exact: true }).click();
    await expect(admin.locator("[data-sonner-toast]").filter({ hasText: "Solicitud rechazada" })).toBeVisible();

    await page.goto(manageUrl);
    await expect(page.getByRole("alert").filter({ hasText: "Esta vez no pudimos atender tu taquiza" })).toContainText("Motivo: No llegamos a esa zona");
    await expect.poll(async () => (await mock.emails(email)).find((e) => /No podemos atender/.test(e.subject))?.text ?? "").toContain("Motivo: No llegamos a esa zona");
    await ctx.close();
  });

  test("FX2-H2 el dueño cancela una confirmada: el cliente ve 'Tuvimos que cancelar' con el motivo", async ({ page, browser, newWatchedPage }) => {
    const { code, manageUrl } = await bookTaquiza(page, { monthsAhead: 1, dayIndex: 10 });
    const ctx = await browser.newContext({ storageState: OWNER_STATE });
    const admin = await newWatchedPage(ctx);
    await admin.goto(`/admin/t/${await bookingIdByCode(admin, code)}`);
    await admin.getByRole("button", { name: "Aceptar", exact: true }).click();
    await expect(admin.getByText("Taquiza aceptada")).toBeVisible();
    await admin.getByRole("button", { name: "Cancelar taquiza" }).click();
    const dialog = admin.getByRole("dialog");
    await dialog.getByRole("button", { name: "Sí, cancelar" }).click();
    await expect(dialog.getByText("Escribe el motivo: el cliente lo va a ver.")).toBeVisible();
    await dialog.getByLabel(/^Motivo para el cliente/).fill("Se nos descompuso el trompo");
    await dialog.getByRole("button", { name: "Sí, cancelar" }).click();
    await expect(admin.locator("[data-sonner-toast]").filter({ hasText: "Taquiza cancelada" })).toBeVisible();
    await page.goto(manageUrl);
    await expect(page.getByRole("alert").filter({ hasText: "Tuvimos que cancelar tu taquiza" })).toContainText("Motivo: Se nos descompuso el trompo");
    await ctx.close();
  });
});

test.describe("FX4 avisa a tus invitados", () => {
  test("FX4-H1 confirmada: WhatsApp y copiar con fecha, hora, dirección y mapa, sin el enlace privado", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const { manageUrl, code } = await bookTaquiza(page, { monthsAhead: 2, dayIndex: 19, payNow: true, address: "Calle Fiesta 45" });
    await page.goto(manageUrl);
    const section = page.getByRole("region", { name: "Avisa a tus invitados" });
    await expect(section).toBeVisible();
    await a11y(page, "S07 invitados");
    const href = (await section.getByRole("link", { name: /Mandar por WhatsApp/ }).getAttribute("href"))!;
    expect(href.startsWith("https://wa.me/?text=")).toBe(true);
    const text = decodeURIComponent(href.split("text=")[1]);
    expect(text).toMatch(/a las \d{2}:\d{2}/);
    expect(text).toContain("Calle Fiesta 45");
    expect(text).toContain("Cómo llegar: https://www.google.com/maps/search/?api=1&query=");
    // Nunca el enlace privado: con él se cambia o se cancela.
    expect(text).not.toContain(`/t/${code}`);
    expect(text).not.toContain("k=");
    await section.getByRole("button", { name: "Copiar texto" }).click();
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Texto copiado" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(text);
  });

  test("FX4-E1 una solicitud sin confirmar todavía no muestra la invitación", async ({ page }) => {
    const { manageUrl } = await bookTaquiza(page, { monthsAhead: 2, dayIndex: 20 });
    await page.goto(manageUrl);
    await expect(page.getByText("Solicitada").first()).toBeVisible();
    await expect(page.getByRole("region", { name: "Avisa a tus invitados" })).toHaveCount(0);
  });
});

test.describe("FX5 recupera tu enlace sin códigos", () => {
  test("FX5-H1 con correo: le llegan sus enlaces y funcionan; la respuesta es la misma para un número sin taquizas", async ({ page, browser }) => {
    const email = `recupera${Date.now()}@correo.test`;
    const phone = `753${String(Date.now()).slice(-7)}`;
    const { code } = await bookTaquiza(page, { monthsAhead: 2, dayIndex: 22, email, phone });

    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const other = await ctx.newPage();
    await other.goto("/t/DGT-ZZZZ?k=inventado");
    await other.getByRole("link", { name: "Recuperar mi enlace" }).click();
    await expect(other.getByRole("heading", { name: "¿Perdiste el enlace de tu taquiza?", level: 1 })).toBeVisible();
    await a11y(other, "Recuperar enlace");
    await other.waitForLoadState("networkidle");
    await other.getByRole("button", { name: "Mandarme mi enlace" }).click();
    await expect(other.getByText("Escribe los 10 dígitos de tu WhatsApp.")).toBeVisible();
    await other.getByLabel("Tu WhatsApp").fill(phone);
    await other.getByRole("button", { name: "Mandarme mi enlace" }).click();
    await expect(other.getByRole("status").filter({ hasText: "Si ese número tiene taquizas próximas" })).toBeVisible();

    const recoverMail = async () => (await mock.emails(email)).find((e) => /Tu enlace de/.test(e.subject));
    await expect.poll(async () => (await recoverMail())?.text ?? "").toContain(code);
    const mail = (await recoverMail())!;
    const link = mail.text.match(new RegExp(`http://localhost:3100/t/${code}\\?k=\\S+`))![0];
    await other.goto(link);
    await expect(other.getByRole("heading", { name: "Tu taquiza", level: 1 })).toBeVisible();

    // Un número que no existe recibe exactamente la misma respuesta.
    await other.goto("/t/recuperar");
    await other.waitForLoadState("networkidle");
    await other.getByLabel("Tu WhatsApp").fill("7539999999");
    await other.getByRole("button", { name: "Mandarme mi enlace" }).click();
    await expect(other.getByRole("status").filter({ hasText: "Si ese número tiene taquizas próximas" })).toBeVisible();
    await ctx.close();
  });

  test("FX5-N1 abuso: el 4.º intento con el mismo número en una hora se frena", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const p = await ctx.newPage();
    const phone = `754${String(Date.now()).slice(-7)}`;
    for (let i = 0; i < 4; i++) {
      await p.goto("/t/recuperar");
      await p.waitForLoadState("networkidle");
      await p.getByLabel("Tu WhatsApp").fill(phone);
      await p.getByRole("button", { name: "Mandarme mi enlace" }).click();
      if (i < 3) await expect(p.getByText("Si ese número tiene taquizas próximas")).toBeVisible();
    }
    await expect(p.getByRole("alert").filter({ hasText: "Ya lo intentaste varias veces" })).toBeVisible();
    await ctx.close();
  });
});
