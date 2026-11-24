# Arquitectura: taquizas de D' Garden Tacos (reconstrucción del ciclo central de OpenTable)

Lee: `replica/recon.md` y `replica/features.csv`. Esquema: `replica/schema.sql` (es la migración 0001).
Negocio: D' Garden Tacos, Lázaro Cárdenas, Michoacán. Zona horaria `America/Mexico_City`, sin horario de verano.
Fecha: 2026-11-24

## Stack

| capa | elección | por qué |
| --- | --- | --- |
| web | Next.js (App Router) + TypeScript | Una sola base de código para el sitio público, el panel del dueño y los webhooks. Las páginas se arman en el servidor (rápidas en celular) y los formularios usan server actions. |
| estilos | Tailwind CSS, con los tokens que produzca `/replica-design` | Rápido de construir y consistente, con cero CSS suelto. |
| base de datos | Postgres en Supabase (una sola base) | Administrado y gratis para desarrollar. Auth y Storage vienen en el mismo proyecto. |
| ORM | Drizzle (con `postgres-js`) | Cercano a SQL, ligero, con buenas transacciones. `schema.sql` es la migración 0001 y `drizzle-kit pull` genera los tipos. |
| auth | Supabase Auth con enlace mágico, solo para el dueño y sus ayudantes | Sin contraseñas que olvidar. Los clientes **no** crean cuenta: gestionan su taquiza con un enlace privado (token). |
| pagos | Mercado Pago Checkout Pro | Es el más conocido en México: tarjetas, saldo de Mercado Pago y meses sin intereses. Se puede abrir con una cuenta de persona física. Queda detrás de una interfaz `PaymentProvider` para cambiar a Stripe si algún día conviene. |
| WhatsApp | MVP: enlaces `wa.me` con el mensaje ya escrito. Después: WhatsApp Cloud API de Meta | Los enlaces son gratis y no piden aprobación. La API envía sola los mensajes, pero requiere una cuenta de Meta verificada, plantillas aprobadas y paga por conversación. |
| correo | Resend | Avisa al dueño de cada solicitud nueva y le manda un resumen diario. El plan gratis alcanza. |
| antispam | Cloudflare Turnstile | Gratis y sin rompecabezas. Evita solicitudes falsas en el formulario público. |
| jobs | Vercel Cron, un job diario | Nada correcto depende del job: los apartados vencen solos al consultarse (ver "Carreras"). |
| archivos | Supabase Storage, bucket público `fotos` | Fotos del negocio y de los paquetes. |
| fechas | `date-fns` + `@date-fns/tz` | Los horarios se calculan siempre en la zona del negocio, nunca en la del navegador. |
| validación | Zod | Las mismas reglas en el formulario y en el servidor. |
| pruebas | Vitest (capacidad y precios), Playwright (flujos) | Las usa `/replica-test`. |
| hosting | Vercel | Lo más directo para Next.js. **Ojo:** el plan Hobby es para uso no comercial, así que el negocio necesita Pro o un host como Netlify o Render. Se decide en `/replica-deploy` (revisar los términos vigentes). |

Costo aproximado en producción: hosting (unos US$20 al mes en Vercel Pro), Supabase gratis
(el plan gratis pausa proyectos sin actividad; el job diario lo mantiene activo) o Pro (unos
US$25 al mes), un dominio y la comisión de Mercado Pago por cada anticipo. Hay que confirmar
los precios vigentes al desplegar.

## Acceso

**Las revisiones de permisos van en el servidor, no en políticas RLS.**

- RLS está **activado en las 15 tablas y sin políticas**. La llave pública de Supabase (`anon`)
  no puede leer ni escribir nada, aunque alguien la encuentre en el navegador.
- El servidor de Next.js se conecta con `DATABASE_URL` (pooler de Supabase en modo transacción,
  puerto 6543, `prepare: false` en postgres-js) como el rol dueño de las tablas.
- `SUPABASE_SERVICE_ROLE_KEY` solo vive en el servidor, para firmar las subidas a Storage.
- Toda consulta del panel pasa por `requireAdmin(rol?)`: lee la sesión de Supabase, busca la
  fila en `admin_users` y devuelve su `business_id`. **Toda** consulta filtra por ese
  `business_id`. Hay dos roles:
  - `owner`: todo.
  - `helper`: ver la agenda, aceptar o rechazar, registrar pagos en efectivo y preparar
    WhatsApp. No puede cambiar ajustes, paquetes ni precios, ni hacer reembolsos.
