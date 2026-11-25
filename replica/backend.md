# Backend: taquizas de D' Garden Tacos

Estado al 2026-11-24. Todo se probó contra **Postgres 16 real** y contra una **imitación local**
de las APIs de Mercado Pago y Resend, con los formatos de sus SDK y documentación oficiales.
**Falta probarlo con las llaves reales del dueño** (ver "Qué tiene que hacer el dueño").

## Qué hay

| pieza | cómo | archivos |
| --- | --- | --- |
| Base de datos | Postgres (Supabase, Neon o local) con postgres-js. Migraciones numeradas; las corre `npm run db:migrate` | `db/migrations/`, `scripts/migrate.mjs`, `src/server/data/postgres.ts` |
| Capacidad sin dobles reservas | `pg_advisory_xact_lock` por negocio y día, y `capacity_conflict()` en SQL dentro de la misma transacción. Las consultas dentro del candado van por esa transacción (AsyncLocalStorage) | `0001_schema.sql`, `postgres.ts` (`withDayLock`) |
| Seed | Negocio, horario, paquetes y zonas de ejemplo, y el usuario dueño. `--demo` agrega clientes y taquizas inventados (bloqueado en producción) | `scripts/seed.mjs` |
| Acceso del panel | Enlace mágico **de un solo uso** por correo; vence en 15 min; en la base solo va su sha256. Para entrar hay que confirmar con un botón (POST), así los lectores de correo no gastan el enlace | `src/server/auth.ts`, `src/app/auth/*` |
| Sesiones | Cookie httpOnly, secure y SameSite=Lax, firmada con HMAC (id, versión, vencimiento). "Cerrar sesión en todos lados" sube la versión | `auth.ts`, Ajustes → Seguridad |
| Roles | `owner` y `helper`. `requireAdmin(rol)` en cada acción y página del panel; además, la persona tiene que ser de ESTE negocio | `auth.ts` |
| Pagos | Mercado Pago Checkout Pro por API REST: preferencia con `binary_mode`, vencimiento igual al apartado y sin OXXO, cajero ni transferencia. Reembolsos con `X-Idempotency-Key` | `src/server/payments.ts` |
| Webhook | Firma `x-signature` (HMAC-SHA256 de `id:{data.id};request-id:{x-request-id};ts:{ts};`, igual que el SDK oficial). Un registro por aviso en `webhook_events`. El pago se consulta en la API, nunca se lee del aviso. Si algo falla responde 500 y Mercado Pago reintenta | `src/app/api/webhooks/mercadopago/route.ts` |
| Correo | Resend por API REST. Todo pasa por `outbox`: se intenta al momento; si falla, reintentos a 1 min, 10 min, 1 h, 6 h y 24 h. Al quinto fallo queda "muerto" y se ve en Ajustes | `src/server/email.ts`, `src/server/notify.ts` |
| Job diario | Vercel Cron a las 14:00 UTC (08:00 en Lázaro Cárdenas). Vence apartados y propuestas, manda el resumen al dueño, reintenta correos y limpia contadores. Cada corrida queda en `job_runs` | `src/app/api/cron/diario/route.ts`, `vercel.json` |
| Fotos | Supabase Storage, bucket público en otro dominio. El navegador reduce la foto a 2000 px; el servidor revisa los bytes reales (JPG, PNG o WebP) y que pese máximo 4 MB, y la guarda con nombre aleatorio | `src/server/storage.ts`, `src/components/PhotoUpload.tsx` |
| Antispam | Turnstile opcional, más límites: 20 solicitudes por IP por hora, 3 por WhatsApp por hora, 20 enlaces de entrada por IP y 5 por correo por hora | `src/server/turnstile.ts`, `rate_limits` |

### Decisiones que cambian `architecture.md`

- **Sin Supabase Auth.** Un enlace mágico propio de un solo uso hace lo mismo, funciona con
  cualquier Postgres y se puede probar completo. `admin_users` ya no apunta a `auth.users`.
