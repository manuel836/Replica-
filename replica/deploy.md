# Publicar: D' Garden Tacos

Fecha: 2026-11-25. Commit revisado: la punta de la rama `claude/replica-skill-plugin-install-et8rcf`
(ver el commit de este archivo). **Visto bueno del dueño: todavía no.**

Nada sale en vivo sin tu "sí". Tú creas las cuentas, compras el dominio y pegas las llaves (en
Vercel, nunca en el chat). Aquí van los resultados de la revisión y los pasos exactos.

## 1. Revisión previa

| revisión | resultado |
| --- | --- |
| Pruebas de punta a punta | ✅ **95 de 95 con Postgres**; con datos en memoria, 93 pasaron y 2 se saltaron (solo corren con Postgres). Corrida del 2026-11-25 en `7d1586d`. Después solo cambiaron documentos, el comando de build y `.env.example` |
| Bugs S1 o S2 abiertos | ✅ Ninguno. 9 encontrados y 9 corregidos (`replica/bugs.md`) |
| Paridad | ✅ 29 de 29 funciones obligatorias; puntuación 98.2 |
| Barrido de marca (`sweep.py`) | ✅ Limpio, código de salida 0 |
| Listado de tiendas (`listing.py`) | No aplica: no hay app en App Store ni Google Play. Termina con "no store section"; no se inventó un listado para que pasara |
| Build de producción (`npm run build`) | ✅ Pasa (2026-11-25) |
| `npm audit` (dependencias de producción) | ✅ 0 vulnerabilidades |
| Aviso de privacidad y políticas | ✅ En `/politicas`. Lista a quien procesa datos: Mercado Pago, Supabase, Vercel, Resend, Cloudflare Turnstile y WhatsApp. ⚠️ **El aviso es provisional y lo debe revisar un abogado** (lo pide la LFPDPPP en México) |
| Borrar datos | ✅ Los clientes no tienen cuenta. El dueño borra los datos de un cliente en Clientes ("Borrar sus datos"). El acceso de un ayudante se quita en Equipo |
| Banner de cookies | No hace falta: solo hay cookies necesarias (la sesión del panel y el regreso del pago), sin analítica ni anuncios. Si agregas analítica con cookies, se revisa |
| Favicon, títulos, imagen para compartir, correos | ✅ Son tuyos. ⚠️ **Los íconos son provisionales** (DG en un círculo) hasta que llegue el logo real |
| Rutas de prueba | ✅ `/design`, `/dev/checkout` y `/dev/media` dan 404 en producción |

### Lo que se arregló en esta revisión

- **Las migraciones ya las corre el deploy.** Antes el build no las aplicaba: había que correrlas a
  mano. Ahora `npm run build` primero corre `scripts/deploy-migrate.mjs`:
  - En el build de **producción** de Vercel aplica las migraciones pendientes.
  - En las **vistas previas** y en tu computadora no hace nada, así que una vista previa nunca
    toca la base de producción.
  - Si una migración falla, el build falla y la versión anterior sigue en línea.

  Probado con una base vacía (aplicó las 4), otra vez (ya estaba al día), en vista previa (no
  hizo nada) y sin base en producción (falló como debe).

### Lo que no es código pero bloquea el lanzamiento al público

Sin esto la página se ve "de ejemplo". Se puede publicar una **vista previa** para probar, pero no
anunciarla:

- [ ] Tus paquetes, precios, zonas, horario y anticipo (hoy son de ejemplo).
- [ ] Fotos reales y la descripción del negocio (hoy dice "Texto de ejemplo").
- [ ] Logo real (opcional para la vista previa).

## 2. Servicios de producción

Todo lo de esta sección lo haces tú, en tus cuentas. **Nunca pegues una llave en el chat.**

### Base de datos (Supabase)

