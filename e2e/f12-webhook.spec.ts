import { OWNER_STATE, bookTaquiza, bookingIdByCode, expect, mock, test } from "./helpers";

test.describe("F12 avisos de pago de Mercado Pago", () => {
  test("F12-N1/E1 firma falsa: 401; aviso repetido: no duplica nada", async ({ page, browser, newWatchedPage }) => {
    const { code } = await bookTaquiza(page, { monthsAhead: 2, dayIndex: 14, payNow: true });
    const st = await mock.state();
    const pay = Object.values(st.payments).filter((p) => p.status === "approved").at(-1)!;

    const bad = await mock.resendWebhook(pay.id, true);
    expect(bad.status).toBe(401);
    const dup = await mock.resendWebhook(pay.id);
    expect(dup.status).toBe(200);
    expect(dup.body).toContain("duplicate");

    const ctx = await browser.newContext({ storageState: OWNER_STATE });
    const admin = await newWatchedPage(ctx);
    const id = await bookingIdByCode(admin, code);
    await admin.goto(`/admin/t/${id}`);
    await expect(admin.getByRole("list", { name: "Pagos" }).getByText(/Anticipo · tarjeta · aprobado/)).toHaveCount(1);
    await ctx.close();
  });

  test("F12-N2 aviso sin firma: 401 y no toca nada", async ({ request }) => {
    const r = await request.post("/api/webhooks/mercadopago?data.id=123&type=payment", {
      data: { id: 1, type: "payment", data: { id: "123" } },
    });
    expect(r.status()).toBe(401);
  });
});
