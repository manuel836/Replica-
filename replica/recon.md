# Mapa de recon: OpenTable (web responsiva) → sistema de taquizas de D' Garden Tacos

Alcance: el ciclo central de OpenTable en sus dos lados, adaptado a taquizas a domicilio.
El cliente agenda una taquiza para su evento. El negocio define su disponibilidad y sus
paquetes, y acepta y administra las solicitudes.
Para: D' Garden Tacos (Ciudad Lázaro Cárdenas). Es el sistema propio del negocio, no un marketplace.
Pagos: el cliente puede dar un anticipo en línea **o** agendar sin pagar en línea.
Avisos: WhatsApp.
Fecha: 2026-11-24

> Lo que se toma de OpenTable son **patrones de funcionamiento**: cómo se elige fecha y
> hora, cómo se maneja la capacidad, los estados de una reservación, las solicitudes de
> eventos privados, los anticipos y el panel del restaurante. No se toman sus textos, su
> logo, sus colores ni su código.

## Fuentes

| # | fuente | URL | notas |
| --- | --- | --- | --- |
| 1 | sitio de OpenTable México | https://www.opentable.com.mx/ | **No legible desde este entorno.** Devolvió 503 al leerlo y 502 en el navegador del contenedor. No se intentó saltar el bloqueo. |
| 2 | centro de ayuda para comensales | https://help.opentable.com/ | **No legible.** El sitio se arma con JavaScript y el lector solo recibió la página vacía ("Loading"). |
| 3 | sitio para restaurantes y planes | https://www.opentable.com/restaurant-solutions/ | **No legible** (503). Lo mismo con `/plans/` y `/pricing/`. Precios y planes: desconocidos. |
| 4 | ayuda para restaurantes | https://support.opentable.com/ | **No legible.** Solo cargó la página vacía. |
| 5 | panel del restaurante | https://guestcenter.opentable.com/ | Solo muestra el inicio de sesión. No se usó ninguna cuenta. |
| 6 | App Store México | https://apps.apple.com/mx/app/opentable/id296581815 | **Leída.** Busca por fecha, hora y lugar con disponibilidad real; avisos "Notify me" cuando se libera un lugar; eventos privados para grupos sin llamar; ver, cambiar o cancelar reservaciones; mensajes al restaurante sobre dietas y peticiones; recordatorios antes de la reservación; puntos y recompensas; asistente con IA "Concierge"; widget de disponibilidad en iOS. Calificación 5.0 (177 mil). |
| 7 | Google Play | https://play.google.com/store/apps/details?id=com.opentable&hl=es_MX | Contenido truncado; no aportó datos. |
| 8 | Facebook de D' Garden Tacos | https://www.facebook.com/share/1DYvHoQZNW/ | Solo se leyó el título: "D' Garden Tacos \| Ciudad Lázaro Cárdenas". Lo demás requiere iniciar sesión. |
| 9 | conocimiento general del producto público de OpenTable | (sin URL) | Flujos de reservación, estados, solicitudes de eventos privados, depósitos y turnos. Lo que viene de aquí está marcado con confianza **media** y debe verificarse a mano si importa. |

**Capturas:** no se pudieron tomar (fuente 1 bloqueada). Si quieres usarlas para
`/replica-design`, guarda capturas de OpenTable tomadas en tu celular en
`replica/screens/` con el nombre de la pantalla (ej. `S03-calendario.png`). Sirven solo
de referencia y nunca se publican.

### Preguntas abiertas para D' Garden Tacos (las necesita /replica-architect)

1. Paquetes reales: nombres, qué incluye cada uno (tacos, guisos, tortillas, salsas,
   aguas, taquero), precio por persona y mínimo de invitados.
2. ¿Cuántas taquizas pueden atender en un mismo día? ¿Hay un máximo de invitados por día?
3. Días y horarios en que trabajan, y cuántas horas dura una taquiza normal.
4. Zona de cobertura y cargo por traslado (ej. dentro de la ciudad gratis, fuera con costo).
5. Anticipo: ¿porcentaje (ej. 30 %) o monto fijo? ¿Hasta cuántos días antes se reembolsa?
6. Número de WhatsApp del negocio.
7. Confirmar la ciudad: se asume Lázaro Cárdenas, Michoacán (zona horaria
   `America/Mexico_City`, sin horario de verano).