- Toda ruta del cliente pasa por `requireBookingToken(codigo, token)`: compara el sha256 del
  token con `bookings.manage_token_hash` usando `timingSafeEqual`. El código (`DGT-4K7Q`) es
  visible; el token (32 bytes al azar) es el secreto.
- El token **nunca sale hacia terceros**: el regreso de Mercado Pago apunta a
  `/t/{codigo}/pago`, que reconoce al cliente por una cookie httpOnly que se pone justo
  antes de mandarlo a pagar.

## Esquema

Tablas: 15. El SQL completo está en [`schema.sql`](schema.sql). Se probó en Postgres 16:
carga limpio y pasan 12 casos de capacidad y la prueba de carrera.

| tabla | qué guarda | pantallas |
| --- | --- | --- |
| `businesses` | datos del negocio y sus reglas (anticipo, confirmación, apartados, política, anticipación, equipos) | S01, S17 |
| `admin_users` | quién entra al panel y con qué rol | S10 |
| `availability_rules` | horario por día de la semana, duración, traslado, máximo de taquizas e invitados por día | S14 |
| `blocked_dates` | días sin servicio | S14 |
| `packages` | paquetes con precio por persona y rango de invitados | S02, S15 |
| `addons` | complementos (aguas, tortillas a mano…) | S04, S15 |
| `service_zones` | zonas o colonias y su cargo por traslado | S04, S16 |
| `customers` | clientes, únicos por WhatsApp; se pueden anonimizar | S04, S18 |
| `bookings` | la taquiza: fecha, horario, dirección, precios congelados, estado, apartados, propuesta | S03 a S08, S11 a S13 |
| `booking_addons` | complementos elegidos con su precio congelado | S04, S12 |
| `payments` | anticipos, saldos y reembolsos (en línea o en efectivo) | S05, S07, S12 |
| `webhook_events` | cada aviso recibido de Mercado Pago, una sola vez | — |
| `booking_events` | historial de la taquiza (quién hizo qué y cuándo) | S07, S12 |
| `messages` | mensajes de WhatsApp y correo preparados o enviados | S12 |
| `reviews` | reseñas, una por taquiza completada, publicadas por el dueño | S01, S19 |

Estados de `bookings.status`:

```
                      ┌─────────────── cancelled_by_customer / cancelled_by_business
                      │
requested ──aceptar──> confirmed ──> completed | no_show
   │  ↑                   ↑
   │  └──pago vencido──┐  │ pago aprobado (webhook)
   │                   │  │
   └──pagar──> awaiting_payment
   │
   ├──proponer otra fecha──> proposed ──cliente acepta──> confirmed (o awaiting_payment)
   │                             └──vence o rechaza──> expired | declined
   ├──rechazar──> declined
   └──fecha pasó sin respuesta──> expired
```

Reglas que viven en la base, no en la pantalla:

- **Capacidad** (`capacity_conflict` y `lock_business_day`): una taquiza ocupa
  `[inicio, fin + traslado)`. Ocupan lugar las confirmadas, las solicitudes y los pagos con
  apartado vigente, y las propuestas vigentes. La función revisa, en orden: fecha local
  correcta, anticipación mínima y máxima, día bloqueado, día abierto, horario de inicio,
  máximo de taquizas por día, máximo de invitados por día y número de equipos al mismo tiempo.
- Total = subtotal + traslado + complementos, y anticipo ≤ total (`check`).
- Una taquiza con pagos no se puede borrar (`on delete restrict`); solo se cancela.
- Un pago del proveedor se registra una sola vez: `unique (provider, provider_ref)`.
- Una taquiza no se duplica por doble clic: `bookings.idempotency_key unique`.
- Máximo un recordatorio automático por taquiza (índice único parcial en `messages`).
- Una reseña por taquiza (`reviews.booking_id unique`).

## API

Convenciones: las páginas son `GET`; los formularios son server actions (`POST`). Quién puede
llamar cada ruta:

- **cualquiera**: público, con Turnstile donde se indica.
- **enlace**: quien tenga el enlace privado con token.
- **admin**: dueño o ayudante.
- **dueño**: solo `owner`.

### F01 y F02: el cliente agenda (con anticipo o sin pago en línea)