- **postgres-js con SQL directo en lugar de Drizzle.** El esquema SQL es la fuente de verdad y la
  capa de datos es un solo archivo.
- **El token del enlace del cliente se deriva con HMAC del id y una versión**
  (`manage_token_version`). Así el panel puede mandarlo por WhatsApp sin guardarlo.

## Pruebas que pasaron (2026-11-24)

**Backend: 33 de 33.** Con base limpia, la imitación de Mercado Pago y Resend y un navegador real:

- **Entrada al panel:**
  - El enlace llega por correo; en la base solo está su hash.
  - Funciona una vez: la segunda vez rechaza.
  - Un correo desconocido recibe la misma respuesta y no se manda nada.
- **Otro negocio:**
  - Su dueño no recibe enlace.
  - Con una cookie válida firmada para él, el panel lo rechaza, igual que los enlaces de WhatsApp.
- **RLS:** un rol `anon` con permiso de `select` en todas las tablas ve 0 filas.
- **Pago:**
  - La preferencia sale con MXN, `binary_mode`, URL del webhook, 3 tipos de pago excluidos y llave de idempotencia.
  - El token del cliente no viaja a Mercado Pago, y en modo prueba se usa `sandbox_init_point`.
  - Rechazado → reintento → aprobado por webhook firmado → taquiza confirmada.
  - Aviso repetido: 200 y nada se duplica. Firma falsa: 401.
- **Reembolsos:**
  - Cancelar dentro del plazo: reembolso con `X-Idempotency-Key` y registro en la base.
  - Fuera del plazo: el diálogo lo advierte y no se reembolsa.
- **Correo:**
  - El dueño recibe "Nueva solicitud".
  - Con Resend caído la app responde normal y el correo queda en `outbox` con su error. El job diario lo reintenta, lo manda y queda en `job_runs`.
- **Sesiones:** "Cerrar sesión en todos lados" saca también a la otra sesión abierta.
- **Fotos:**
  - Se suben y aparecen en la página.
  - Un texto renombrado a `.jpg` se rechaza por su contenido.

**Pantallas, sobre Postgres:** las tres suites anteriores (rebanada vertical, 10 pantallas
restantes, solo teclado y carrera) pasan completas. Sin errores de consola, 0 violaciones de axe
y 0 px de desborde a 390 y 1440 px.

**Carrera, con el candado real de Postgres:** dos clientes mandan el mismo horario a la vez. Uno
agenda y el otro recibe "Ese horario se acaba de ocupar".

**`npm audit`:** 0 vulnerabilidades. **Build de producción con secretos de prueba:** ningún
secreto en el código del navegador.

## Qué tiene que hacer el dueño (cuentas y llaves)

Claude no crea cuentas ni escribe llaves: van en `.env.local` en tu computadora y en las variables
de entorno del hosting. Lista completa en `.env.example`.

1. **Supabase** (base de datos y fotos):
   - Crea un proyecto en una región cercana (por ejemplo, `us-east-1`).
   - Copia la cadena de conexión del *Transaction pooler* (puerto 6543) a `DATABASE_URL`.
   - Crea un bucket **público** llamado `fotos`.
   - Copia `SUPABASE_URL` y la *service role key*.
   - Corre `npm run db:migrate` y luego `SEED_ADMIN_EMAIL=tu@correo npm run db:seed`.
   - Respaldos: el plan gratis de Supabase no tiene respaldos diarios descargables; el plan Pro
     sí. Hasta entonces, corre un `pg_dump` semanal (ver `/replica-deploy`).
2. **Resend** (correos):
   - Crea la cuenta y verifica tu dominio (registros SPF y DKIM).
   - Crea una API key y define `EMAIL_FROM` con ese dominio.
3. **Mercado Pago** (anticipos):
   - En *Tus integraciones*, crea una aplicación de Checkout Pro.
   - Usa primero las credenciales de **prueba** (`TEST-...`) y prueba con las tarjetas y cuentas
     de prueba de Mercado Pago.
   - Configura el webhook en `{APP_URL}/api/webhooks/mercadopago` con el evento *Pagos* y copia la
     clave secreta a `MP_WEBHOOK_SECRET`.
   - Las credenciales de producción van hasta `/replica-deploy`.
   - Nota: el webhook necesita una URL pública con https; en tu computadora no llega. Para
     probarlo antes de publicar, usa la vista previa de Vercel.
