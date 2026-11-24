# Bugs: taquizas de D' Garden Tacos

Encontrados con la suite de `e2e/` (Playwright 1.63, Chromium) contra el servidor de desarrollo,
con la capa de datos en memoria y la imitación de Mercado Pago y Resend.
Build: `511d405`. Fecha: 2026-11-24.

Resumen: **7 bugs reproducidos**: 0 S1, 1 S2, 5 S3, 1 S4. **Los 7 están corregidos.**
Después, en `/replica-build` (reembolso parcial), apareció BUG-008 (S3), también corregido.
Cada uno tiene una prueba que falló antes de la corrección y pasa después. Suite final: 53/53 con
datos en memoria y 55/55 con Postgres.

---

### BUG-001: el ayudante no puede cerrar sesión en todos sus dispositivos

- Severity: S2
- Flow / case: F11 / F11-E1
- Screen: S11 a S18 (panel)
- Build: 511d405  Browser / device: Chromium 1243, 1280 px

Steps
1. Entrar al panel como ayudante en dos navegadores.
2. En uno, buscar "Cerrar sesión en todos lados".

Expected: cualquier persona del panel puede cerrar todas sus sesiones, por ejemplo si perdió el celular.
Actual: el botón solo está en Ajustes y Ajustes es solo para el dueño. El ayudante no tiene forma de cerrar sus sesiones, y el dueño tampoco puede cerrárselas.
Evidence: `replica/bugs/BUG-001.png`; prueba `F11-E1`.
Suspected cause: el botón quedó en la página de Ajustes (exclusiva del dueño).
Status: fixed in 3bbdf42 (la prueba falló antes y pasa después)

### BUG-002: el botón Atrás del navegador a mitad del formulario recarga la página y borra todo

- Severity: S3
- Flow / case: F02 / F02-E5
- Screen: S03 a S05
- Build: 511d405  Browser / device: Chromium 1243, 1280 px

Steps
1. En `/agendar`, elegir día y hora, llenar los datos y llegar al paso 3.
2. Tocar Atrás en el navegador.

Expected: regresar al paso 2 con los datos llenos.
Actual: la página se recarga, vuelve al paso 1 y los datos se pierden.
Evidence: `replica/bugs/BUG-002.png`; prueba `F02-E5`.
Suspected cause: los pasos usan `history.pushState` con un estado propio; el router de Next.js no lo reconoce y hace una navegación completa.
Status: fixed in 8ec7179 (la prueba falló antes y pasa después)

### BUG-003: recargar la página a mitad del formulario borra todo

- Severity: S3
- Flow / case: F02 / F02-E6
- Screen: S03 a S05
- Build: 511d405  Browser / device: Chromium 1243, 1280 px

Steps
1. En `/agendar`, elegir día y hora y llenar el nombre en el paso 2.
2. Recargar la página.

Expected: seguir en el paso 2 con lo capturado.
Actual: vuelve al paso 1 vacío. En celular pasa fácil: un jalón hacia abajo recarga la página.
Evidence: `replica/bugs/BUG-003.png`; prueba `F02-E6`.
Suspected cause: el paso y los datos solo viven en el estado de React.
Status: fixed in 8ec7179 (la prueba falló antes y pasa después)

### BUG-004: sin conexión al enviar, el botón se queda cargando para siempre

- Severity: S3
- Flow / case: F01 / F01-E3
- Screen: S05 (y cualquier botón que llame al servidor)
- Build: 511d405  Browser / device: Chromium 1243, 1280 px

Steps
1. Llegar al paso 3 con todo lleno.
2. Quitar la conexión (modo avión) y tocar "Enviar solicitud".

Expected: un mensaje de que no hay conexión y el botón listo para reintentar.
Actual: el botón queda deshabilitado con el indicador de carga y no aparece ningún mensaje. La consola registra `unhandledRejection: TypeError: Failed to fetch`.
Evidence: `replica/bugs/BUG-004.png`; prueba `F01-E3`.
Suspected cause: las llamadas a las acciones del servidor no atrapan errores de red; solo manejan las respuestas `{ ok: false }`.
Status: fixed in 3e32e1b (la prueba falló antes y pasa después)

### BUG-005: el calendario marca "hoy" con el reloj del servidor (error de hidratación)