| método y ruta | qué hace | quién | entrada | salida | flujo |
| --- | --- | --- | --- | --- | --- |
| `GET /` | S01: negocio, paquetes activos, reseñas publicadas, mini widget | cualquiera | — | HTML | F01, F02 |
| `GET /paquetes` | S02 | cualquiera | — | HTML | F01, F02 |
| `GET /agendar` | S03 a S05 (3 pasos en una página) | cualquiera | `?invitados&fecha&paquete` | HTML | F01, F02 |
| `GET /api/disponibilidad/mes` | Estado de cada día del mes | cualquiera | `mes, invitados, paquete` | `[{fecha, estado: disponible \| pocos \| lleno \| bloqueado \| fuera_de_plazo \| cerrado}]` | F01, F02, F04, F05, F08 |
| `GET /api/disponibilidad/dia` | Horas de inicio de un día y si están libres | cualquiera | `fecha, invitados, paquete` | `[{hora, libre}]` | F01, F02, F04, F05, F08 |
| `POST action crearTaquiza` | Valida, toma el candado del día, revisa la capacidad, crea o reusa al cliente (por WhatsApp), guarda taquiza, complementos e historial, y avisa al dueño por correo. Con "pagar ahora" crea la preferencia de Mercado Pago y deja `awaiting_payment`; si no, deja `requested` (o `confirmed` si la confirmación es automática y el anticipo no es obligatorio). | cualquiera + Turnstile | cliente `{nombre, whatsapp, email?}`, evento `{fecha, hora, invitados, paquete, complementos[], zona, dirección, colonia, referencias, tipo, notas}`, `modo_pago: ahora \| despues`, `idempotency_key` | `{codigo, enlace_gestion, checkout_url?}` o `{error: day_full \| time_taken \| guests_full \| too_soon \| …}` | F01, F02 |
| `GET /t/[codigo]` | S06 (recién creada) y S07 (gestionar) | enlace | `?k=token` | HTML | F01, F02, F04, F05 |
| `GET /t/[codigo]/pago` | Regreso de Mercado Pago: "estamos confirmando tu pago" y espera el webhook | enlace (cookie) | `status` de MP (solo informativo) | HTML | F01 |
| `GET /t/[codigo]/evento.ics` | Archivo para agregar al calendario | enlace | `k` | `text/calendar` | F01, F02 |
| `POST action pagarAnticipo` | Pagar después desde S07: nueva preferencia de Mercado Pago, `awaiting_payment` con apartado de `payment_hold_minutes` | enlace | `codigo, token` | `{checkout_url}` | F02 |

### F03: el dueño revisa y acepta

| método y ruta | qué hace | quién | entrada | salida | flujo |
| --- | --- | --- | --- | --- | --- |
| `GET /admin/entrar` | S10 | cualquiera | — | HTML | F03 |
| `POST action pedirEnlaceAcceso` | Manda el enlace mágico solo si el correo está en `admin_users`. Responde igual en ambos casos. | cualquiera | `email` | `{ok}` | F03 |
| `GET /auth/callback` | Cambia el código de Supabase por una sesión | — | `code` | redirige a `/admin` | F03 |
| `POST action cerrarSesion` | Cierra la sesión | admin | — | redirige | — |
| `GET /admin` | S11: pestañas Pendientes, Próximas y Pasadas; vista día, semana o mes; "Recordatorios de mañana"; "Requiere atención" | admin | `?vista&fecha&estado` | HTML | F03, F09 |
| `GET /admin/t/[id]` | S12 | admin | — | HTML | F03, F04, F10 |
| `POST action aceptarTaquiza` | Candado y capacidad de nuevo. Pasa a `confirmed`, o a `awaiting_payment` si el anticipo es obligatorio y no está pagado. Guarda historial. | admin | `id` | `{estado, whatsapp_url}` | F03 |
| `POST action prepararWhatsApp` | Arma el texto desde la plantilla del estado, guarda `messages` (`link`, `prepared`) y devuelve el enlace `wa.me` | admin | `id, plantilla` | `{whatsapp_url}` | F03, F04, F08, F09, F10 |

### F04: rechazar o proponer otra fecha

