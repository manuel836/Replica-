# Plan de pruebas: taquizas de D' Garden Tacos

Build: `da63f7c` y siguientes; la última corrida, en `5a16592`. Fecha: 2026-11-25.
Entorno: local; la app en `next dev` y una imitación de Mercado Pago y Resend (`e2e/mocks/providers.mjs`).

| corrida | datos | resultado |
| --- | --- | --- |
| Primera | memoria | 44 pasaron, 9 fallaron, 2 se saltaron. Las 9 fallas: 7 bugs reales (`bugs.md`) y 2 pruebas mal escritas |
| Final | memoria | **53 pasaron, 0 fallaron**, 2 se saltaron (solo Postgres) |
| Final | Postgres 16 | **55 pasaron, 0 fallaron** |
| Después de `/replica-build` (16 casos nuevos) | memoria | **69 pasaron, 0 fallaron**, 2 se saltaron (solo Postgres) |
| Después de `/replica-build` (16 casos nuevos) | Postgres 16 | **71 pasaron, 0 fallaron** |
| Después de los arreglos de `/replica-entrepreneur` (12 casos nuevos) | memoria | **81 pasaron, 0 fallaron**, 2 se saltaron (solo Postgres) |
| Después de los arreglos de `/replica-entrepreneur` (12 casos nuevos) | Postgres 16 | **83 pasaron, 0 fallaron** |
| Tercera ronda, después de la marca (9 casos nuevos) | memoria | Primera vuelta: 89 pasaron, 1 falló (límite de enlaces del ayudante en las pruebas, no un bug) y 1 caso nuevo descubrió BUG-009. Final: **90 pasaron, 0 fallaron**, 2 se saltaron |
| Tercera ronda, después de la marca | Postgres 16 | **92 pasaron, 0 fallaron** |
| Portada de lanzamiento (3 casos nuevos) | memoria | **93 pasaron, 0 fallaron**, 2 se saltaron (solo Postgres) |
| Portada de lanzamiento | Postgres 16 | **95 pasaron, 0 fallaron** |

Cómo correrlas:

```bash
npm run test:e2e                                                        # datos en memoria
E2E_DATABASE_URL=postgres://…/taquizas_e2e npm run test:e2e             # Postgres (se BORRA esa base)
npm run test:e2e:report                                                 # reporte HTML
```

Cada prueba falla además si hay un error de consola, un error de página o una respuesta 5xx
(`e2e/helpers.ts`). axe-core revisa cada pantalla (WCAG 2.0–2.2 A/AA y buenas prácticas). Los
selectores van por rol y etiqueta, nunca por clases.

## Casos

`e2e` = automatizado; `manual` = lista de abajo. Resultado de la corrida final.

