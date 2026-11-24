# Paridad: taquizas de D' Garden Tacos frente a OpenTable

Fecha: 2026-11-24. Build: `6155821`.
Se generó con `python3 .claude/skills/replica-diff/parity.py replica/features.csv`.

## Veredicto: todavía no se puede publicar

Falta terminar **una función obligatoria**: ver la agenda por semana y por mes. Por la regla,
mientras falte una obligatoria el sistema no se publica, aunque lo demás esté bien. Esa es la
única razón.

| criterio para publicar | estado |
| --- | --- |
| Todas las funciones obligatorias | ❌ 28 de 29 (falta la agenda por semana y mes) |
| Puntuación de funciones de 80 o más | ✅ 93.8 |
| Sin bugs S1 ni S2 abiertos | ✅ 0 abiertos; se encontraron 7 y se corrigieron (`bugs.md`) |
| Pruebas en verde | ✅ 55 de 55 con Postgres (`test-plan.md`) |

Con la agenda por semana y mes, el sistema pasa a **publicable** (95.1).

Para llegar a **mejor que el original** falta el siguiente paso, `/replica-entrepreneur`, que
lee qué critican los usuarios de OpenTable y de los sistemas de reservas.

## Puntuación

| medida | resultado |
| --- | --- |
| **Funciones** (lo que importa) | **93.8 / 100**. 45 funciones contadas; obligatorias: 28 de 29 |
| Distribución de pantallas | **No se midió.** No hay capturas del original (ver abajo) |
| General | 93.8 (solo funciones) |

Cómo se calcula: las obligatorias valen 3, las recomendables 2 y las opcionales 1. Una función a
medias cuenta la mitad. No cuentan las 10 que se dejaron fuera a propósito ni las 10 que son
solo tuyas (por ejemplo zonas con cargo por traslado y WhatsApp con mensaje listo).

### Por área, de la más débil a la más fuerte

| área | puntos | funciones |
| --- | --- | --- |
| reportes | 0.0 | 1 |
| avisos | 66.7 | 3 |
| pagos | 87.5 | 3 |
| panel (usuarios) | 87.5 | 2 |
| agenda del panel | 88.6 | 9 |
| página pública, paquetes, agendar, mi taquiza, reseñas, general, disponibilidad, ajustes, clientes | 100 | 27 |

## Lo que falta, en orden

| prioridad | función | estado | qué falta |
| --- | --- | --- | --- |
| **obligatoria** | Agenda por día, semana y mes | a medias | Hoy es una lista por día con pestañas; falta la vista de calendario por semana y por mes |
| recomendable | Recordatorio antes del evento | a medias | Hoy es la lista "Recordatorios de mañana" con botón de WhatsApp. El envío automático necesita la API de WhatsApp Business |
| recomendable | Reembolsar un anticipo | a medias | El reembolso completo ya funciona; falta el reembolso parcial |
| opcional | Exportar taquizas a CSV | no | — |
| opcional | Avisos automáticos por WhatsApp | no | Necesita una cuenta de Meta, plantillas aprobadas y paga por conversación |
| opcional | Reporte de ventas por mes | no | — |
| opcional | Ayudante con acceso limitado | a medias | Los permisos ya funcionan; falta una pantalla para invitarlo. Hoy solo se agrega desde la base de datos |

Se dejaron fuera a propósito, porque no aplican a un solo negocio o son propiedad de
OpenTable: buscador de restaurantes, mapa y filtros, guías, asistente con IA, puntos, avisos de
lugar liberado, plano de mesas, apps nativas, reseñas de OpenTable e integraciones con socios.

## Distribución de pantallas: no se midió

No hay capturas de OpenTable en `replica/screens/`. Su sitio no se pudo leer desde este entorno
(devolvió 503) y no se intentó saltar el bloqueo. Para medirla, haz estas capturas **en tu
celular**, como cualquier usuario, y súbelas aquí con estos nombres:

| captura de OpenTable | guárdala como | se compara con |
| --- | --- | --- |
| Página de un restaurante | `replica/screens/S01.png` | `replica/clone-screens/S01.png` |
| Elegir personas, fecha y hora | `replica/screens/S03.png` | `replica/clone-screens/S03.png` |
| Formulario de datos de la reservación | `replica/screens/S04.png` | `replica/clone-screens/S04.png` |
| Pantalla de confirmación | `replica/screens/S06.png` | `replica/clone-screens/S06.png` |
| "Mi reservación" (ver, cambiar, cancelar) | `replica/screens/S07.png` | `replica/clone-screens/S07.png` |