## Ciclo central

El cliente elige fecha, hora y número de invitados, elige un paquete y da la dirección.
Si paga el anticipo, su fecha queda apartada; si no, queda pendiente. D' Garden Tacos
confirma por WhatsApp y llega a servir.

## Mapeo de OpenTable a taquiza

| OpenTable | sistema de taquizas | confianza |
| --- | --- | --- |
| Perfil del restaurante con su widget de reservar | página pública del negocio (S01) | alta |
| Personas, fecha y hora → botones de horario | invitados, fecha en el calendario y hora de inicio (S03) | alta |
| Formulario de datos: nombre, teléfono, ocasión, peticiones | datos del cliente, dirección, tipo de evento y notas (S04) | alta |
| Depósito o prepago para grupos y Experiences | anticipo opcional en línea (S05) | media |
| Solicitud de evento privado que el restaurante responde | solicitud pendiente que el dueño acepta, rechaza o reagenda (S12) | media |
| Ver, modificar o cancelar la reservación | "Mi taquiza" por enlace privado (S07, S08) | alta |
| Confirmación y recordatorio por SMS y correo | WhatsApp: enlaces wa.me en el MVP, la API más adelante | alta |
| Libro de reservaciones del restaurante | agenda del dueño (S11) | media |
| Turnos y pacing (máximo de comensales por intervalo) | horario semanal y capacidad por día (S14) | media |
| Perfiles de comensales | lista de clientes (S18) | media |
| Reseñas solo de quien asistió | reseña después de una taquiza completada (S19) | media |
| Plano de mesas | **no aplica** (es a domicilio) | — |

## Pantallas

Cliente (público, sin cuenta):

| ID | pantalla | ruta / cómo se llega | propósito | componentes clave | estados vistos |
| --- | --- | --- | --- | --- | --- |
| S01 | Página del negocio | `/` | Presentar a D' Garden Tacos y empezar a agendar | Galería, descripción, tarjetas de paquete, mini widget (fecha + invitados + Agendar), reseñas, zona de cobertura, botón de WhatsApp | lleno; sin reseñas; sin paquetes activos (no se puede agendar); móvil |
| S02 | Paquetes | `/paquetes` (o sección de S01) | Comparar paquetes y precios | Tarjeta de paquete, precio por persona, mínimo de invitados, lista de lo que incluye | lleno; paquete agotado o inactivo; móvil |
| S03 | Fecha y hora | `/agendar` (paso 1) | Elegir invitados, fecha y hora de inicio | Selector de invitados, calendario mensual con estados por día, botones de horario, barra de pasos | cargando; día disponible; pocos lugares; día lleno; bloqueado; fuera del plazo (muy pronto o muy lejos); sin fechas en el mes; error de red |
| S04 | Datos del evento | `/agendar` (paso 2) | Captar quién, dónde y qué | Nombre, WhatsApp (+52), correo opcional, dirección, colonia, referencias, enlace a mapa, tipo de evento, paquete, complementos, notas, aceptar políticas | vacío; errores de validación; fuera de zona; invitados bajo el mínimo del paquete |
| S05 | Resumen y pago | `/agendar` (paso 3) | Mostrar el total y elegir cómo pagar | Desglose (paquete × invitados + traslado + complementos), anticipo, opción "Pagar anticipo ahora" / "Pagar después", formulario del proveedor de pagos | pago aprobado; pago rechazado; pago en proceso; fecha ocupada mientras llenaba el formulario |
| S06 | Confirmación | `/t/{codigo}?nuevo=1` | Confirmar que se recibió | Código corto, insignia de estado, resumen, "Enviar por WhatsApp", "Agregar al calendario", enlace a "Mi taquiza" | confirmada (anticipo pagado); solicitada (pendiente de que el negocio acepte); pendiente de pago |
| S07 | Mi taquiza | `/t/{codigo}?k={token}` (enlace privado) | Ver estado y gestionar | Resumen, estado, línea de tiempo de cambios, botones Cambiar / Cancelar / Pagar anticipo, WhatsApp al negocio | solicitada; confirmada; propuesta de otra fecha (aceptar o rechazar); cancelada; completada; enlace inválido o vencido |
| S08 | Cambiar taquiza | `/t/{codigo}/cambiar` | Cambiar fecha, hora o invitados | Reusa S03 y el resumen de S05, con aviso de diferencia de precio | sin cambios; nueva fecha llena; fuera del plazo para cambiar |
| S09 | Políticas y preguntas | `/politicas` | Anticipo, cancelación, cobertura, qué incluye | Acordeón de preguntas | lleno |
| S19 | Dejar reseña | `/t/{codigo}/resena` (enlace después del evento) | Juntar reseñas reales | Estrellas 1 a 5, comentario | vacío; enviada; ya reseñada; taquiza no completada |