| caso | flujo | tipo | pasos | esperado | auto | resultado |
| --- | --- | --- | --- | --- | --- | --- |
| F01-H1 | Agendar con anticipo | feliz | Día, hora, datos, "Ir a pagar", aprobar | Pago recibido, confirmada, anticipo aprobado en el panel | e2e | ✅ |
| F01-H2 | | feliz | Llegar a Mercado Pago | Preferencia en MXN, `binary_mode`, 3 tipos excluidos, webhook, llave de idempotencia, sin token del cliente | e2e | ✅ |
| F01-N1 | | negativo: tarjeta rechazada | Rechazar, reintentar, aprobar | "El pago no pasó", no confirma, deja reintentar | e2e | ✅ (tras BUG-007) |
| F01-E1 | | doble clic en enviar | Doble clic en "Enviar solicitud" | Una sola taquiza | e2e | ✅ |
| F01-E2 | | dos clientes, mismo horario | Dos pestañas mandan a la vez | Una agendada; la otra vuelve al paso 1 con aviso y datos | e2e | ✅ |
| F01-E3 | | sin conexión | Modo avión y enviar | Mensaje de conexión, botón listo para reintentar | e2e | ✅ (tras BUG-004) |
| F01-E4 | | regreso del pago en otro dispositivo | Abrir el regreso sin cookie | Mensaje neutro, sin datos de la taquiza | e2e | ✅ |
| F01-E5 | | otra zona horaria | Teléfono en Asia/Tokyo agenda | Se guarda el día y la hora elegidos (hora del centro); sin error de hidratación | e2e | ✅ (tras BUG-005) |
| F02-H1 | Agendar sin pago | feliz | S01 → S03 → S04 → S05 → S06 | "Recibimos tu solicitud", en "Por responder", correo al dueño; axe en cada paso | e2e | ✅ |
| F02-E1 | | campos vacíos | Continuar sin llenar | 5 campos marcados, foco en el primero | e2e | ✅ |
| F02-E2 | | texto muy largo | Nombre de 81 caracteres | El servidor lo rechaza y regresa al campo | e2e | ✅ |
| F02-E3 | | acentos y emoji | "José Ñúñez Gutiérrez 🌮" y notas con emoji | Intactos en el panel y en el mensaje | e2e | ✅ |
| F02-E4 | | WhatsApp | 5 dígitos; luego "+52 753 123 4567" | Error; luego lo acepta | e2e | ✅ |
| F02-E5 | | Atrás del navegador | Paso 3 → Atrás → Atrás | Paso 2 con datos; paso 1 con hora elegida | e2e | ✅ (tras BUG-002) |
| F02-E6 | | recargar a mitad | Recargar en el paso 2 | Sigue en el paso 2 con los datos | e2e | ✅ (tras BUG-003) |
| F02-E7 | | solo teclado | Todo el flujo con Tab, flechas, Espacio y Enter | Agenda; foco siempre visible | e2e | ✅ |
| F02-E8 | | celular 390 px | Recorrer S01 → S05 | 0 px de desborde; axe sin violaciones | e2e | ✅ |
| F02-N1 | | sin aceptar políticas | Enviar sin la casilla | Error, no se envía | e2e | ✅ |
| F02-N2 | | abuso | 4 solicitudes del mismo WhatsApp en 1 hora | La 4.ª se frena | e2e | ✅ |
| F03-H1 | El dueño acepta | feliz | Abrir la solicitud y aceptar | Confirmada; el WhatsApp trae un enlace que funciona | e2e | ✅ |
| F03-E1 | | día cerrado después | Cerrar el día y aceptar | Aviso "Ese día no trabajamos" y opción de aceptar de todos modos | e2e | ✅ |
| F03-N1 | | sesión vencida | Borrar cookies y aceptar | "Tu sesión terminó", nada cambia | e2e | ✅ |
| F03-N2 | | permiso negado | El ayudante entra a Ajustes y cancela | Lo regresa con aviso; "Solo el dueño puede hacer esto." | e2e | ✅ |
| F04-H1 | Proponer o rechazar | feliz | Proponer otra fecha; el cliente acepta | Confirmada en la nueva fecha | e2e | ✅ |
| F04-H2 | | feliz | El cliente rechaza la propuesta | Rechazada | e2e | ✅ |
| F04-H3 | | feliz | Rechazar con motivo | El cliente ve el aviso con el motivo | e2e | ✅ |
| F04-E1 | | propuesta vencida | Esperar 48 h | "La propuesta ya venció" | manual | regla probada en el job; no automatizado (reloj) |
| F05-H1 | Cambiar o cancelar | feliz | Cambiar fecha y +5 invitados | Nueva fecha, 45 invitados, en el historial; correo "Guardamos el cambio" | e2e | ✅ |
| F05-H2 | | cancelar en plazo | Pagar y cancelar | Reembolso en Mercado Pago con llave de idempotencia | e2e | ✅ |
| F05-E1 | | cancelar fuera de plazo | Plazo de 365 días, pagar y cancelar | Lo advierte; sin reembolso | e2e | ✅ |
| F05-N1 | | registro inexistente o enlace viejo | "Nuevo enlace"; abrir el viejo y uno inventado | "Este enlace no funciona" (h1, axe) | e2e | ✅ |
| F05-E2 | | calendario .ics | Descargar el .ics | `text/calendar`, hora en UTC (+6 h) | e2e | ✅ |
| F06-H1 | Disponibilidad | feliz | Bloquear y desbloquear un día | Sale y vuelve en el calendario público | e2e | ✅ |
| F06-N1 | | horario inválido | Última hora antes de la primera | Error, no se guarda | e2e | ✅ |
| F07-H1 | Paquetes | feliz | Crear y ocultar | Aparece y desaparece de la página pública | e2e | ✅ |
| F07-N1 | | vacío | Guardar sin nombre ni precio | Errores en el diálogo | e2e | ✅ |
| F07-E1 | | fotos | PNG; luego texto renombrado a .jpg | Se sube y se ve; el falso se rechaza | e2e | ✅ |
| F07-E2 | | precio congelado | Agendar y luego subir el precio | La taquiza conserva $150 por persona | e2e | ✅ |
| F08-H1 | Taquiza registrada a mano | feliz + choque | Registrar; otra en el mismo horario; forzar | Se guarda; el choque avisa; forzar queda anotado | e2e | ✅ |
| F09-H1 | Recordatorios | feliz | "Recordatorios de mañana" → Recordar | WhatsApp con "Mañana es tu taquiza" | e2e | ✅ |
| F09-H2 | | job | Llamar al cron diario | 200 y corrida registrada | e2e | ✅ |
| F09-E1 | | correo caído | Resend falla al recibir una solicitud | No se pierde; el job lo reintenta y llega | e2e | ✅ |
| F10-H1 | Después del evento | feliz | Completar → reseña → publicar | Visible en la página | e2e | ✅ |
| F10-H2 | | feliz | Registrar $1,800 en efectivo | "Por cobrar" baja de $6,000 a $4,200 | e2e | ✅ |
| F10-N1 | | antes de tiempo | Abrir la reseña antes del evento | "Todavía no es momento" (h1, axe) | e2e | ✅ |
| F10-E1 | | no publicar | "No publicar" y recargar | No vuelve a la cola | e2e | ✅ (tras BUG-006) |
| F11-H1/N1 | Acceso al panel | feliz + reuso | Entrar con el enlace; usarlo otra vez | Entra; la 2.ª vez "Ese enlace ya no sirve" | e2e | ✅ |
| F11-N2 | | correo desconocido | Pedir enlace | Misma respuesta, sin correo enviado | e2e | ✅ |
| F11-N3 | | sin sesión | Abrir /admin | Va a entrar; axe en S10 | e2e | ✅ |
| F11-E1 | | cerrar todo | El ayudante cierra en todos lados | La otra sesión queda fuera | e2e | ✅ (tras BUG-001) |
| F12-N1/E1 | Avisos de pago | firma falsa, aviso repetido | Reenviar el aviso con y sin firma válida | 401; 200 sin duplicar el pago | e2e | ✅ |
| F12-N2 | | sin firma | POST sin x-signature | 401 | e2e | ✅ |
| SEC-1 | Base de datos | RLS | Rol `anon` con permiso de select | 0 filas | e2e (Postgres) | ✅ |
| SEC-2 | | datos de otro negocio | Cookie válida de otro negocio | No entra al panel ni a los enlaces de WhatsApp | e2e (Postgres) | ✅ |

