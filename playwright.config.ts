import { defineConfig, devices } from "@playwright/test";

// Pruebas de punta a punta. Levantan:
//   1. Una imitación local de Mercado Pago y Resend (e2e/mocks/providers.mjs).
//   2. La app en modo desarrollo apuntando a esa imitación.
// Datos: por defecto la capa en memoria (se reinicia con cada corrida). Con E2E_DATABASE_URL,
// Postgres: e2e/reset-db.mjs borra y vuelve a crear esa base antes de arrancar la app
// (¡usa una base solo para pruebas!).
//
//   npm run test:e2e
//   E2E_DATABASE_URL=postgres://…/taquizas_e2e npm run test:e2e

const PORT = 3100;
const MOCK = 4010;
const pg = process.env.E2E_DATABASE_URL;

export const MOCK_URL = `http://localhost:${MOCK}`;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  // Un solo trabajador: las pruebas comparten el servidor y algunas cambian ajustes del negocio.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e/report" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "es-MX",
    timezoneId: "America/Mexico_City",
    trace: "off",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, dependencies: ["setup"], testIgnore: /auth\.setup\.ts/ },
  ],
  webServer: [
    {
      command: "node e2e/mocks/providers.mjs",
      url: `${MOCK_URL}/__health`,
      reuseExistingServer: false,
      env: { MOCK_PORT: String(MOCK), MP_WEBHOOK_SECRET: "whsec-e2e" },
    },
    {
      command: pg ? `node e2e/reset-db.mjs && npx next dev -p ${PORT}` : `npx next dev -p ${PORT}`,
      url: `http://localhost:${PORT}/politicas`,
      timeout: 180_000,
      reuseExistingServer: false,
      env: {
        NEXT_TELEMETRY_DISABLED: "1",
        APP_URL: `http://localhost:${PORT}`,
        MP_ACCESS_TOKEN: "TEST-e2e",
        MP_WEBHOOK_SECRET: "whsec-e2e",
        MP_API_BASE: MOCK_URL,
        RESEND_API_KEY: "re_e2e",
        RESEND_API_BASE: MOCK_URL,
        EMAIL_FROM: "D' Garden Tacos <avisos@dgarden.test>",
        ...(pg ? { DATABASE_URL: pg, E2E_DATABASE_URL: pg } : {}),
      },
    },
  ],
});