4. **`APP_SECRET`:** 32 caracteres o más al azar (`openssl rand -base64 48`). Si cambia, se
   cierran todas las sesiones y dejan de servir los enlaces de los clientes: guárdalo bien.
5. **`CRON_SECRET`:** cualquier valor largo al azar. Vercel lo manda solo al job diario.
6. **Turnstile (opcional):** en el panel de Cloudflare, Turnstile → agrega el sitio y copia las
   dos llaves.

## Integraciones

| integración | API | permisos | revisión del proveedor | límites |
| --- | --- | --- | --- | --- |
| Mercado Pago | REST oficial: `/checkout/preferences`, `/v1/payments/{id}`, `/v1/payments/{id}/refunds` | Access token de la cuenta del negocio | Para cobrar en producción hay que activar la cuenta (identidad y datos bancarios); no hay revisión de la app | Reintentos del webhook cada 15 min si no responde 200/201 en 22 s |
| Resend | REST `POST /emails` | API key con permiso de envío | Verificar el dominio por DNS | Plan gratis: 100 correos al día |
| Supabase Storage | REST `/storage/v1/object` | service role (solo servidor) | — | Plan gratis: 1 GB |
| WhatsApp | Enlaces `wa.me` (sin API) | — | La API de WhatsApp Business (envío automático) requiere cuenta de Meta verificada y plantillas aprobadas: se deja para después | — |
| Google Maps | Enlaces "Maps URLs" (sin API key) | — | — | — |

## Lista de seguridad

- [x] Secretos solo en variables de entorno. `.env*` está en `.gitignore` y solo se sube
  `.env.example`. Se revisó el build: ningún secreto en el código del navegador.
- [x] Entradas validadas en el servidor (zod) en todas las acciones y rutas. Fotos validadas por
  sus bytes.
- [x] Permisos revisados en cada lectura y escritura del panel (`requireAdmin`). Probado con un
  usuario de otro negocio: no ve nada. RLS sin políticas: el rol `anon` ve 0 filas.
- [x] Límites de uso en la entrada (por IP y por correo) y en las solicitudes públicas (por IP y
  por WhatsApp). Los correos al dueño solo salen por acciones que ya tienen límite.
- [x] El webhook verifica la firma (HMAC, comparación en tiempo constante) y es idempotente.
- [x] Fotos: tipo y tamaño limitados, nombre aleatorio, servidas desde el dominio de Supabase.
- [x] Sin datos de clientes en las URLs de terceros (el token no viaja a Mercado Pago) ni en los
  registros (el aviso sin correo registra solo el asunto). El enlace privado del cliente sí lleva
  su token en la URL: es la forma de entrar sin cuenta, y se puede regenerar.
- [x] Dependencias auditadas: `npm audit`, 0 vulnerabilidades.
- [x] El aviso de privacidad (S09) nombra a cada proveedor: Mercado Pago, Supabase, Vercel,
  Resend, Cloudflare Turnstile y WhatsApp. **Debe revisarlo un abogado.**
- [x] Cabeceras de seguridad: `nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY` y
  `Permissions-Policy`.

## Pendiente (dicho claramente)

- **Probar con las llaves reales de prueba del dueño** (Mercado Pago `TEST-`, Resend y Supabase).
  Todo se verificó contra imitaciones fieles, no contra los servicios reales.
- **Respaldos:** depende del plan de Supabase (ver arriba).
- **Reembolso parcial:** hoy el reembolso es completo al cancelar o rechazar. Falta un botón para
  devolver una parte.
- **Recordatorios automáticos por WhatsApp:** siguen siendo botones `wa.me` en la agenda.
- **Pantalla para invitar a un ayudante:** el rol existe; hoy se agrega con SQL.