Negocio (con sesión):

| ID | pantalla | ruta / cómo se llega | propósito | componentes clave | estados vistos |
| --- | --- | --- | --- | --- | --- |
| S10 | Iniciar sesión | `/admin/entrar` | Acceso del dueño | Correo + enlace mágico o contraseña | vacío; error; enlace enviado |
| S11 | Agenda | `/admin` | Ver todo lo que viene | Pestañas Pendientes / Próximas / Pasadas, vista por día, semana o mes, tarjetas de taquiza, contadores, filtro por estado, "Recordatorios de mañana" | sin taquizas (vacío); con pendientes (resaltadas); cargando; móvil (lista) |
| S12 | Detalle de la taquiza | `/admin/t/{id}` | Decidir y dar seguimiento | Datos del cliente, dirección con enlace a mapa, paquete, invitados, desglose, pagos, estado, acciones (Aceptar, Rechazar, Proponer otra fecha, Marcar pagado, Reembolsar, Completada, No realizada, Cancelar), WhatsApp con mensaje listo, notas internas, historial | cada estado de la taquiza; pago fallido; conflicto de capacidad |
| S13 | Nueva taquiza manual | `/admin/t/nueva` | Registrar pedidos de teléfono o Facebook | El mismo formulario que S03 a S05 en una página, más la opción de saltar el límite de capacidad | vacío; errores; día lleno (con aviso, se permite forzar) |
| S14 | Disponibilidad | `/admin/disponibilidad` | Cuándo y cuánto se puede atender | Horario por día de la semana, horas de inicio, duración, traslado, máximo de taquizas e invitados por día, anticipación mínima y máxima, fechas bloqueadas | por defecto; editado; error de validación |
| S15 | Paquetes | `/admin/paquetes` | Precios y qué incluye | Lista ordenable, formulario del paquete (nombre, foto, descripción, precio por persona, mínimo y máximo de invitados, incluye, activo), complementos | sin paquetes; lleno; editando |
| S16 | Zonas de cobertura | `/admin/zonas` | Dónde se atiende y cuánto cuesta el traslado | Lista de zonas o colonias con su cargo | vacío; lleno |
| S17 | Ajustes | `/admin/ajustes` | Reglas del negocio | Anticipo (no, opcional u obligatorio; % o monto), confirmación automática o manual, política de cancelación, número de WhatsApp, plantillas de mensajes, datos del negocio | por defecto; guardado; error |
| S18 | Clientes | `/admin/clientes` | Quién ha contratado y cuántas veces | Tabla de clientes, historial de taquizas, notas | vacío; lleno; búsqueda sin resultados |

## Flujos

```
F01 El cliente agenda una taquiza con anticipo en línea
    S01 -> S03 -> S04 -> S05 -> S06 (confirmada)
    clics en el camino feliz: 7 (Agendar, día, hora, Continuar, Continuar, Pagar anticipo, Pagar)
    referencia OpenTable: unos 3 clics para una mesa (horario, completar, confirmar)
    edge: el día se llena mientras llena el formulario; pago rechazado; el cliente cierra
          la ventana del pago antes de que llegue la confirmación del proveedor; invitados
          bajo el mínimo del paquete; dirección fuera de zona; doble clic en Pagar
```