| método y ruta | qué hace | quién | entrada | salida | flujo |
| --- | --- | --- | --- | --- | --- |
| `POST action rechazarTaquiza` | Pasa a `declined` con motivo. Si había anticipo, lo reembolsa completo. | admin | `id, motivo` | `{estado, whatsapp_url}` | F04 |
| `POST action proponerOtraFecha` | Candado y capacidad en la fecha nueva. Pasa a `proposed` con `proposal_expires_at`. | admin | `id, fecha, hora` | `{estado, whatsapp_url}` | F04 |
| `POST action responderPropuesta` | Si acepta: candado y capacidad, y pasa a `confirmed` (o `awaiting_payment`). Si rechaza: pasa a `declined`. | enlace | `codigo, token, acepta` | `{estado}` | F04 |

### F05: el cliente cambia o cancela

| método y ruta | qué hace | quién | entrada | salida | flujo |
| --- | --- | --- | --- | --- | --- |
| `GET /t/[codigo]/cambiar` | S08 | enlace | `k` | HTML | F05 |
| `POST action cambiarTaquiza` | Candado de los dos días (en orden, para no trabarse) y capacidad sin contarse a sí misma. Recalcula el precio. Si la confirmación es manual, vuelve a `requested`. | enlace | `codigo, token, fecha, hora, invitados` | `{estado, diferencia_cents}` | F05 |
| `POST action cancelarTaquiza` | Pasa a `cancelled_by_customer`. Si el anticipo se pagó en línea y está dentro de `refund_cutoff_days`, lo reembolsa. | enlace | `codigo, token, motivo` | `{estado, reembolso_cents}` | F05 |

### F06: disponibilidad

| método y ruta | qué hace | quién | entrada | salida | flujo |
| --- | --- | --- | --- | --- | --- |
| `GET /admin/disponibilidad` | S14 | dueño | — | HTML | F06 |
| `POST action guardarHorario` | Guarda las 7 reglas (`availability_rules`) | dueño | `reglas[7]` | `{ok}` | F06 |
| `POST action bloquearFecha` | Bloquea un día. Avisa (no borra) si ya hay taquizas confirmadas ese día. | dueño | `fecha, motivo` | `{ok, taquizas_afectadas[]}` | F06 |
| `POST action desbloquearFecha` | Quita el bloqueo | dueño | `fecha` | `{ok}` | F06 |

### F07: paquetes, zonas y ajustes

| método y ruta | qué hace | quién | entrada | salida | flujo |
| --- | --- | --- | --- | --- | --- |
| `GET /admin/paquetes` | S15 | dueño | — | HTML | F07 |
| `POST action guardarPaquete` | Crea o edita. Un precio nuevo no cambia taquizas ya agendadas (el precio está congelado en cada una). | dueño | `paquete` | `{id}` | F07 |
| `POST action archivarPaquete` | `is_active = false`. Un paquete con taquizas nunca se borra. | dueño | `id` | `{ok}` | F07 |
| `POST action ordenarPaquetes` | Cambia el orden en que se muestran | dueño | `ids[]` | `{ok}` | F07 |
| `POST action urlSubidaFoto` | URL firmada de Storage (JPG, PNG o WebP, hasta 5 MB) | dueño | `tipo, tamaño` | `{url, path}` | F07 |
| `POST action guardarComplemento` | Crea o edita un complemento | dueño | `complemento` | `{id}` | F07 |
| `GET /admin/zonas` | S16 | dueño | — | HTML | F07 |
| `POST action guardarZona` | Crea o edita una zona con su cargo | dueño | `zona` | `{id}` | F07 |
| `GET /admin/ajustes` | S17 | dueño | — | HTML | F07 |
| `POST action guardarAjustes` | Anticipo, confirmación, apartados, política, anticipación, equipos, WhatsApp y plantillas | dueño | `ajustes` | `{ok}` | F07 |

### F08: taquiza registrada a mano

| método y ruta | qué hace | quién | entrada | salida | flujo |
| --- | --- | --- | --- | --- | --- |
| `GET /admin/t/nueva` | S13 | admin | — | HTML | F08 |
| `POST action crearTaquizaManual` | Igual que `crearTaquiza`, con `source = manual`, sin Turnstile. Permite forzar un día lleno (`capacity_override`, queda en el historial). | admin | lo mismo que `crearTaquiza` + `forzar` | `{id, whatsapp_url}` | F08 |

### F09: recordatorios

| método y ruta | qué hace | quién | entrada | salida | flujo |
| --- | --- | --- | --- | --- | --- |
| `GET /api/cron/diario` | Job diario (ver Jobs) | Vercel Cron (`CRON_SECRET`) | — | `{ok, resumen}` | F09 |

### F10: después del evento y el resto del panel

