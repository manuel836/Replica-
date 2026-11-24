# Paridad: taquizas de D' Garden Tacos frente a OpenTable

Fecha: 2026-11-24. Build: `c9d37a9`.
Se generó con `python3 .claude/skills/replica-diff/parity.py replica/features.csv`.

Historial:

| fecha | build | funciones | obligatorias | veredicto |
| --- | --- | --- | --- | --- |
| 2026-11-24, primer `/replica-diff` | `6155821` | 93.8 | 28 de 29 | no se puede publicar |
| 2026-11-24, después de `/replica-build` | `c9d37a9` | **98.2** | **29 de 29** | **se puede publicar** |

## Veredicto: se puede publicar

| criterio para publicar | estado |
| --- | --- |
| Todas las funciones obligatorias | ✅ 29 de 29 (la agenda por semana y mes ya está) |
| Puntuación de funciones de 80 o más | ✅ 98.2 |
| Sin bugs S1 ni S2 abiertos | ✅ 0 abiertos; se encontraron 8 y se corrigieron (`bugs.md`) |
| Pruebas en verde | ✅ 71 de 71 con Postgres; 69 de 69 con datos en memoria (`test-plan.md`) |
| Compila para producción | ✅ `next build` sin errores |

"Publicable" se refiere al código. Para salir en vivo todavía falta lo que necesita tus cuentas:
- Las llaves de Mercado Pago, Resend y Supabase (`replica/backend.md`).
- La lista manual de `test-plan.md`: pago real de prueba, correos en bandeja de entrada y WhatsApp en el teléfono.
- Tus datos reales: paquetes, precios, zonas, anticipo y número de WhatsApp.

Para llegar a **mejor que el original** falta `/replica-entrepreneur`: leer qué critican los
usuarios de OpenTable y de los sistemas de reservas, y arreglarlo aquí.

## Puntuación

| medida | resultado |
| --- | --- |
| **Funciones** (lo que importa) | **98.2 / 100**. 46 funciones contadas; obligatorias: 29 de 29 |
| Distribución de pantallas | **No se midió.** No hay capturas del original (ver abajo) |
| General | 98.2 (solo funciones) |

Cómo se calcula: las obligatorias valen 3, las recomendables 2 y las opcionales 1. Una función a
medias cuenta la mitad. No cuentan las 10 que se dejaron fuera a propósito ni las 10 que son
solo tuyas (por ejemplo zonas con cargo por traslado y WhatsApp con mensaje listo).
Se agregó una fila que faltaba en la matriz: los correos al cliente. OpenTable sí los manda, y
salió como diferencia de comportamiento en el primer reporte.

### Por área

| área | puntos | funciones |
| --- | --- | --- |
| avisos | 75.0 | 4 |
| las otras 13 áreas | 100 | 42 |

## Lo que falta

| prioridad | función | estado | qué falta |
| --- | --- | --- | --- |
| recomendable | Recordatorio antes del evento por WhatsApp | a medias | El recordatorio automático ya sale **por correo** a quien dejó su correo. Por WhatsApp sigue siendo el botón "Recordar" en la agenda. Hacerlo automático necesita la API de WhatsApp Business |
| opcional | Avisos automáticos por WhatsApp | no | Necesita una cuenta de Meta, plantillas aprobadas y paga por conversación |

Las dos dependen de lo mismo: la API de WhatsApp Business. Conviene cuando el volumen de
taquizas justifique el costo por conversación. El esquema ya lo permite (`messages.mode = 'api'`,
un recordatorio automático por canal).

Se dejaron fuera a propósito, porque no aplican a un solo negocio o son propiedad de OpenTable:
- buscador de restaurantes, mapa y filtros, guías
- asistente con IA, puntos, avisos de lugar liberado
- plano de mesas, apps nativas
- reseñas de OpenTable, integraciones con socios

## Qué se hizo desde el primer reporte

| # | qué | commit |
| --- | --- | --- |
| 1 | Agenda por semana y por mes (la obligatoria que faltaba) | `24a0f54` |
| 2 | Correos al cliente si deja su correo: solicitud, confirmación, cambios, cancelación, recordatorio del día anterior y reseña | `47b9b21` |
| 3 | Reembolso parcial del anticipo (y BUG-008: "Pagado" salía en negativo tras un reembolso) | `974332c` |
| 4 | Pantalla Equipo: dar y quitar acceso a ayudantes | `e9cbdb1` |
| 5 | Reporte de ventas del mes y CSV | `c9d37a9` |

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
| Cuenta del cliente | Sugiere crear cuenta; la cuenta guarda reservaciones y datos | Sin cuenta: un enlace privado por taquiza, que ahora también llega por correo si lo dejó. Si el formulario se interrumpe, al recargar sigue donde iba | **Dejar.** Menos fricción. Si el cliente pierde el enlace, lo busca en su correo o el dueño genera uno nuevo |
| Confirmación al cliente | Correo y SMS automáticos | Correo automático en cada cambio (si dejó su correo) más el botón de WhatsApp del dueño | ✅ **Arreglado** en `47b9b21` |
| Recordatorio (F09) | Automático antes de la reservación | Correo automático el día anterior (una vez) y el botón "Recordar" por WhatsApp | ✅ **Arreglado en parte**; WhatsApp automático cuando valga pagar la API |
| Aviso al negocio | En tiempo real en su panel | Correo con reintentos y un resumen diario | **Dejar** por ahora |
| Día lleno mientras llena el formulario | Avisa que el horario ya no está | Regresa al paso 1 con aviso y conserva los datos | Igual |
| Pago rechazado | Deja reintentar | "El pago no pasó" y deja reintentar; la fecha sigue apartada 30 minutos (se puede cambiar) | Igual |
| Sin conexión | — (no verificado) | Avisa y deja reintentar sin perder nada | **Dejar** (corregido en BUG-004) |
| Cancelar (F05) | 2 o 3 toques desde la app | 2 toques desde el enlace, con la política a la vista y reembolso automático dentro del plazo; correo de confirmación | Igual o mejor |
| Reembolsos | Los maneja el restaurante | Completo al cancelar o rechazar; parcial desde el detalle (solo el dueño) | Igual |
| Responder una solicitud (F03, F04) | Solicitud de evento privado; el restaurante contesta por correo | 3 toques desde el correo: abrir, Aceptar, WhatsApp con el mensaje listo. También se puede rechazar con motivo o proponer otra fecha | **Dejar.** Es más rápido |
| Agenda del dueño | Libro de reservaciones por turno, con vista de día | Lista por día y estado, semana y mes, con días cerrados, bloqueados y lugares ocupados | ✅ **Arreglado** en `24a0f54` |
| Reportes | Reportes del restaurante (planes de pago) | Reporte del mes y CSV, solo el dueño | Igual |

## Lo que sigue

1. **`/replica-entrepreneur`**: qué critican los usuarios de los sistemas de reservas y cómo hacer
   que el tuyo sea mejor, no una copia.
2. **Tus datos y tus cuentas**: paquetes, precios, zonas, anticipo, WhatsApp y las llaves de
   Mercado Pago, Resend y Supabase (`replica/backend.md`).
3. **La lista manual** de `test-plan.md` con tus cuentas y tu teléfono.
4. **WhatsApp automático** (API de WhatsApp Business), cuando el volumen lo justifique.
5. **Capturas de OpenTable en tu celular**, si quieres la comparación de pantallas.