## Agregados después de `/replica-diff`

| caso | flujo | tipo | pasos | esperado | auto | resultado |
| --- | --- | --- | --- | --- | --- | --- |
| S11-H1 | Agenda semana y mes | feliz | Agendar; el dueño abre "Mes", busca la taquiza, va a su semana y a su detalle | Sale en el mes y en la semana con nombre, hora y lugares ocupados; axe sin violaciones | e2e | ✅ |
| S11-H2 | | feliz | Bloquear un día con motivo | La semana dice "Bloqueado: motivo"; el mes lo marca | e2e | ✅ |
| S11-H3 | | feliz | Flechas y "Esta semana" / "Este mes" | Cambian de periodo y regresan a hoy | e2e | ✅ |
| S11-E1 | | celular 390 px | Semana y mes en celular | 7 días en columna, conteos en el mes, 0 px de desborde, axe | e2e | ✅ |
| S11-E2 | | dirección inválida | `fecha=2026-02-31` y `fecha=hola` | Regresa a hoy sin error | e2e | ✅ |
| CE-H1 | Correos al cliente | feliz | Agendar con correo; el dueño acepta; el cliente cancela desde el enlace del correo | Correos de solicitud, confirmación y cancelación; responder llega al negocio; queda en el historial | e2e | ✅ |
| CE-H2 | | sin correo | Agendar sin correo | Al cliente no se le manda nada; solo el aviso al dueño | e2e | ✅ |
| CE-H3 | | recordatorio | Proponer mañana, aceptar y correr el job dos veces | Correo de propuesta, de confirmación y **un solo** recordatorio | e2e | ✅ |
| S12-N0 | Reembolsos | BUG-008 | Pagar, cancelar en plazo, abrir el detalle | "Pagado: $0" (antes: -$1,800) | e2e | ✅ (tras BUG-008) |
| S12-H1 | | feliz | Reembolsar $500 de $1,800; luego cancelar | Reembolso de $500 en Mercado Pago, "Pagado: $1,300"; al cancelar se devuelven $1,300, no $1,800 | e2e | ✅ |
| S12-H1 | | negativo | $2,000 y $0 | "Puedes reembolsar hasta $1,800." / "Escribe un monto mayor a cero."; no se reembolsa nada | e2e | ✅ |
| S12-N1 | | permiso | El ayudante abre una taquiza pagada | No ve el botón de reembolso | e2e | ✅ |
| EQ-H1 | Equipo | feliz | Dar acceso a un correo; esa persona entra; quitarle el acceso | Le llega la invitación, entra con su enlace, no ve Equipo; al quitarlo su sesión ya no sirve | e2e | ✅ |
| EQ-N1 | | negativo | Correo inválido o que ya tiene acceso | Mensaje en el campo; no se agrega | e2e | ✅ |
| RP-H1 | Reportes | feliz | Taquiza pagada con nombre `=SUMA(1;1)`; luego $1,000 en efectivo | El CSV cuadra (total, anticipo, pagado, por cobrar) y no ejecuta fórmulas; "Cobrado" y "Por cobrar" se mueven $1,000 | e2e | ✅ |
| RP-E1 | | vacío y celular | Un mes sin taquizas; el reporte a 390 px; mes inválido en el CSV | "Sin taquizas este mes"; 0 px de desborde; axe; 400 | e2e | ✅ |
| RP-N1 | | permiso | Ayudante y alguien sin sesión | 403 y 401 en el CSV; el ayudante no entra al reporte | e2e | ✅ |

