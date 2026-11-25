import { test as setup } from "@playwright/test";
import { HELPER, HELPER_STATE, OWNER, OWNER_STATE, emailLogin } from "./helpers";

// Entra una vez como dueño y otra como ayudante; las pruebas del panel reusan esas sesiones.
setup("sesión del dueño (y correo de avisos del negocio)", async ({ page }) => {
  await emailLogin(page, OWNER);
  // Correo del negocio para que los avisos al dueño salgan por correo.
  await page.goto("/admin/ajustes");
  await page.getByLabel(/^Correo para avisos/).fill("avisos-dueno@dgarden.test");
  await page.getByRole("button", { name: "Guardar ajustes" }).click();
  await page.getByText("Ajustes guardados").waitFor();
  await page.context().storageState({ path: OWNER_STATE });
});

setup("sesión del ayudante", async ({ page }) => {
  await emailLogin(page, HELPER);
  await page.context().storageState({ path: HELPER_STATE });
});