| método y ruta | qué hace | quién | entrada | salida | flujo |
| --- | --- | --- | --- | --- | --- |
| `POST action registrarPago` | Pago en efectivo o transferencia (anticipo o saldo) | admin | `id, tipo, metodo, monto` | `{ok}` | F10 |
| `POST action reembolsarPago` | Reembolso con la API de Mercado Pago. Guarda un `payments` de tipo `refund`. | dueño | `pago_id, monto?` | `{ok}` | F05, F10 |
| `POST action completarTaquiza` | Pasa a `completed` y prepara el WhatsApp con el enlace de reseña | admin | `id` | `{whatsapp_url}` | F10 |
| `POST action marcarNoRealizada` | Pasa a `no_show` | admin | `id, motivo` | `{ok}` | F10 |
| `POST action cancelarPorNegocio` | Pasa a `cancelled_by_business` y reembolsa completo el anticipo en línea | dueño | `id, motivo` | `{whatsapp_url}` | F10 |
| `POST action guardarNotas` | Notas internas | admin | `id, notas` | `{ok}` | F10 |
| `POST action regenerarEnlace` | Token nuevo (si el enlace se compartió de más) | admin | `id` | `{whatsapp_url}` | F05 |
| `GET /t/[codigo]/resena` | S19 (solo si la taquiza está `completed` y aún no tiene reseña) | enlace | `k` | HTML | F10 |
| `POST action enviarResena` | Guarda la reseña sin publicar | enlace | `codigo, token, estrellas, comentario` | `{ok}` | F10 |
| `POST action publicarResena` | Publica u oculta una reseña | dueño | `id, publicar` | `{ok}` | F10 |
| `GET /admin/clientes` | S18 | admin | `?q` | HTML | — |
| `POST action guardarCliente` | Notas del cliente, o anonimizarlo si pide borrar sus datos | dueño | `id, notas \| anonimizar` | `{ok}` | — |
| `GET /admin/exportar.csv` | Taquizas en CSV | dueño | `desde, hasta` | `text/csv` | — |
| `GET /politicas` | S09 | cualquiera | — | HTML | — |

Total: 56 rutas:

- 17 páginas.
- 32 server actions.
- 6 endpoints GET: disponibilidad del mes y del día, `.ics`, `callback`, cron y CSV.
- 1 webhook.

### Webhooks

**Entrada: `POST /api/webhooks/mercadopago`** (avisos de tipo `payment`)

1. Valida la firma `x-signature` (HMAC-SHA256 con el secreto del panel de Mercado Pago, según
   su documentación). Si no es válida, responde 401.
2. Inserta en `webhook_events (provider, event_id)`. Si ya existía, responde 200 y termina:
   los avisos llegan repetidos.
3. **No confía en el cuerpo del aviso:** consulta el pago con `GET /v1/payments/{id}` de la
   API oficial, usando la llave del negocio.
4. Busca la taquiza por `external_reference` (el `id` de la taquiza) y guarda o actualiza el
   pago por `(provider, provider_ref)`.
5. Si el pago está `approved` y la taquiza en `awaiting_payment` (o `requested`): toma el
   candado del día y revisa la capacidad sin contarse a sí misma.
   - Si cabe: pasa a `confirmed`.
   - Si ya no cabe (el apartado venció y alguien tomó el lugar): deja `requested`, marca
     `needs_attention = true` y avisa al dueño por correo. El dueño decide si reagenda o
     reembolsa.
6. Si llega `refunded` o `cancelled`, actualiza el pago. Responde 200 en menos de 5 segundos;
   lo pesado va después de guardar el evento.

Después (con la API de WhatsApp): `POST /api/webhooks/whatsapp` recibe el estado de entrega
(`sent`, `delivered`, `failed`) y actualiza `messages.status`.

**Salida:** ninguno. Llamadas a APIs oficiales con las llaves del negocio:

- Mercado Pago: crear preferencias, consultar pagos, reembolsar.
- Resend: correos.
- Supabase: Auth y Storage.
- Más adelante, WhatsApp Cloud API (Graph API de Meta).

### Preferencia de Mercado Pago

- Concepto: "Anticipo taquiza DGT-XXXX". Monto en MXN. `external_reference` = id de la taquiza.
- Vence en `hold_expires_at`.
- En el MVP se excluyen los pagos en efectivo (OXXO) y por transferencia. Tardan horas o días
  en acreditarse, más que el apartado de 30 minutos. Se pueden activar después con un
  apartado más largo.