## Arreglos de `/replica-entrepreneur` (`replica/fixes.md`)

Todas en `e2e/fx-confianza.spec.ts`.

| caso | arreglo | tipo | pasos | esperado | auto | resultado |
| --- | --- | --- | --- | --- | --- | --- |
| FX1-H1 | La fecha no cambia sola | feliz | Llegar al paso 3 | "Revisa tu fecha" con día, año y hora; el botón final dice día y hora; "Cambiar" regresa al paso 1; axe | e2e | ✅ |
| FX1-E1 | | invitados de más | Límite de 100 invitados por día; elegir día con 40; subir a 150 | Aviso "ya no tiene lugar para 150 invitados" en vez de soltar la fecha callado | e2e | ✅ |
| FX3-H1 | Anticipo claro | feliz | Elegir pagar, pagar y abrir Mi taquiza; correo de confirmación | "Si cancelas a más tardar el {día}, te devolvemos $1,800" con la fecha correcta (evento menos 7 días) en S05, S07 y el correo | e2e | ✅ |
| FX3-E1 | | fuera de plazo | Agendar dentro de los 7 días | Antes de pagar: "el anticipo ya no se devuelve" | e2e | ✅ |
| FX2-H1 | Motivo al cancelar | negativo y feliz | Rechazar sin motivo; usar una sugerencia | No deja sin motivo; el cliente ve "Motivo: …" en su enlace y en el correo | e2e | ✅ |
| FX2-H2 | | feliz | El dueño cancela una confirmada | Pide motivo; el cliente ve "Tuvimos que cancelar tu taquiza" con el motivo | e2e | ✅ |
| FX4-H1 | Avisa a tus invitados | feliz | Confirmada → Mandar por WhatsApp y Copiar texto | Fecha, hora, dirección y mapa; **nunca** el enlace privado; lo copiado es igual al mensaje; axe | e2e | ✅ |
| FX4-E1 | | sin confirmar | Solicitud pendiente | No aparece la invitación | e2e | ✅ |
| FX5-H1 | Recupera tu enlace | feliz y privacidad | Desde "Este enlace no funciona"; número inválido; número con correo; número que no existe | Le llega su enlace y funciona; la respuesta es igual para un número que no existe; axe | e2e | ✅ |
| FX5-N1 | | abuso | 4 intentos con el mismo número | El 4.º se frena | e2e | ✅ |
| FX6-H1 | Comparte tu página | feliz | Menú → Compartir; descargar QR; copiar un texto; celular | Enlace, QR en SVG para descargar, textos con la ciudad y el enlace; 0 px de desborde; axe | e2e | ✅ |
| FX6-N1 | | sin sesión | QR y página sin sesión | 401 y a la página de entrar | e2e | ✅ |

## Tercera ronda: la marca y los bordes de las pantallas nuevas

Todas en `e2e/ronda3.spec.ts`.