El panel del dueño no se puede comparar: el de OpenTable necesita una cuenta de restaurante.

Puntuación esperada: **baja, y está bien**. La taquiza necesita dirección, zona y paquete, así
que el flujo tiene 3 pasos donde OpenTable usa un solo widget. Esta comparación sirve para ver
que la información importante esté en lugares conocidos. No hay que copiar cómo se ve OpenTable:
su aspecto es suyo, y `/replica-brand` cambia los colores de todos modos.

## Diferencias de comportamiento

Lo que dice la columna de OpenTable viene del mapa de recon (`recon.md`): la ficha de App Store
y conocimiento general, con confianza media. No se volvió a revisar en la app.

| flujo | OpenTable | el sistema de taquizas | ¿arreglar o dejar? |
| --- | --- | --- | --- |
| Agendar (F01, F02) | Unos 3 toques para una mesa: horario, completar, confirmar | 8 toques más 4 campos de texto: Agendar, día, hora, Continuar, zona, Continuar, aceptar políticas, Enviar o Ir a pagar. Con anticipo opcional se suma "Agendar sin pagar en línea" | **Dejar.** Una taquiza a domicilio necesita la dirección. La zona se elige sola si solo hay una. La casilla de políticas protege al negocio si hay un reclamo por el anticipo |
| Cuenta del cliente | Sugiere crear cuenta; la cuenta guarda reservaciones y datos | Sin cuenta: un enlace privado por taquiza. Si el formulario se interrumpe, al recargar sigue donde iba | **Dejar.** Menos fricción. Si el cliente pierde el enlace, el dueño genera uno nuevo |
| Confirmación al cliente | Correo y SMS automáticos | Pantalla de confirmación con código y enlace. El aviso de "confirmada" sale cuando el dueño toca el botón de WhatsApp. **El cliente nunca recibe correo**, aunque lo haya dado | **Arreglar.** Si dejó su correo, mandarle la confirmación, los cambios y el recordatorio con su enlace. El sistema de envío de correo con reintentos ya existe |
| Recordatorio (F09) | Automático antes de la reservación | El dueño toca "Recordar" en la lista de mañana | **Arreglar en parte** con el correo de arriba. WhatsApp automático, cuando valga la pena pagar la API |
| Aviso al negocio | En tiempo real en su panel | Correo con reintentos y un resumen diario | **Dejar** por ahora |
| Día lleno mientras llena el formulario | Avisa que el horario ya no está | Regresa al paso 1 con aviso y conserva los datos | Igual |
| Pago rechazado | Deja reintentar | "El pago no pasó" y deja reintentar; la fecha sigue apartada 30 minutos (se puede cambiar) | Igual |
| Sin conexión | — (no verificado) | Avisa y deja reintentar sin perder nada | **Dejar** (corregido en BUG-004) |
| Cancelar (F05) | 2 o 3 toques desde la app | 2 toques desde el enlace, con la política a la vista y reembolso automático dentro del plazo | Igual o mejor |
| Responder una solicitud (F03, F04) | Solicitud de evento privado; el restaurante contesta por correo | 3 toques desde el correo: abrir, Aceptar, WhatsApp con el mensaje listo. También se puede rechazar con motivo o proponer otra fecha | **Dejar.** Es más rápido |
| Agenda del dueño | Libro de reservaciones por turno, con vista de día | Lista por día, con pestañas por estado | **Arreglar:** vista por semana y por mes (es la obligatoria que falta) |

## Las 5 cosas que siguen

1. **Agenda por semana y por mes** (obligatoria). Con esto el sistema se puede publicar: 95.1.
2. **Correo al cliente cuando deja su correo:** confirmación con su enlace, cambios,
   cancelación y recordatorio el día antes. Cubre en parte los avisos automáticos sin pagar la
   API de WhatsApp.
3. **Reembolso parcial** en el detalle de la taquiza (recomendable).
4. **Pantalla para invitar al ayudante** desde Ajustes (opcional, pero hoy no hay otra forma de
   darlo de alta).
5. **Reporte de ventas del mes y exportar a CSV** (opcionales; reportes es el área en 0).

Con las 5, la puntuación de funciones sube a unos **98.2**. Los recordatorios y los avisos
automáticos por WhatsApp siguen a medias o pendientes.
Antes de publicar también falta la lista manual de `test-plan.md`: pago real de prueba en Mercado
Pago, correos y WhatsApp en un teléfono.
