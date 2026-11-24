import { OWNER_STATE, a11y, emailLogin, expect, mock, test } from "./helpers";

test.use({ storageState: OWNER_STATE });

// Equipo: el dueño da y quita acceso a ayudantes (agregado después de /replica-diff).

test.describe("Equipo del panel", () => {
  test("EQ-H1 el dueño agrega un ayudante, este entra con su correo, y al quitarlo pierde el acceso", async ({ browser, newWatchedPage }) => {
    const email = `nuevo${Date.now()}@dgarden.test`;
    const ownerCtx = await browser.newContext({ storageState: OWNER_STATE });
    const owner = await newWatchedPage(ownerCtx);
    await owner.goto("/admin/equipo");
    await expect(owner.getByRole("heading", { name: "Equipo", level: 1 })).toBeVisible();
    await a11y(owner, "Equipo");
    await owner.getByLabel("Correo del ayudante").fill(email.toUpperCase());
    await owner.getByRole("button", { name: "Dar acceso" }).click();
    await expect(owner.locator("[data-sonner-toast]").filter({ hasText: email })).toBeVisible();
    const members = owner.getByRole("region", { name: "Con acceso" });
    await expect(members.getByRole("listitem").filter({ hasText: email })).toContainText("Ayudante");

    // Le llega la invitación y entra con un enlace a su correo.
    await expect.poll(async () => (await mock.emails(email)).map((e) => e.subject).join()).toMatch(/Te dieron acceso al panel/);
    const helperCtx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const helper = await newWatchedPage(helperCtx);
    await emailLogin(helper, email);
    await expect(helper.getByRole("heading", { name: "Agenda", level: 1 })).toBeVisible();
    await helper.goto("/admin/equipo");
    await expect(helper).toHaveURL(/aviso=sin-permiso/);

    // El dueño le quita el acceso: su sesión abierta ya no sirve.
    await owner.getByRole("button", { name: `Quitar acceso a ${email}` }).click();
    await owner.getByRole("button", { name: "Sí, quitar acceso" }).click();
    await expect(owner.locator("[data-sonner-toast]").filter({ hasText: "Acceso quitado" })).toBeVisible();
    await expect(members.getByRole("listitem").filter({ hasText: email })).toHaveCount(0);
    await helper.goto("/admin");
    await expect(helper).toHaveURL(/\/admin\/entrar/);
    await ownerCtx.close();
    await helperCtx.close();
  });

  test("EQ-N1 correo inválido o que ya tiene acceso: no se agrega", async ({ page }) => {
    await page.goto("/admin/equipo");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Correo del ayudante").fill("no-es-correo");
    await page.getByRole("button", { name: "Dar acceso" }).click();
    await expect(page.getByText("Escribe un correo válido.")).toBeVisible();
    await page.getByLabel("Correo del ayudante").fill("dueno@dgarden.test");
    await page.getByRole("button", { name: "Dar acceso" }).click();
    await expect(page.getByText("Ese correo ya tiene acceso a un panel.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Quitar acceso a dueno@/ })).toHaveCount(0);
  });
});