- Anticipo = porcentaje del total redondeado hacia arriba al peso, o un monto fijo (topado al total).

### Jobs

| job | horario | qué hace |
| --- | --- | --- |
| `diario` | 14:00 UTC (08:00 en Lázaro Cárdenas) | 1. Ordena estados: `awaiting_payment` con apartado vencido pasa a `requested` (si el anticipo es opcional) o a `expired` (si es obligatorio); las `requested` con fecha pasada pasan a `expired`; las `proposed` con propuesta vencida pasan a `expired` y se avisa al dueño. 2. Manda al dueño un correo con las taquizas de mañana (con enlace a "Recordatorios de mañana") y las solicitudes sin responder. 3. Su actividad mantiene despierto un proyecto gratis de Supabase. |
| `recordatorios` (después) | cada hora | Con la API de WhatsApp, manda el recordatorio 24 h antes. El índice único evita duplicados. Necesita cron cada hora: Vercel Pro, o `pg_cron` de Supabase. |

## Lo que muerde

- **Zona horaria:** Michoacán usa `America/Mexico_City` y no tiene horario de verano desde
  2022. Todo se guarda en UTC (`timestamptz`) y se calcula en la zona del negocio. La pantalla
  dice "hora del centro" para clientes de otros estados. `event_date` lo pone el servidor y la
  función de capacidad comprueba que coincida con `start_at` (`date_mismatch`).
- **Idempotencia:**
  - Los avisos de Mercado Pago llegan repetidos y desordenados: `webhook_events` único,
    pagos únicos por `provider_ref`, y las transiciones solo avanzan desde el estado esperado.
  - El doble clic en "Agendar" se resuelve con `idempotency_key`.
  - El regreso desde Mercado Pago no prueba nada: solo el webhook o la consulta a la API.
- **Carreras:** el último lugar del día se lo pueden ganar dos clientes. Se resuelve con
  `pg_advisory_xact_lock` por negocio y día, más `capacity_conflict` dentro de la misma
  transacción (probado: de dos intentos simultáneos, uno entra y el otro recibe
  `time_taken`). El candado es de transacción, así que funciona con el pooler de Supabase en
  modo transacción. La capacidad se vuelve a revisar al aceptar, al aceptar una propuesta, al
  cambiar y al aprobarse un pago. Los apartados vencen por hora (`hold_expires_at > now()`),
  así que no hace falta un job para liberar lugares.
- **Pago tardío:** si Mercado Pago aprueba un pago después de que venció el apartado y el
  lugar ya se tomó, la taquiza queda con `needs_attention`. Nunca se pierde el dinero en
  silencio.
- **Spam y límites:**
  - Turnstile en `crearTaquiza`.
  - Máximo 3 solicitudes por WhatsApp cada hora.
  - Respuestas genéricas en `pedirEnlaceAcceso`.
  - Mercado Pago y Resend tienen límites amplios para este volumen.
- **Archivos:** fotos de hasta 5 MB (JPG, PNG o WebP), subidas directo a Storage con URL
  firmada. `next/image` las reduce para celular.
- **Búsqueda:** no hace falta. La lista de clientes usa `ilike` sobre nombre y WhatsApp.
- **Tiempo real:** no hace falta. El panel se refresca al volver a la pestaña.
- **Sin conexión:** no se soporta. Las páginas son ligeras para la señal débil en un evento.
- **Correo:** Resend con el dominio propio verificado (SPF y DKIM) para no caer en spam. Solo
  se usa para avisar al dueño; al cliente se le escribe por WhatsApp.
- **WhatsApp:**
  - `wa.me` usa el número sin `+` y el texto URL-codificado; los mensajes deben ser cortos.
  - Con la API, los mensajes que inicia el negocio fuera de la ventana de 24 h requieren
    plantillas aprobadas por Meta y tienen costo.
  - Los números se guardan en E.164 (`+52…`).
- **Multi-negocio:** hoy hay un solo negocio, pero todo lleva `business_id`. Cuesta poco y
  permite ofrecer el sistema a otros taqueros después.
- **Datos personales (México):**
  - La ley de protección de datos (LFPDPPP) pide un aviso de privacidad en el sitio.
  - Si un cliente pide borrar sus datos, se anonimiza (`customers.anonymized_at`, se quitan
    nombre, WhatsApp, correo y dirección) y se conservan los montos de los pagos.