- Severity: S3
- Flow / case: F01 / F01-E5
- Screen: S03, S08
- Build: 511d405  Browser / device: Chromium 1243, zona horaria Asia/Tokyo

Steps
1. Abrir `/agendar` cuando la fecha del servidor (UTC) y la del navegador no coinciden. Pasa en México cada noche después de las 6:00 p. m., hora del centro, si el servidor está en UTC, como en Vercel.

Expected: "hoy" se calcula con la zona del negocio, igual en el servidor y en el navegador.
Actual: React reporta un error de hidratación (`rdp-today` en otra celda) y el anillo de "hoy" puede quedar en el día equivocado.
Evidence: `replica/bugs/BUG-005.png`; prueba `F01-E5` (error de consola: "A tree hydrated but some attributes… didn't match").
Suspected cause: react-day-picker usa `new Date()` del lugar donde se dibuja.
Status: fixed in ff0f42b (la prueba falló antes y pasa después)

### BUG-006: una reseña marcada "No publicar" vuelve a aparecer en la cola

- Severity: S3
- Flow / case: F10 / F10-E1
- Screen: S11
- Build: 511d405  Browser / device: Chromium 1243, 1280 px

Steps
1. Completar una taquiza y dejar una reseña.
2. En la agenda, en "Reseñas nuevas", tocar "No publicar".
3. Recargar la agenda.

Expected: la reseña ya no aparece en la cola.
Actual: aparece otra vez; la cola nunca se vacía.
Evidence: `replica/bugs/BUG-006.png`; prueba `F10-E1`.
Suspected cause: la cola muestra todas las reseñas no publicadas; no se guarda que ya se revisó.
Status: fixed in af5c577 (la prueba falló antes y pasa después)

### BUG-007: páginas de solo mensaje sin título principal (h1)

- Severity: S4
- Flow / case: F01 / F01-N1
- Screen: regreso del pago, enlace inválido (S07 y S08), S19 en sus estados de mensaje
- Build: 511d405  Browser / device: Chromium 1243, 1280 px

Steps
1. Rechazar un pago y volver a la página de regreso.

Expected: la página tiene un `h1` que un lector de pantalla anuncia como título.
Actual: el título es un `h3` (el de EmptyState); axe reporta `page-has-heading-one`.
Evidence: `replica/bugs/BUG-007.png`; prueba `F01-N1`.
Suspected cause: EmptyState siempre usa `h3`.
Status: fixed in da63f7c (la prueba falló antes y pasa después)

### BUG-008: después de un reembolso completo, "Pagado" sale en negativo

- Severity: S3
- Flow / case: F05 / S12-N0
- Screen: S12
- Build: 24a0f54  Browser / device: Chromium 1243, 1280 px

Steps
1. Agendar con anticipo en línea y pagarlo.
2. El cliente cancela dentro del plazo (se le devuelve el anticipo).
3. El dueño abre el detalle de la taquiza.

Expected: "Pagado: $0".
Actual: "Pagado: -$1,800 · Por cobrar: $7,800". El dinero real está bien; el error es solo de la suma en pantalla.
Evidence: `replica/bugs/BUG-008.png`; prueba `S12-N0`.
Suspected cause: el reembolso se restaba dos veces: el anticipo reembolsado ya no contaba como pagado y además se restaba el reembolso.
Status: fixed in 974332c (la prueba falló antes y pasa después). La suma vive ahora en `src/server/domain/money.ts`.

---

## Por revisar (no reproducido como bug)

- **Escribir antes de que cargue la página:** en la prueba F06-N1, un valor escrito en un campo
  antes de que React hidratara la página se perdió. En un celular lento con mala señal podría
  pasarle a una persona real. Revisarlo en un teléfono de gama baja con red 3G.
- **`x-forwarded-for` para los límites por IP:** la app toma la primera IP de ese encabezado.
  Vercel lo reescribe con la IP real, pero detrás de otro proxy se podría falsificar para saltarse
  el límite por IP. Los límites por WhatsApp y por correo no dependen de eso. Revisar si se
  publica fuera de Vercel.
- **Dos pestañas con la misma persona:** se crean dos solicitudes, porque cada pestaña tiene su
  propia llave anti duplicado. El límite de 3 por WhatsApp por hora lo acota. Decidir si se quiere
  avisar.
- **Propuesta vencida (F04-E1):** depende del reloj (48 h). No se automatizó; se probó la regla
  en el servicio y el job.
