import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";

export const MOCK = "http://localhost:4010";
export const OWNER = "dueno@dgarden.test";
export const HELPER = "ayudante@dgarden.test";
export const OWNER_STATE = "e2e/.auth/owner.json";
export const HELPER_STATE = "e2e/.auth/helper.json";

// ---------------------------------------------------------------------------
// Guardias: toda prueba falla si hay errores de consola, errores de página o respuestas 5xx.
// ---------------------------------------------------------------------------

export function watch(page: Page, problems: string[]) {
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`consola en ${page.url()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`error de página en ${page.url()}: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 500) problems.push(`${r.status()} en ${r.url()}`);
  });
}

/** IP distinta por contexto: los límites por IP no deben mezclar pruebas independientes. */
const randomIp = () => `10.${rand(255)}.${rand(255)}.${rand(255)}`;
const rand = (n: number) => Math.floor(Math.random() * n);

export const test = base.extend<{ problems: string[]; guard: void; newWatchedPage: (ctx?: BrowserContext) => Promise<Page> }>({
  context: async ({ context }, use) => {
    await context.setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });
    await use(context);
  },
  problems: async ({}, use) => {
    await use([]);
  },
  guard: [
    async ({ page, problems }, use) => {
      watch(page, problems);
      await use();
      expect(problems, "errores de consola, de página o respuestas 5xx").toEqual([]);
    },
    { auto: true },
  ],
  newWatchedPage: async ({ browser, problems }, use) => {
    const opened: BrowserContext[] = [];
    await use(async (ctx) => {
      const c = ctx ?? (await browser.newContext({ locale: "es-MX", timezoneId: "America/Mexico_City", extraHTTPHeaders: { "x-forwarded-for": randomIp() } }));
      if (!ctx) opened.push(c);
      const p = await c.newPage();
      watch(p, problems);
      return p;
    });
    for (const c of opened) await c.close();
  },
});
export { expect };

