# Precios: cómo cobrar y cómo presentarlo

Este paso está pensado para apps que venden suscripciones (planes, Stripe, cobro mensual o
anual). D' Garden Tacos vende taquizas: el precio es **por persona y por paquete**, con anticipo
opcional. Aquí va lo que sí aplica, sin inventar cifras.

## 1. Comparación de precios

| quién | qué cobra | fuente | leído |
| --- | --- | --- | --- |
| OpenTable | Cobra al **restaurante** con planes (la página de planes no se pudo leer: devolvió 503 en la recon). Al comensal no le cobra; el restaurante puede pedir depósito o cobrar si no llega | opentable.com/restaurant-solutions/plans | 2026-11-24, **no legible** |
| Taquiza competidora 1 en Lázaro Cárdenas | **Por llenar** | — | — |
| Taquiza competidora 2 | **Por llenar** | — | — |
| Taquiza competidora 3 | **Por llenar** | — | — |

OpenTable no es tu competencia en precio: tu competencia son otros taqueros y banquetes de la
zona. No se llenó la tabla porque sus precios no son públicos en internet y Facebook pide iniciar
sesión. **Cómo llenarla:**
- Pide cotización a 2 o 3 taquizas de la zona para el mismo evento (por ejemplo, 50 personas, un
  sábado).
- Anota precio por persona, qué incluye, anticipo, traslado y la **fecha en que lo preguntaste**:
  los precios cambian.

## 2. Lo que dicen las reseñas sobre precios y cobros

De `replica/feedback.md` (1,061 reseñas, 3 fuentes):

| tema | reseñas | fuentes | qué significa para ti |
| --- | --- | --- | --- |
| Cargos, depósitos y tarjeta retenida | 21 | 3 | La gente odia que le retengan dinero sin saber cuándo vuelve. Ya resuelto: se puede apartar sin pagar en línea, y antes de pagar se ve hasta qué día se devuelve el anticipo y cuánto (FX3) |
| Precio y pagos dentro de la app | 21 | 3 | Sobre todo "service charge" y cobros que aparecen al final. Tú enseñas el total estimado y el anticipo **antes** de enviar |
| Cobros y reembolsos | 4 | 2 | Reembolsos que tardan o no llegan. Los tuyos salen solos al cancelar a tiempo, y el correo dice el monto |
| Lo que paga el restaurante por comensal | 11 | 3 | Del lado del negocio: con tu propia página no pagas comisión por invitado |

## 3. El modelo

Lo que el sistema ya sabe cobrar. Los valores los pones tú en el panel:

| pieza | dónde se captura | sugerencia para presentarlo |
| --- | --- | --- |
| Precio por persona de cada paquete | Paquetes | Que el nombre diga para quién es: "Para la familia", "Para la fiesta grande". En la tarjeta se ve "$150 por persona" |
| Mínimo de invitados (y máximo, si hay) | Paquetes | Que el mínimo sea realista para que te convenga ir; el sistema no deja agendar menos |
| Traslado por zona | Zonas | Ciudad sin costo y lo de fuera con cargo fijo: se ve antes de agendar |
| Anticipo: ninguno, opcional u obligatorio; porcentaje o monto | Ajustes | Opcional al principio, para no ahuyentar a quien no paga en línea; obligatorio si te dejan plantado |
| Días para devolver el anticipo | Ajustes | Un número que puedas sostener (7 días es el de ejemplo). La página y los correos ponen la fecha exacta solos |

**Tres paquetes como máximo**, con nombres por tipo de evento y no "básico, plus, premium". Más
opciones hacen dudar.

## 4. Cobros que no generan quejas (ya en el sistema)

- **El cliente ve todo antes de enviar:** el total estimado y el anticipo.
- **Fecha exacta del reembolso:** "Si cancelas a más tardar el viernes 15 de enero, te
  devolvemos $1,800", al pagar, en "Mi taquiza" y en el correo.
- **Cancelar en 2 toques** desde su enlace, con el reembolso automático dentro del plazo.
- **Reembolso parcial** desde el panel, solo el dueño, si quieres compensar algo.
- **Sin tarjeta para apartar** si el anticipo es opcional.

## 5. Lo que hay que crear en el proveedor de pagos

Con Stripe habría que crear "productos y precios". Con **Mercado Pago Checkout Pro no hace falta
un catálogo**: el sistema arma el cobro del anticipo de cada taquiza en el momento, con su monto.
Lo único que creas tú es tu aplicación en Mercado Pago y sus credenciales (pasos en
`replica/backend.md`).

**Por revisar antes de lanzar:**
- **La comisión de Mercado Pago** por cobro con tarjeta: revísala en su página de comisiones y
  súmala a tu cuenta. No la pongo aquí porque no la verifiqué.
- **Lo que cuesta tener el sistema en línea** (Vercel, Supabase y Resend tienen planes
  gratuitos con límites): revísalo en sus páginas de precios cuando abras las cuentas. No lo
  verifiqué aquí.