- [ ] Un **proyecto nuevo solo para producción** (no el de pruebas), región cercana a México.
- [ ] Revisa en Supabase que los **respaldos diarios** estén activos para tu plan.
- [ ] Copia dos conexiones (Project Settings → Database → Connection string):
  - **Transaction pooler**, puerto 6543, para `DATABASE_URL`;
  - **Session pooler**, puerto 5432, para `DATABASE_URL_MIGRATIONS`.
- [ ] Storage: crea un bucket **público** llamado `fotos`.
- [ ] La **primera vez**, crea el negocio (con paquetes, zonas y horario de ejemplo, que luego
  cambias en el panel) y tu usuario de dueño:

  ```bash
  DATABASE_URL="…session pooler…" SEED_ADMIN_EMAIL="tu-correo" npm run db:seed
  ```

  Sin `--demo`, para que no cree datos de prueba. Las migraciones ya las corre el deploy.

### Variables en Vercel (Settings → Environment Variables, entorno **Production**)

Los nombres son los de `.env.example`:

| variable | valor |
| --- | --- |
| `APP_URL` | `https://dgardentacos.com` (tu dominio, sin `/` al final) |
| `APP_SECRET` | 48 caracteres al azar: `openssl rand -base64 48`. **Distinto** al de pruebas |
| `BUSINESS_SLUG` | `dgarden` |
| `DATABASE_URL`, `DATABASE_URL_MIGRATIONS`, `DATABASE_POOL_MAX` | Los de Supabase producción; `DATABASE_POOL_MAX=5` |
| `RESEND_API_KEY`, `EMAIL_FROM` | Llave de Resend; `D' Garden Tacos <avisos@dgardentacos.com>` |
| `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` | Credenciales de **producción** de Mercado Pago (ver abajo) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STORAGE_BUCKET` | Del proyecto de producción; `fotos` |
| `CRON_SECRET` | Otro valor al azar. Vercel lo manda al job diario |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Opcional (antispam) |

**No pongas** en producción `MP_API_BASE`, `RESEND_API_BASE` ni `SHOW_DESIGN`: solo sirven para
las pruebas. Para las vistas previas (entorno Preview), usa una base de pruebas aparte y las
credenciales `TEST-` de Mercado Pago. Nunca la base de producción.

### Mercado Pago (en lugar de Stripe)

- [ ] Primero, en la **vista previa** con credenciales `TEST-` y tarjetas de prueba: un pago
  aprobado y uno rechazado (lista manual de `test-plan.md`).
- [ ] Ya en producción, en Tus integraciones → tu aplicación:
  - **credenciales de producción** → `MP_ACCESS_TOKEN`;
  - Webhooks → URL `https://dgardentacos.com/api/webhooks/mercadopago`, evento **Pagos**;
  - copia la **clave secreta** → `MP_WEBHOOK_SECRET`.
- [ ] No hay productos ni precios que crear: cada anticipo se arma solo.
- [ ] **Un cobro real y su reembolso:** agenda una taquiza tuya con un anticipo pequeño (pon el
  anticipo en monto fijo bajo un momento), págalo con tu tarjeta y reembólsalo desde el panel
  con "Reembolsar parte del anticipo". Revisa que el dinero regrese.

### Inicio de sesión

No hay Google ni Apple: el panel entra con un enlace al correo. No hay URIs que registrar.

### Correo (Resend)

- [ ] En Resend → Domains, agrega `dgardentacos.com`. Te da los registros DNS (sección 3).
- [ ] Cuando Resend diga "Verified", manda una prueba: pide un enlace de entrada al panel y
  revisa que llegue a la bandeja de entrada y no a spam.

## 3. Hosting y dominio

**Vercel** (el sistema ya trae `vercel.json` con el job diario a las 14:00 UTC, las 8:00 en Lázaro
Cárdenas).