```
F02 El cliente agenda sin pago en línea
    S01 -> S03 -> S04 -> S05 ("Pagar después") -> S06 (solicitada) -> WhatsApp al negocio
    clics en el camino feliz: 6 + "Enviar por WhatsApp"
    edge: el número de WhatsApp tiene un error; el cliente manda la solicitud dos veces;
          la fecha se aparta o no mientras está pendiente (decisión: se aparta N horas
          configurables y luego se libera)
```

```
F03 El dueño revisa y acepta una solicitud
    aviso (correo o notificación) -> S10 -> S11 (Pendientes) -> S12 -> Aceptar -> WhatsApp ya escrito al cliente
    clics en el camino feliz: 4
    edge: dos solicitudes para el mismo día exceden la capacidad; el cliente ya canceló;
          el anticipo es obligatorio y no se ha pagado
```

```
F04 El dueño rechaza o propone otra fecha
    S12 -> Rechazar (con motivo) | Proponer otra fecha (S03 embebido) -> WhatsApp al cliente
    -> S07 del cliente muestra la propuesta -> el cliente acepta o rechaza
    edge: el cliente nunca responde (la propuesta vence); la fecha propuesta se llena antes
          de que el cliente acepte
```

```
F05 El cliente cambia o cancela
    WhatsApp/correo con el enlace -> S07 -> Cambiar (S08) | Cancelar (modal con la política)
    -> S07 actualizado -> aviso al negocio
    clics en el camino feliz: 3 para cancelar
    edge: fuera del plazo de reembolso; anticipo pagado (reembolso); el cambio sube el
          precio (diferencia); enlace reenviado a otra persona (el token es secreto)
```

```
F06 El dueño configura la disponibilidad y bloquea fechas
    S11 -> S14 -> editar el horario semanal o la capacidad, o bloquear fechas -> Guardar
    edge: bloquear una fecha que ya tiene taquizas confirmadas (avisar, no borrar)
```

```
F07 El dueño configura paquetes y precios
    S11 -> S15 -> nuevo o editar -> Guardar
    edge: cambiar el precio de un paquete con taquizas ya agendadas (se respeta el precio
          con que se agendaron); desactivar un paquete en uso
```

```
F08 El dueño registra una taquiza que llegó por teléfono o Facebook
    S11 -> S13 -> Guardar (confirmada o solicitada) -> WhatsApp ya escrito al cliente
    clics en el camino feliz: 3 + captura
    edge: cliente que ya existe (mismo WhatsApp: se reusa); día lleno (forzar con aviso)
```

```
F09 Recordatorio antes del evento
    S11 "Recordatorios de mañana" -> botón WhatsApp por taquiza (MVP)
    | envío automático 24 h antes (con la API de WhatsApp Business)
    edge: la taquiza se canceló después de preparar el recordatorio
```

```
F10 Después del evento
    S12 -> Marcar saldo pagado -> Completada -> WhatsApp con el enlace de reseña -> S19
    edge: no se realizó (el cliente no estaba); reseña con groserías (moderar antes de publicar)
```

## Componentes

| componente | variantes | estados | usado en |
| --- | --- | --- | --- |
| Botón | primario, secundario, fantasma, peligro, WhatsApp | normal, hover, foco, deshabilitado, cargando | todas |
| Campo de texto | texto, teléfono (+52), correo, número | vacío, foco, lleno, error, deshabilitado | S04, S10, S13 a S17 |
| Área de texto | — | vacío, lleno, error | S04, S12, S19 |
| Selector (select) | simple | cerrado, abierto, seleccionado | S04, S14, S17 |
| Selector de invitados | botones − / + con número editable | mínimo, máximo, normal | S01, S03, S08, S13 |
| Calendario mensual | cliente, admin | día disponible, pocos lugares, lleno, bloqueado, fuera de plazo, seleccionado, hoy | S03, S08, S11, S14 |
| Botones de horario | — | disponible, seleccionado, no disponible | S03, S08, S13 |
| Barra de pasos | 3 pasos | actual, completado, pendiente | S03 a S05 |
| Tarjeta de paquete | compacta, completa, seleccionable | normal, seleccionada, inactiva | S01, S02, S04, S15 |
| Desglose de precio | — | con o sin traslado, con o sin anticipo | S05, S06, S07, S12 |
| Insignia de estado | solicitada, pendiente de pago, confirmada, propuesta, rechazada, cancelada, completada, no realizada | — | S06, S07, S11, S12 |
| Tarjeta de taquiza | lista, agenda | normal, pendiente (resaltada), pasada | S11, S18 |
| Modal | confirmación, peligro | abierto, enviando | S07, S12 |
| Toast | éxito, error, información | — | todas |
| Estado vacío | con o sin acción | — | S01, S11, S15, S16, S18 |
| Navegación del admin | barra lateral (escritorio), barra inferior (móvil) | activo | S11 a S18 |
| Galería de fotos | carrusel | cargando | S01 |
| Enlace a mapa | Google Maps | — | S04, S12 |
| Estrellas | entrada, solo lectura | — | S01, S19 |
| Formulario de pago | del proveedor (Mercado Pago o Stripe), embebido | cargando, error, aprobado | S05, S07 |
| Línea de tiempo | historial de la taquiza | — | S07, S12 |

