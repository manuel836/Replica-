# Build log: taquizas de D' Garden Tacos

Paridad con OpenTable (`parity.py`): **89.7 / 100**, con 25 de 29 must-haves.
Las 19 pantallas están construidas.

**Actualización tras `/replica-backend`:** paridad **93.8 / 100**, con 28 de 29 must-haves.
Ahora hay Postgres real, Mercado Pago, correo por Resend, entrada por enlace de un solo uso y
fotos. Las mismas pantallas pasan todas las pruebas sobre Postgres. Detalle en
`replica/backend.md`. Sin `DATABASE_URL`, en desarrollo sigue la capa en memoria; sin
`MP_ACCESS_TOKEN`, el pago simulado.

Cómo se probó cada pantalla: Playwright de punta a punta en un navegador real y axe-core
(WCAG 2.0, 2.1 y 2.2 A/AA, más buenas prácticas) a 390 px y a 1440 px. También se revisaron la
consola y el desborde horizontal. Resultado final: 0 errores de consola, 0 violaciones de axe y
0 px de desborde. El flujo de agendar se completó solo con teclado. Capturas en
`replica/clone-screens/`.

| ID | fecha | estado | qué falta | qué fue más difícil de lo esperado |
| --- | --- | --- | --- | --- |
| S01 | 2026-11-24 | done | Fotos y logo reales del dueño (se ven marcadores) | — |
| S02 | 2026-11-24 | done | — | axe marcó el orden de títulos: las tarjetas pasaron a aceptar `h2` |
| S03 | 2026-11-24 | done | — | (1) Un mes sin días libres no deja nada enfocable con teclado: se agregó aviso con botón "Ver el mes siguiente". (2) Durante 250 ms el mes nuevo se evaluaba con los días del anterior y mostraba el aviso por error. (3) El calendario usaba opacidad al cargar y bajaba el contraste |
| S04 | 2026-11-24 | done | El mapa no se muestra al cliente (solo en S12); la zona se elige de una lista, no se valida la dirección | — |
| S05 | 2026-11-24 | partial | Pago **simulado**; Mercado Pago real en `/replica-backend` | El regreso del pago no reconocía al cliente: la acción simulada redirigía dentro del mismo request y no viajaba la cookie. Se cambió a redirección 303 completa, como lo hará Mercado Pago |
| S06 | 2026-11-24 | done | — | — |
| S07 | 2026-11-24 | done | Los reembolsos son simulados | El panel necesitaba mandar el enlace privado sin guardar el token: ahora el token se deriva con HMAC del id y una versión (`manage_token_version` en el esquema) |
| S08 | 2026-11-24 | done | — | El calendario contaba la propia taquiza como ocupada; ahora se excluye (también en el conteo del mes) |
| S09 | 2026-11-24 | done | El aviso de privacidad es provisional: lo debe revisar un abogado | — |
| S10 | 2026-11-24 | partial | En desarrollo el enlace mágico se muestra en pantalla; el envío por correo llega con Supabase Auth | — |
| S11 | 2026-11-24 | done | — (semana y mes agregados después de `/replica-diff`; la reseña "No publicar" se corrigió en BUG-006) | Las taquizas canceladas con fecha futura no salían en ninguna pestaña: se agregó "Canceladas". En la cuadrícula del mes, en celular, cada día es un solo enlace a su semana (los nombres no caben a 390 px) |
| S12 | 2026-11-24 | done | Falta botón de reembolso parcial (hoy se reembolsa completo al rechazar o cancelar) | "Aceptar de todos modos" dependía del texto del error; ahora depende del código del conflicto, y cubre días que el dueño cerró después |
| S13 | 2026-11-24 | done | — | — |
| S14 | 2026-11-24 | done | La duración, el traslado y la capacidad se guardan iguales para los 7 días (el esquema permite distinguirlos por día) | — |
| S15 | 2026-11-24 | done | Subir foto del paquete (necesita almacenamiento, `/replica-backend`) | — |
| S16 | 2026-11-24 | done | — | — |
| S17 | 2026-11-24 | done | — | — |
| S18 | 2026-11-24 | done | Pantalla para invitar a un ayudante (los roles ya se revisan en el servidor) | — |
| S19 | 2026-11-24 | done | — | — |

## Faltantes grandes, dichos claramente

1. **Pagos reales.** El flujo completo existe (apartado de 30 min, regreso, confirmación,
   reembolsos al cancelar), pero con un proveedor simulado. Falta Mercado Pago Checkout Pro, su
   webhook firmado y las llaves del negocio. Es parte de `/replica-backend`.
2. **Base de datos.** Todo vive en memoria y se pierde al reiniciar el servidor. El esquema de
   Postgres ya está probado (`db/migrations/0001_schema.sql`); falta la implementación de `DataStore` con
   Drizzle.
3. **Correos.** El aviso de solicitud nueva y el resumen diario hoy se escriben en la consola.
4. **Vista de calendario del panel.** El dueño ve una lista por día, no una cuadrícula de semana
   o mes.

## Decisiones durante la construcción

- La función de capacidad se escribió dos veces a propósito: en SQL (`capacity_conflict`,
  autoridad al escribir en Postgres) y en TypeScript (`src/server/domain/availability.ts`, para
  pintar el calendario y para la capa en memoria). Las dos revisan lo mismo en el mismo orden.
  `/replica-test` debe probar que coinciden.
- Los mensajes de WhatsApp del panel salen por `/admin/t/{id}/whatsapp`: un enlace normal que
  registra el mensaje y redirige a `wa.me`. No se usa `window.open`, que los celulares bloquean.
- Límite contra spam: 3 solicitudes por WhatsApp por hora (las pruebas repetidas lo activaron).

## Después de `/replica-diff` (2026-11-24)

| qué | estado | notas |
| --- | --- | --- |
| S11 agenda por semana y por mes | done | Era la única función obligatoria pendiente. Pruebas `e2e/s11-calendario.spec.ts` |
| Correos al cliente | done | Solo si deja su correo. Salen al recibir la solicitud, al confirmarla, si falta el anticipo, al rechazarla, al proponer otra fecha, al cambiarla, al cancelarla, el día anterior (job diario, una sola vez) y para pedir reseña. Migración `0004_customer_emails.sql`. Pruebas `e2e/correos-cliente.spec.ts` y F05-H1 |
| S12 reembolso parcial | done | Solo el dueño. Un diálogo con el monto (hasta lo que quede del anticipo) y el motivo. Llave de idempotencia por intento. Al cancelar o rechazar después, se devuelve solo lo que falte. Al hacerlo salió BUG-008 (el "Pagado" restaba dos veces el reembolso). Pruebas `e2e/s12-reembolso.spec.ts` |
| S20 Equipo | done | Pantalla nueva `/admin/equipo` (solo el dueño), enlazada desde el menú, Ajustes y Mi cuenta. Dar acceso manda un correo de invitación; quitarlo borra a la persona y su sesión deja de servir. Hasta 10 ayudantes. Pruebas `e2e/equipo.spec.ts` |