- [ ] **Conectar el repositorio:** en Vercel, New Project → importa `manuel836/Replica-`.
- [ ] **Llevar el código a `main`:** hoy vive en la rama `claude/replica-skill-plugin-install-et8rcf`.
  Se abre un pull request y lo apruebas. Después, `main` publica producción y cada pull request
  tiene su vista previa.
- [ ] **Comprar el dominio** en tu registrador, por ejemplo `dgardentacos.com` (`brand.md`), y
  agregarlo en Vercel → Settings → Domains.

**Registros DNS** (en tu registrador; confirma los valores exactos en las pantallas de Vercel y
Resend):

| registro | nombre | valor | para qué |
| --- | --- | --- | --- |
| A | `@` | La IP que muestra Vercel en Domains (hoy suele ser `76.76.21.21`) | La página |
| CNAME | `www` | `cname.vercel-dns.com` | La página con www |
| TXT | El que pida Vercel | El valor de verificación, si lo pide | Probar que el dominio es tuyo |
| TXT (SPF) | El que indique Resend (suele ser `send`) | El que indique Resend | Que tus correos no lleguen a spam |
| TXT o CNAME (DKIM) | `resend._domainkey` | El que indique Resend | Firma de tus correos |
| MX | El que indique Resend (suele ser `send`) | El que indique Resend | Rebotes |
| TXT (DMARC) | `_dmarc` | `v=DMARC1; p=none; rua=mailto:tu-correo@dgardentacos.com` | Reportes. Cuando lleguen limpios, cambia a `p=quarantine` |

- [ ] **Una sola dirección principal:** `dgardentacos.com` (sin www); en Vercel, `www` redirige a
  ella. `APP_URL` usa esa misma.
- [ ] **HTTPS:** Vercel pone el certificado solo. Revisa el candado en el navegador.

## 4. Vigilar

| qué | cómo | estado |
| --- | --- | --- |
| Errores | Logs de Vercel (Deployments → Logs). Para avisos por correo, agregar Sentry o la observabilidad de Vercel, y anotarlo en el aviso de privacidad | Por decidir |
| Que la página esté arriba | Un monitor gratuito que revise cada pocos minutos `https://dgardentacos.com/` y `https://dgardentacos.com/api/disponibilidad/mes?mes=AAAA-MM&invitados=50`, y te avise por correo o celular | Por hacer |
| Correos que no salieron | Ajustes muestra los correos "muertos"; el job diario reintenta | ✅ Ya en el sistema |
| Resumen diario | Correo de las 8:00 con las taquizas de mañana y lo pendiente | ✅ Ya en el sistema |
| Ventas | Panel → Reportes | ✅ Ya en el sistema |
| Analítica de visitas | Opcional. Una sin cookies evita el banner | Por decidir |

**El primer día en vivo:**
- [ ] Yo reviso la página publicada: portada, agendar, Mi taquiza y panel, en escritorio.
- [ ] Tú haces el flujo completo **en tu celular**: agendar, pagar el anticipo real, recibir el
  correo, aceptar desde el panel, mandar el WhatsApp, cancelar y ver el reembolso.

**La primera semana, revisa:**
- que el job diario corra (llega el resumen de las 8:00);
- que no haya correos muertos en Ajustes;
- que los pagos y reembolsos cuadren en Reportes contra Mercado Pago;
- los motivos de cancelación;
- que respondas las solicitudes el mismo día.

## 5. App de celular

No aplica: es una página web que funciona en cualquier celular y se puede "agregar a la pantalla
de inicio" (ya tiene el ícono). Sin cuentas de Apple ni Google Play.

## Pendiente de ti para seguir

1. **El visto bueno** para preparar el pull request a `main`.
2. Las cuentas: Vercel, Supabase (proyecto de producción), Resend, Mercado Pago y el dominio.
3. Tus datos, fotos y descripción en el panel.

Cuando la vista previa esté arriba, hacemos la lista manual juntos. Luego las llaves de
producción, el dominio y el anuncio (`replica/launch/launch-plan.md`).