/** Revisión de accesibilidad (WCAG 2.0-2.2 A/AA + buenas prácticas) de lo que hay en pantalla. */
export async function a11y(page: Page, label = page.url()) {
  // @axe-core/playwright trae otra versión de los tipos de Playwright; el objeto es el mismo.
  const r = await new AxeBuilder({ page: page as never }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`),
    `accesibilidad en ${label}`,
  ).toEqual([]);
}

// ---------------------------------------------------------------------------
// Imitación de proveedores
// ---------------------------------------------------------------------------

export const mock = {
  async get<T = unknown>(path: string): Promise<T> {
    return (await (await fetch(MOCK + path)).json()) as T;
  },
  emails: (to?: string) => mock.get<{ to: string; subject: string; text: string; from: string; replyTo: string | null }[]>(`/__emails${to ? `?to=${encodeURIComponent(to)}` : ""}`),
  lastLink: async (to: string) => (await mock.get<{ link: string | null }>(`/__last-link?to=${encodeURIComponent(to)}`)).link,
  state: () => mock.get<MockState>("/__state"),
  failEmail: (on: boolean) => mock.get(`/__fail-email?on=${on ? 1 : 0}`),
  resendWebhook: (payId: number, bad = false) => mock.get<{ status: number; body: string }>(`/__resend-webhook?pay=${payId}${bad ? "&bad=1" : ""}`),
};

export interface MockState {
  prefs: Record<string, { id: string; idem?: string; body: { external_reference: string; notification_url: string; binary_mode: boolean; items: { unit_price: number; currency_id: string }[]; payment_methods: { excluded_payment_types: { id: string }[] } } }>;
  payments: Record<string, { id: number; status: string; external_reference: string }>;
  refunds: { idem: string; resp: { payment_id: number; amount: number } }[];
  webhooks: { payId: number; status: number; badSignature: boolean }[];
}

// ---------------------------------------------------------------------------
// Pasos que se repiten
// ---------------------------------------------------------------------------

/** Pide el enlace de entrada, lo saca del correo (imitación de Resend) y entra. */
export async function emailLogin(page: Page, email = OWNER) {
  await page.goto("/admin/entrar");
  await page.getByLabel("Correo").fill(email);
  await page.getByRole("button", { name: /Mandarme el enlace/ }).click();
  await expect(page.getByText("Revisa tu correo")).toBeVisible();
  const link = await mock.lastLink(email);
  expect(link, `enlace en el correo de ${email}`).toBeTruthy();
  await page.goto(link!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("/admin");
  return link!;
}

const uniquePhone = () => `753${String(1_000_000 + rand(8_999_999)).slice(0, 7)}`;

export interface BookingOpts {
  guests?: number;
  /** Meses a avanzar en el calendario antes de elegir día. */
  monthsAhead?: number;
  /** Índice del día habilitado a elegir (0 = el primero). */
  dayIndex?: number;
  slotIndex?: number;
  name?: string;
  phone?: string;
  address?: string;
  notes?: string;
  /** Correo opcional del cliente (para los correos de confirmación y recordatorio). */
  email?: string;
  payNow?: boolean;
}

/** Va al paso 1 y elige día y hora. Devuelve el texto "Cuándo" del resumen lateral. */
export async function pickDayAndSlot(page: Page, o: BookingOpts = {}) {
  await page.goto(`/agendar?invitados=${o.guests ?? 40}`);
  for (let i = 0; i < (o.monthsAhead ?? 0); i++) {
    await page.getByRole("button", { name: "Mes siguiente", exact: true }).click();
  }
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  for (let i = 0; i < 4; i++) {
    const days = page.locator('table[role="grid"] button:not([disabled])');
    if ((await days.count()) > (o.dayIndex ?? 0)) {
      await days.nth(o.dayIndex ?? 0).click();
      break;
    }
    await page.getByRole("button", { name: "Mes siguiente", exact: true }).click();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  }
  const slot = page.locator("fieldset input[type=radio]:not([disabled])").nth(o.slotIndex ?? 0);
  await slot.waitFor({ state: "attached" });
  await page.locator(`label[for="${await slot.getAttribute("id")}"]`).click();
  return (await page.getByRole("complementary", { name: "Tu taquiza" }).locator("dd").nth(1).innerText()).trim();
}

export async function fillDetails(page: Page, o: BookingOpts = {}) {
  await page.getByLabel("Tu nombre").fill(o.name ?? "Cliente E2E");
  await page.getByLabel("WhatsApp").fill(o.phone ?? uniquePhone());
  await page.getByLabel("Zona").selectOption({ index: 1 });
  await page.getByLabel("Calle y número").fill(o.address ?? "Av. de Pruebas 123");
  await page.getByLabel(/^Colonia/).fill("Centro");
  if (o.notes) await page.getByLabel(/^Notas/).fill(o.notes);
  if (o.email) await page.getByLabel(/^Correo/).fill(o.email);
}

/** Agenda de punta a punta. Con payNow aprueba el pago en la imitación de Mercado Pago. */
export async function bookTaquiza(page: Page, o: BookingOpts = {}) {
  const when = await pickDayAndSlot(page, o);
  await page.getByRole("button", { name: "Continuar" }).click();
  await fillDetails(page, o);
  await page.getByRole("button", { name: "Continuar" }).click();
  if (o.payNow) {
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Ir a pagar el anticipo" }).click();
    await page.waitForURL(/localhost:4010\/checkout\//);
    await page.getByRole("button", { name: "Aprobar pago" }).click();
    await page.waitForURL(/\/pago\?resultado=aprobado/);
    await expect(page.getByRole("heading", { name: /Pago recibido/ })).toBeVisible();
    await page.getByRole("link", { name: "Ver mi taquiza" }).click();
  } else {
    await page.getByText("Agendar sin pagar en línea").click();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Enviar solicitud" }).click();
  }
  await page.waitForURL(/\/t\/DGT-[A-Z0-9]+\?k=/);
  const url = new URL(page.url());
  const code = url.pathname.split("/")[2];
  url.searchParams.delete("nuevo");
  return { code, manageUrl: url.toString(), when };
}

/** Id de una taquiza en el panel a partir de su código (busca en todas las pestañas). */
export async function bookingIdByCode(page: Page, code: string): Promise<string> {
  for (const tab of ["pendientes", "proximas", "canceladas", "pasadas"]) {
    await page.goto(`/admin?tab=${tab}`);
    const card = page.locator(`main a[href^="/admin/t/"]`).filter({ hasText: code });
    if (await card.count()) return (await card.first().getAttribute("href"))!.split("/").pop()!;
  }
  throw new Error(`No encontré ${code} en la agenda`);
}

/** El enlace privado del cliente, como lo manda el panel por WhatsApp. */
export async function manageUrlFromPanel(request: APIRequestContext, bookingId: string, plantilla = "confirmed"): Promise<string> {
  const r = await request.get(`/admin/t/${bookingId}/whatsapp?plantilla=${plantilla}`, { maxRedirects: 0 });
  const text = decodeURIComponent(r.headers()["location"]?.split("text=")[1] ?? "");
  const m = text.match(/http:\/\/localhost:3100\/t\/\S+/);
  if (!m) throw new Error(`El mensaje no trae enlace: ${text}`);
  return m[0];
}