| caso | qué | tipo | pasos | esperado | auto | resultado |
| --- | --- | --- | --- | --- | --- | --- |
| R3-B1 | Marca | feliz | Abrir la portada; pedir el favicon, el ícono de iPhone y la imagen para compartir | Los tres responden 200 con su tipo; están en el `<head>` con su texto alternativo | e2e | ✅ |
| R3-B2 | Voz | feliz | Portada y confirmación de una taquiza pagada | Se ve la promesa; no aparece "Te esperamos" | e2e | ✅ |
| R3-B3 | Nombre de 60 caracteres | texto muy largo | Nombre de negocio de 60 caracteres; portada y agendar a 390 px; imagen para compartir | 0 px de desborde; la imagen sale y su aro sigue redondo | e2e | ✅ (tras BUG-009) |
| R3-E1 | Reembolso parcial | doble clic | Doble clic en "Reembolsar" con $300 | Un solo reembolso; "Pagado: $1,500" | e2e | ✅ |
| R3-E2 | Recuperar enlace | solo teclado, celular | A 390 px, llegar al campo con Tab, escribir y enviar con Enter; axe | Funciona; 0 px de desborde; sin violaciones | e2e | ✅ |
| R3-E3 | | sin conexión | Enviar sin red; volver a enviar con red | Mensaje de conexión, el número se queda escrito, luego funciona | e2e | ✅ |
| R3-E4 | Equipo | sesión vencida | Borrar la cookie y dar acceso | "Tu sesión terminó"; no se agrega ni se manda correo | e2e | ✅ |
| R3-E5 | Correos | acentos y emoji | Agendar como "Ñoño Gutiérrez 🌮" con correo | El correo dice "Hola, Ñoño." | e2e | ✅ |
| R3-N1 | Permisos | ayudante | El ayudante abre Compartir, Reportes y Equipo | Entra a Compartir; Reportes y Equipo lo regresan con aviso | e2e | ✅ |

**Arreglo en las pruebas (no en la app):**
- **El problema:** F11-E1 cerraba todas las sesiones del ayudante de prueba, así que las pruebas
  que venían después tenían que volver a entrar. Con tantas entradas se llegaba al límite de 5
  enlaces por hora (que funciona como debe).
- **El arreglo:** F11-E1 ahora crea su propio ayudante desde Equipo. Las demás pruebas usan la
  sesión guardada del ayudante.

## Portada de lanzamiento (`e2e/landing.spec.ts`)

| caso | qué | tipo | pasos | esperado | auto | resultado |
| --- | --- | --- | --- | --- | --- | --- |
| L-H1 | Portada | feliz | Abrir la portada; abrir preguntas con clic y con Enter; llamada final | 5 promesas; respuestas con los ajustes reales; sin frases de prueba inventada; axe; la llamada final lleva a agendar | e2e | ✅ |
| L-H2 | | ajustes | El dueño cambia el plazo de devolución a 10 días | La pregunta dice "al menos 10 días" | e2e | ✅ |
| L-E1 | | celular | Portada a 390 px | 0 px de desborde; axe | e2e | ✅ |

## Lista manual (no se puede automatizar aquí)

Para hacerla cuando el dueño tenga sus cuentas (ver `replica/backend.md`). Anota fecha, teléfono
y resultado.

- [ ] **Pago real de prueba en Mercado Pago:** con credenciales `TEST-` y una tarjeta de prueba
  aprobada y otra rechazada. El webhook debe llegar a la URL pública (vista previa de Vercel).
- [ ] **Correo real:** el enlace de entrada, el aviso de solicitud y los correos al cliente (confirmación y
  recordatorio) llegan a la bandeja de entrada, no a spam. Responder a uno de cliente llega a tu correo.
- [ ] **CSV en Excel y Google Sheets:** los acentos y los montos se ven bien.
- [ ] **QR impreso:** escanearlo con la cámara de un Android y de un iPhone abre la página de agendar (con tu dominio, ya publicado).
- [ ] **"Mandar por WhatsApp" a tus invitados** en un celular: abre WhatsApp para elegir a quién mandarlo.
- [ ] **WhatsApp en el teléfono:** los botones abren la app con el mensaje y el número correctos (Android y iPhone).
- [ ] **Celular real de gama baja con red lenta (3G):**
  - Agendar completo.
  - Revisar lo de "escribir antes de que cargue" (`bugs.md`, por revisar).
- [ ] **Lector de pantalla:** VoiceOver en iPhone y TalkBack en Android recorren calendario, horarios y formulario.
- [ ] **Vista con letra grande** (200 % de zoom del sistema): nada se corta.
- [ ] **Fotos reales** de 5–10 MB tomadas con el celular: se reducen y se suben.
