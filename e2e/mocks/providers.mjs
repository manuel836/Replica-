// Imitación local de las APIs de Mercado Pago (Checkout Pro, pagos, reembolsos) y Resend,
// con los formatos de su documentación y SDK oficiales. Solo para pruebas: nunca se llama a
// los servicios reales.
import { createHmac, randomUUID } from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_PORT ?? 4010);
const SECRET = process.env.MP_WEBHOOK_SECRET ?? "whsec-e2e";
const fresh = () => ({ prefs: {}, payments: {}, refunds: [], emails: [], webhooks: [], failEmail: false, nextPay: 9000001, nextNotif: 1 });
let state = fresh();

const readBody = (req) => new Promise((r) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => r(b)); });
const json = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };

async function sendWebhook(pref, payId, { badSignature = false, notifId } = {}) {
  const ts = Math.floor(Date.now() / 1000);
  const reqId = randomUUID();
  const manifest = `id:${payId};request-id:${reqId};ts:${ts};`;
  const v1 = createHmac("sha256", badSignature ? "otra-clave" : SECRET).update(manifest).digest("hex");
  const id = notifId ?? state.nextNotif++;
  const res = await fetch(`${pref.body.notification_url}?data.id=${payId}&type=payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": reqId },
    body: JSON.stringify({ id, live_mode: false, type: "payment", date_created: new Date().toISOString(), user_id: 1, api_version: "v1", action: "payment.created", data: { id: String(payId) } }),
  });
  const r = { payId, notifId: id, status: res.status, body: await res.text(), badSignature };
  state.webhooks.push(r);
  return r;
}

createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  const auth = req.headers.authorization ?? "";
  let m;
  try {
    if (u.pathname === "/__health") return json(res, 200, { ok: true });
    if (u.pathname === "/__reset") { state = fresh(); return json(res, 200, { ok: true }); }
    if (u.pathname === "/__state") return json(res, 200, state);
    if (u.pathname === "/__emails") return json(res, 200, state.emails.filter((e) => !u.searchParams.get("to") || e.to.includes(u.searchParams.get("to"))));
    if (u.pathname === "/__last-link") {
      const to = u.searchParams.get("to");
      const e = [...state.emails].reverse().find((x) => x.to.includes(to) && /auth\/confirmar/.test(x.text));
      return json(res, 200, { link: e ? e.text.match(/http\S+auth\/confirmar\?t=[\w-]+/)[0] : null });
    }
    if (u.pathname === "/__fail-email") { state.failEmail = u.searchParams.get("on") === "1"; return json(res, 200, { failEmail: state.failEmail }); }
    if (u.pathname === "/__resend-webhook") {
      const payId = Number(u.searchParams.get("pay"));
      const p = state.prefs[state.payments[payId].pref];
      const bad = u.searchParams.get("bad") === "1";
      const prior = state.webhooks.find((w) => w.payId === payId && !w.badSignature);
      return json(res, 200, await sendWebhook(p, payId, { badSignature: bad, notifId: bad ? undefined : prior?.notifId }));
    }

    // ---- Mercado Pago ----
    if (req.method === "POST" && u.pathname.replace(/\/$/, "") === "/checkout/preferences") {
      if (!auth.startsWith("Bearer TEST-")) return json(res, 401, { message: "invalid token" });
      const body = JSON.parse(await readBody(req));
      const id = `pref-${randomUUID()}`;
      state.prefs[id] = { id, body, idem: req.headers["x-idempotency-key"] };
      return json(res, 201, { id, init_point: `http://localhost:${PORT}/checkout/${id}`, sandbox_init_point: `http://localhost:${PORT}/checkout/${id}?sandbox=1` });
    }
    if (req.method === "GET" && (m = u.pathname.match(/^\/checkout\/(pref-[\w-]+)$/))) {
      const p = state.prefs[m[1]];
      if (!p) { res.writeHead(404); return res.end("no pref"); }
      const it = p.body.items[0];
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(`<!doctype html><html lang="es"><head><title>Checkout simulado</title></head><body><main><h1>Pago de prueba</h1><p>${it.title}: $${it.unit_price} ${it.currency_id}</p><form method="post" action="/checkout/${p.id}/pay"><button name="r" value="approved">Aprobar pago</button> <button name="r" value="rejected">Rechazar pago</button></form></main></body></html>`);
    }
    if (req.method === "POST" && (m = u.pathname.match(/^\/checkout\/(pref-[\w-]+)\/pay$/))) {
      const p = state.prefs[m[1]];
      const r = new URLSearchParams(await readBody(req)).get("r") === "approved" ? "approved" : "rejected";
      const payId = state.nextPay++;
      state.payments[payId] = { id: payId, status: r, external_reference: p.body.external_reference, transaction_amount: p.body.items[0].unit_price, currency_id: "MXN", payment_type_id: "credit_card", pref: p.id };
      await sendWebhook(p, payId);
      const back = r === "approved" ? p.body.back_urls.success : p.body.back_urls.failure;
      res.writeHead(303, { Location: `${back}&collection_status=${r}&payment_id=${payId}` });
      return res.end();
    }
    if (req.method === "GET" && (m = u.pathname.match(/^\/v1\/payments\/(\d+)$/))) {
      if (!auth.startsWith("Bearer TEST-")) return json(res, 401, { message: "invalid token" });
      const p = state.payments[m[1]];
      return p ? json(res, 200, p) : json(res, 404, { message: "Payment not found" });
    }
    if (req.method === "POST" && (m = u.pathname.match(/^\/v1\/payments\/(\d+)\/refunds$/))) {
      const idem = req.headers["x-idempotency-key"];
      if (!idem) return json(res, 400, { message: "Header-X-Idempotency-Key-can't-be-null" });
      const prior = state.refunds.find((x) => x.idem === idem);
      if (prior) return json(res, 201, prior.resp);
      const body = JSON.parse((await readBody(req)) || "{}");
      const resp = { id: 7000000 + state.refunds.length, payment_id: Number(m[1]), amount: body.amount, status: "approved" };
      state.refunds.push({ idem, resp });
      if (state.payments[m[1]]) state.payments[m[1]].status = "refunded";
      return json(res, 201, resp);
    }
    // ---- Resend ----
    if (req.method === "POST" && u.pathname === "/emails") {
      if (!auth.startsWith("Bearer re_")) return json(res, 401, { message: "invalid key" });
      const body = JSON.parse(await readBody(req));
      if (state.failEmail) return json(res, 500, { message: "simulated outage" });
      state.emails.push({ to: body.to.join(","), subject: body.subject, text: body.text, from: body.from });
      return json(res, 200, { id: randomUUID() });
    }
    res.writeHead(404);
    res.end("not found");
  } catch (e) {
    json(res, 500, { message: String(e) });
  }
}).listen(PORT, () => console.log(`proveedores simulados en :${PORT}`));