## Modelo de datos inferido

```
Negocio        id, nombre, slug, descripcion, whatsapp, email, ciudad, zona_horaria
               ("America/Mexico_City"), fotos[], anticipo_modo (ninguno|opcional|obligatorio),
               anticipo_tipo (porcentaje|monto), anticipo_valor, confirmacion (auto|manual),
               horas_apartado_sin_pago, politica_cancelacion (texto), dias_reembolso,
               anticipacion_min_dias, anticipacion_max_dias
               evidencia: perfil y ajustes del restaurante en OpenTable (fuente 9); preguntas abiertas 1 a 7
               confianza: media (los campos); guess (los valores)

ReglaDisponibilidad  id, negocio_id, dia_semana (0-6), activo, hora_inicio_min, hora_inicio_max,
               intervalo_min (ej. 30), duracion_min, traslado_min,
               max_taquizas_dia, max_invitados_dia
               evidencia: turnos y pacing de OpenTable (fuente 9); pregunta abierta 2
               confianza: media

FechaBloqueada id, negocio_id, fecha, motivo
               evidencia: días cerrados de OpenTable (fuente 9)
               confianza: alta

Paquete        id, negocio_id, nombre, descripcion, foto, precio_por_persona (centavos MXN),
               min_invitados, max_invitados, incluye (json), activo, orden
               evidencia: menú y Experiences de OpenTable (fuentes 6 y 9); pregunta abierta 1
               confianza: media

Complemento    id, negocio_id, nombre, precio (centavos), unidad (por_persona|fijo), activo
               evidencia: ninguna de OpenTable; necesidad del negocio
               confianza: guess

Zona           id, negocio_id, nombre, cargo_traslado (centavos), activo
               evidencia: ninguna de OpenTable; pregunta abierta 4
               confianza: guess

Cliente        id, negocio_id, nombre, whatsapp (E.164, único por negocio), email (opcional),
               notas, creado_en
               evidencia: perfiles de comensales de OpenTable (fuente 9); S04
               confianza: alta

Taquiza        id, negocio_id, codigo (corto y legible, ej. "DGT-4K7Q"), token_gestion (secreto),
               cliente_id, paquete_id, fecha, hora_inicio, duracion_min, invitados,
               direccion, colonia, referencias, zona_id, tipo_evento, notas_cliente,
               notas_internas, precio_por_persona (copia), subtotal, cargo_traslado,
               total_complementos, total, anticipo_monto,
               estado (solicitada | pendiente_pago | confirmada | propuesta | rechazada |
                       cancelada_cliente | cancelada_negocio | completada | no_realizada),
               fecha_propuesta, hora_propuesta, origen (web|manual), apartado_hasta,
               creado_en, confirmado_en, cancelado_en, motivo_cancelacion
               evidencia: reservación de OpenTable y sus estados (fuente 9); S03 a S07, S12
               confianza: alta (estructura); media (los estados)

TaquizaComplemento  taquiza_id, complemento_id, cantidad, precio_unitario (copia)
               confianza: guess

Pago           id, taquiza_id, tipo (anticipo|saldo|reembolso), metodo (tarjeta|oxxo|spei|
               efectivo|transferencia), proveedor (mercadopago|stripe|manual), monto,
               estado (pendiente|aprobado|rechazado|reembolsado), referencia_externa, pagado_en
               evidencia: depósitos y prepagos de OpenTable (fuentes 6 y 9)
               confianza: media

EventoHistorial id, taquiza_id, tipo (creada|aceptada|rechazada|propuesta|cambiada|cancelada|
               pago|recordatorio|completada), actor (cliente|negocio|sistema), datos (json), creado_en
               evidencia: S07 y S12 (línea de tiempo)
               confianza: guess

Mensaje        id, taquiza_id, canal (whatsapp|correo), plantilla (solicitud|confirmacion|
               propuesta|recordatorio|cancelacion|resena), modo (enlace|api), estado
               (preparado|enviado|fallido), enviado_en
               evidencia: confirmaciones y recordatorios de OpenTable (fuente 6)
               confianza: media

Resena         id, taquiza_id (única), calificacion (1-5), comentario, publicada, creado_en
               evidencia: OpenTable solo deja reseñar a quien asistió (fuente 9)
               confianza: media

UsuarioAdmin   id, negocio_id, email, rol (dueno|ayudante), creado_en
               confianza: media
```

