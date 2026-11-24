# Plan de pruebas: taquizas de D' Garden Tacos

Build: `da63f7c` y siguientes. Fecha: 2026-11-24.
Entorno: local; la app en `next dev` y una imitación de Mercado Pago y Resend (`e2e/mocks/providers.mjs`).

| corrida | datos | resultado |
| --- | --- | --- |
| Primera | memoria | 44 pasaron, 9 fallaron, 2 se saltaron. Las 9 fallas: 7 bugs reales (`bugs.md`) y 2 pruebas mal escritas |
| Final | memoria | **53 pasaron, 0 fallaron**, 2 se saltaron (solo Postgres) |
| Final | Postgres 16 | **55 pasaron, 0 fallaron** |

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
| F05-H1 | Cambiar o cancelar | feliz | Cambiar fecha y +5 invitados | Nueva fecha, 45 invitados, en el historial | e2e | ✅ |
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

## Lista manual (no se puede automatizar aquí)

Para hacerla cuando el dueño tenga sus cuentas (ver `replica/backend.md`). Anota fecha, teléfono
y resultado.

- [ ] **Pago real de prueba en Mercado Pago:** con credenciales `TEST-` y una tarjeta de prueba
  aprobada y otra rechazada. El webhook debe llegar a la URL pública (vista previa de Vercel).
- [ ] **Correo real:** el enlace de entrada y el aviso de solicitud llegan a la bandeja de entrada, no a spam.
- [ ] **WhatsApp en el teléfono:** los botones abren la app con el mensaje y el número correctos (Android y iPhone).
- [ ] **Celular real de gama baja con red lenta (3G):**
  - Agendar completo.
  - Revisar lo de "escribir antes de que cargue" (`bugs.md`, por revisar).
- [ ] **Lector de pantalla:** VoiceOver en iPhone y TalkBack en Android recorren calendario, horarios y formulario.
- [ ] **Vista con letra grande** (200 % de zoom del sistema): nada se corta.
- [ ] **Fotos reales** de 5–10 MB tomadas con el celular: se reducen y se suben.