- **Facturas (CFDI):** fuera de alcance. Si un cliente pide factura, se emite aparte.
- **Precios congelados:** cada taquiza guarda su precio por persona y los precios de sus
  complementos. Cambiar un paquete no cambia lo ya agendado.
- **Enlace privado:** quien tenga el enlace gestiona la taquiza. Por eso el token se guarda
  como hash, no viaja a terceros y el dueño puede regenerarlo.

## Datos del negocio que faltan

Ninguno bloquea la construcción: todos son ajustes del panel. La rebanada vertical usa
valores de ejemplo marcados "por definir".

| dato | dónde se captura | valor de ejemplo |
| --- | --- | --- |
| Paquetes, qué incluyen y precios | S15 `packages` | 2 paquetes de prueba |
| Taquizas e invitados por día, duración | S14 `availability_rules` | 2 por día, 4 h, 60 min de traslado |
| Días y horarios de trabajo | S14 | todos los días, inicio de 12:00 a 20:00 |
| Zonas de cobertura y cargo por traslado | S16 `service_zones` | "Lázaro Cárdenas" sin cargo |
| Anticipo y días para reembolso | S17 `businesses` | 30 % opcional, reembolso hasta 7 días antes |
| WhatsApp del negocio | S17 | vacío (el botón no aparece hasta capturarlo) |

## Orden de construcción

**1. Rebanada vertical (F02 + F03, sin pagos).** El cliente agenda desde el celular, el dueño
ve la solicitud, la acepta y abre WhatsApp con el mensaje listo.

- Pantallas: S01 (básica), S03, S04, S05 (solo "pagar después"), S06, S10, S11 (lista
  simple), S12 (aceptar + WhatsApp).
- Tablas: `businesses`, `admin_users`, `availability_rules`, `packages`, `customers`,
  `bookings`, `booking_events`, `messages`. Se carga todo `schema.sql` y se siembran los
  datos de ejemplo.
- Rutas: `/`, `/agendar`, disponibilidad (mes y día), `crearTaquiza`, `/t/[codigo]`,
  `/admin/entrar`, `pedirEnlaceAcceso`, `/auth/callback`, `/admin`, `/admin/t/[id]`,
  `aceptarTaquiza`, `prepararWhatsApp`.
- Listo cuando: el flujo funciona de punta a punta en un celular real y la prueba de carrera
  pasa en la base real.

**2. Must-haves, por área:**

- a. **Disponibilidad (F06):** S14; `blocked_dates`; `guardarHorario`, `bloquearFecha`,
  `desbloquearFecha`; estados del calendario en S03.
- b. **Paquetes (F07):** S02 y S15; Storage; `guardarPaquete`, `archivarPaquete`,
  `ordenarPaquetes`, `urlSubidaFoto`.
- c. **Pagos (F01):** S05 completo y regreso de pago; `payments`, `webhook_events`;
  `pagarAnticipo`, webhook de Mercado Pago, `registrarPago`; S17 (configuración del anticipo).
- d. **Mi taquiza (F05):** S07; `cancelarTaquiza`, `regenerarEnlace`; política de
  cancelación visible.
- e. **Avisos:** correo al dueño con cada solicitud (Resend); plantillas `wa.me` para cada
  estado; dirección con enlace a mapa.
- f. **Panel (F03, F08):** S13 `crearTaquizaManual`; `rechazarTaquiza`; filtros y pestañas
  de S11; S17 completo.
- g. **General:** Turnstile, es-MX, MXN, responsivo; aviso de privacidad.

**3. Should-haves:**

- S16 zonas, cargo por traslado y validación de zona.
- S08 `cambiarTaquiza`.
- F04 `proponerOtraFecha` y `responderPropuesta`.
- `reembolsarPago`.
- `.ics`.
- Job `diario` y "Recordatorios de mañana" (F09).
- Confirmación automática o manual.
- Traslado entre eventos.
- Notas internas.
- `completarTaquiza` y `marcarNoRealizada`.
- Plantillas editables.
- S09 políticas.

**4. Could-haves:**

- S19 reseñas y `publicarResena`.
- S18 clientes y anonimizar.
- Complementos.
- CSV.
- Usuario ayudante.
- Reporte mensual.
- API de WhatsApp (job `recordatorios`).
- OXXO y SPEI.

**5. Arreglos de `/replica-entrepreneur`:** pendiente. Se agregan aquí cuando corra.