Relaciones: Negocio 1-n ReglaDisponibilidad, FechaBloqueada, Paquete, Complemento, Zona,
Cliente, Taquiza y UsuarioAdmin. Cliente 1-n Taquiza. Paquete 1-n Taquiza. Zona 1-n Taquiza.
Taquiza 1-n Pago, EventoHistorial y Mensaje. Taquiza n-n Complemento (por TaquizaComplemento).
Taquiza 1-0..1 Resena.

Regla clave de capacidad: para una fecha, se suman las taquizas en estado `confirmada`,
`pendiente_pago`, `solicitada` (con `apartado_hasta` vigente) y `propuesta` (si la fecha es
la propuesta). Se compara contra `max_taquizas_dia` y `max_invitados_dia`, y se respeta el
traslado entre horarios. Esta revisión se repite dentro de una transacción al confirmar
(F01 edge: fecha ocupada mientras llenaba el formulario).

## Matriz de funciones

Ver `features.csv`. Must: 33, should: 13, could: 9, skip: 10.
De esas, 10 filas son propias de la taquiza (`original = no`: dirección del evento, zona,
WhatsApp, pagos manuales). `parity.py` las lista aparte y no entran en la paridad con OpenTable.

## Fuera de alcance (no se puede o no se debe clonar)

- **La red de OpenTable**: más de 70 000 restaurantes, la búsqueda entre ellos, mapas y
  filtros. El sistema es de un solo negocio.
- **Sus datos**: reseñas de comensales, calificaciones, guías editoriales y recomendaciones.
- **Concierge con IA y el programa de puntos**: no aplican con un solo negocio.
- **Plano de mesas**: la taquiza es a domicilio.
- **Apps nativas y widget de iOS**: se eligió web responsiva.
- **Integraciones con punto de venta y acuerdos con socios**: son acuerdos comerciales de OpenTable.
- **SMS automático como el de OpenTable**: se reemplaza por WhatsApp.

## Tamaño

Pantallas 19, flujos 10, entidades 14.

Partes difíciles:
1. **Disponibilidad y capacidad** sin dobles reservas: varias taquizas por día, traslado
   entre eventos, apartados que vencen, y la revisión de nuevo al confirmar.
2. **Pagos de anticipo**: integración con Mercado Pago o Stripe, confirmación por webhook,
   pagos que quedan en proceso (OXXO o SPEI si se activan) y reembolsos.
3. **WhatsApp**: los enlaces wa.me son triviales, pero el envío automático exige la API de
   WhatsApp Business (cuenta de Meta verificada, plantillas aprobadas, costo por
   conversación). Recomendación: MVP con enlaces y la API después.

Tamaño: **M** (unas semanas). El MVP con solo los `must` (sin la API de WhatsApp ni
reembolsos automáticos) se acerca a **S+**.
