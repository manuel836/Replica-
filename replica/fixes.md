# Qué odian los usuarios de OpenTable y qué hacemos distinto

Fecha: 2026-11-25. Datos: `replica/reviews.csv`; ranking: `replica/feedback.md`
(`reviews.py` con los temas de `replica/themes.json`).

## La muestra

**1,061 reseñas reales de 3 fuentes** (después de quitar 3 repetidas):

| fuente | cuántas | de cuándo | cómo se leyó |
| --- | --- | --- | --- |
| App Store México | 500 | 2018-08 a 2026-11 | Feed oficial de reseñas de Apple (RSS), las 10 páginas que da |
| App Store Estados Unidos | 500 | 2026-09 a 2026-11 | El mismo feed oficial |
| Trustpilot | 35 | 2025-12 a 2026-11 | Página pública leída como persona. **Solo extractos de hasta 125 caracteres** (marcados `[truncated]`); el texto completo está en cada enlace. Trustpilot dice 268 reseñas y calificación 1.6 |
| Hacker News | 29 | 2015 a 2024 | API oficial de búsqueda (Algolia); solo comentarios con opinión sobre OpenTable, elegidos a mano |

1,032 traen estrellas: 144 de la App Store tienen 3 o menos y **se leyeron todas a mano**. Las de
Hacker News hablan sobre todo del lado del restaurante.

Lo que **no** se pudo o no se intentó, dicho claro:
- **Reddit:** la herramienta de lectura se niega a abrir reddit.com; no se intentó saltarlo.
- **Google Play:** en la recon la página salió cortada y no dio reseñas.
- **G2, Capterra, tablero de ideas de OpenTable y su changelog:** no se intentaron.

**Límite de la evidencia.** Quienes reseñan OpenTable reservan mesa en un restaurante; tus
clientes contratan una taquiza a domicilio. Los problemas de confianza, cobros y avisos sí se
parecen. Aun así, conviene confirmarlo preguntándole a 5 o 10 clientes reales de D' Garden Tacos.

Los enlaces de la App Store llevan a la página de reseñas de la app. Apple no da un enlace por
reseña, así que cada cita trae el número de la reseña (columna `review_id` del CSV).

---

## 1. Lo que odian (lo que la app hace mal)

Ordenado por peso: cuentan más las reseñas de 1 estrella y las recientes. "Delgado" quiere decir
menos de 3 reseñas o una sola fuente.

### 1.1 La reservación "confirmada" no existe, no la respetan o la cancelan sin avisar
**31 reseñas, 2 fuentes** (App Store México y EE. UU., Trustpilot). Promedio: 2.0 estrellas. Es
el tema principal.

- «Ambas aparecían como confirmadas pero ninguna estaba registrada en el restaurante.» — App Store MX, 1★, 2023-12-18, reseña 10712178927, [ver](https://apps.apple.com/mx/app/opentable/id296581815?see-all=reviews)
- «Cancelan sin dar explicaciones y los números no los contestan» — App Store MX, 1★, 2026-06-30, reseña 14246589322, [ver](https://apps.apple.com/mx/app/opentable/id296581815?see-all=reviews)
- «They will say that a place has “confirmed” your reservations even if the place has been closed for w year.» — App Store US, 1★, 2026-09-12, reseña 14542585867, [ver](https://apps.apple.com/us/app/opentable/id296581815?see-all=reviews)
- «NOT TO BE TRUSTED. turned up at the restaurant to find it closed. No email ahead no phone call nothing,» — Trustpilot, 1★, 2026-02-23, [ver](https://www.trustpilot.com/reviews/69a03a416c2317060371676b)

### 1.2 Puntos y recompensas que no se pueden usar
**37 reseñas, 3 fuentes.** Promedio: 3.3 estrellas.
- «Dining Points Unusable» — App Store US, 1★, 2026-11-11, reseña 14778120684, [ver](https://apps.apple.com/us/app/opentable/id296581815?see-all=reviews)
- «Can never use rewards. They have not learned how to give a digital card for rewards. This is ridiculous!» — Trustpilot, 1★, 2026-03-18, [ver](https://www.trustpilot.com/reviews/69bbf147ef20110cbdb6748d)

**Para ti: no copiar.** Un programa de puntos que no se puede cobrar genera más enojo que lealtad.
Tu sistema no tiene puntos, y así debe seguir.

### 1.3 Fallas y la app que se traba *(delgado: una sola fuente)*
**35 reseñas, solo App Store.** El sistema de taquizas es una página web, sin app que instalar, y
tiene 71 pruebas automáticas. No hace falta un arreglo aparte.

### 1.4 Demasiados avisos, confirmaciones y peticiones de reseña
**28 reseñas, 3 fuentes.**
- «Para que siempre piden confirmar la reserva en varias ocasiones entonces cuál es el propósito de esta aplicación» — App Store MX, 3★, 2026-03-26, reseña 13889253711, [ver](https://apps.apple.com/mx/app/opentable/id296581815?see-all=reviews)
- «I just don’t need this many notifications for a reservation that is still weeks away. Stop spamming.» — App Store US, 3★, 2026-10-20, reseña 14689565229, [ver](https://apps.apple.com/us/app/opentable/id296581815?see-all=reviews)
- «Our reservation was canceled for no reason. Open Table asked 10 times to confirm.» — App Store US, 1★, 2026-10-18, reseña 14681732890, [ver](https://apps.apple.com/us/app/opentable/id296581815?see-all=reviews)

**Para ti: ya está bien; hay que cuidarlo.** El cliente recibe un aviso por cada cambio real, un
solo recordatorio y una sola petición de reseña, aunque el job corra dos veces. No agregar "¿sigues
viniendo?".

### 1.5 Cargos, depósitos y tarjeta retenida
**21 reseñas, 3 fuentes.** Promedio: 1.5 estrellas.
- «You should be able to make a reservation without a credit card.» — App Store US, 1★, 2026-11-22, reseña 14821086131, [ver](https://apps.apple.com/us/app/opentable/id296581815?see-all=reviews)
- «en algunos establecimientos te hace un cargo por reservar y te lo devuelve hasta que quiere» — App Store MX, 1★, 2026-07-29, reseña 14364989500, [ver](https://apps.apple.com/mx/app/opentable/id296581815?see-all=reviews)
- «Quiero cancelar una reservación, y nadie me contesta, y no sé si me va a cobrar la reservación.» — App Store MX, 1★, 2025-11-22, reseña 13428789905, [ver](https://apps.apple.com/mx/app/opentable/id296581815?see-all=reviews)

### 1.6 Soporte que no contesta
**14 reseñas, 2 fuentes.**
- «No option to call an agent. Two-day email support for reservations costing hundreds of dollars is inexcusable.» — App Store US, 1★, 2026-11-09, reseña 14771937490, [ver](https://apps.apple.com/us/app/opentable/id296581815?see-all=reviews)

**Para ti: ventaja natural.** El soporte eres tú, por WhatsApp. El botón para escribirte aparece
en la página, en la confirmación y en "Mi taquiza" en cuanto capturas tu número en Ajustes.

### 1.7 Cuenta y códigos de verificación que no sirven
**19 reseñas, 2 fuentes.** La mayoría vienen de México. Promedio: 1.6 estrellas.
- «Llegan los códigos pero no los acepta y nunca puedo ingresar.» — App Store MX, 1★, 2024-01-29, reseña 10878124636, [ver](https://apps.apple.com/mx/app/opentable/id296581815?see-all=reviews)
- «Si quieres revisar tus reservaciones en la web o en un nuevo dispositivo, no será posible porque el código que te envían NUNCA funciona.» — App Store MX, 1★, 2024-11-13, reseña 11947016434, [ver](https://apps.apple.com/mx/app/opentable/id296581815?see-all=reviews)
- «What a bother to have a triple authentication. It’s better to call the restaurant directly.» — App Store US, 1★, 2026-11-04, reseña 14751136883, [ver](https://apps.apple.com/us/app/opentable/id296581815?see-all=reviews)

**Para ti: ya resuelto.** Tus clientes no tienen cuenta ni códigos: su taquiza vive en un enlace
que abre en cualquier celular. Lo que falta: recuperar ese enlace si lo pierden (arreglo 5).

### 1.8 Cambia la fecha, la hora o las personas sin avisar
**8 reseñas, 2 fuentes.** Promedio: 1.5 estrellas.
- «This app will automatically change days and times without letting you know.» — App Store US, 1★, 2026-11-12, reseña 14782763627, [ver](https://apps.apple.com/us/app/opentable/id296581815?see-all=reviews)
- «Escogí la hora y me la cambia y no deja hacer la corrección» — App Store MX, 2★, 2025-03-07, reseña 12394243132, [ver](https://apps.apple.com/mx/app/opentable/id296581815?see-all=reviews)
- «Open table changed dates without notification» (título) — Trustpilot, 1★, 2026-07-28, [ver](https://www.trustpilot.com/reviews/6a6a104cf1d764099798574d)

### 1.9 Lo que paga el restaurante: por comensal y comisiones
**11 reseñas, 3 fuentes.** Es el lado del negocio.
- «our favorite restaurant told us Open Table charges $5/head (to the restaurant).» — Hacker News, 2020-05-24, [ver](https://news.ycombinator.com/item?id=23291794)
- «OpenTable is not worth the expense if you do not have a Standalone, High-Table-Turn restaurant.» — Trustpilot, 1★, 2026-11-16, [ver](https://www.trustpilot.com/reviews/6afb711d30027c757c053206)

### 1.10 El negocio no es dueño de sus clientes *(delgado: 5 comentarios, solo Hacker News)*
- «not sure why OpenTable believes they own this information.» — Hacker News, 2019-03-18, [ver](https://news.ycombinator.com/item?id=19421617)

---

## 2. Lo que falta (lo que piden por nombre)

### 2.1 Compartir la reservación por WhatsApp *(delgado: 2 reseñas que lo piden por nombre, App Store MX)*
El tema "compartir" junta 7 reseñas de 2 fuentes, pero solo 2 piden WhatsApp con esas palabras.
- «no te deja compartir las reservaciones por WhatsApp» — App Store MX, 4★, 2022-07-27, reseña 8918125467, [ver](https://apps.apple.com/mx/app/opentable/id296581815?see-all=reviews)
- «es malísima para compartir con otras personas la reservación o detalles de la misma» — App Store MX, 3★, 2019-11-21, reseña 5178825680, [ver](https://apps.apple.com/mx/app/opentable/id296581815?see-all=reviews)

Pocas reseñas, pero es justo el trabajo del anfitrión de una fiesta: avisarles a sus invitados.

### 2.2 Aceptar o reservar sin crear cuenta *(delgado: 1 reseña)*
- «I understand you may “need” phone or email to communicate about the reservation, but you shouldn’t need to create an account.» — App Store MX, 1★, 2026-01-10, reseña 13619665865, [ver](https://apps.apple.com/mx/app/opentable/id296581815?see-all=reviews)

**Ya resuelto en tu sistema.**

### 2.3 Ver las próximas reservaciones a la vista *(delgado: 2 reseñas)*
- «Please change it back to being able to see your upcoming reservations on the home page.» — App Store US, 2★, 2026-09-11, reseña 14539145559, [ver](https://apps.apple.com/us/app/opentable/id296581815?see-all=reviews)

En tu sistema la taquiza es el enlace mismo, y ahora también llega por correo.

### 2.4 Solicitudes especiales *(delgado: 1 reseña)*
- «No permite ingresar solicitudes especiales» — App Store MX, 2★, 2025-04-19, reseña 12564053470, [ver](https://apps.apple.com/mx/app/opentable/id296581815?see-all=reviews)

**Ya resuelto:** el paso 2 tiene notas (alergias, peticiones).

---

## 3. Lo que nadie resuelve

### 3.1 Eventos fuera del restaurante: taquizas, catering, fiestas en casa
**Sin evidencia directa en las reseñas**, y es normal: OpenTable es para mesas dentro de un local.
No hay a quién quejarse de algo que la app ni siquiera intenta. Este es tu nicho. La evidencia
tiene que venir de tus clientes, no de estas reseñas.

### 3.2 Negocios chicos que no quieren pagar por comensal ni regalar a sus clientes
**Comisiones (1.9): 11 reseñas en 3 fuentes. Encierro (1.10): delgado.** Tu sistema es tuyo:
- No hay comisión por invitado.
- La lista de clientes y el CSV son tuyos.
- Tu página no compite contigo en Google.

### 3.3 Gente en México que vive en WhatsApp y se pelea con los códigos
**Cuenta y códigos (1.7): 19 reseñas, casi todas de México. Compartir por WhatsApp (2.1): delgado.**
- En una de las quejas, el restaurante confirmó por WhatsApp y luego canceló sin avisar: «me enviaron un mensaje de whats app para confirmar» — App Store MX, 1★, 2026-02-14, reseña 13750452507, [ver](https://apps.apple.com/mx/app/opentable/id296581815?see-all=reviews).
- WhatsApp sirve, siempre que el estado de la taquiza sea verdad.

---

## 4. Plan de arreglos

**Estado (2026-11-25): los 6 están construidos y probados** (`e2e/fx-confianza.spec.ts`; commits
`7aa3e57`, `f8c9c5a`, `29a2085`, `e2e2f69`, `079c1e1` y `5a16592`). Del 2 falta una parte:
proponer otra fecha para una taquiza ya confirmada (ver `build-log.md`).

Elegidos por evidencia y por lo barato que salen. Tamaño: S = horas, M = un día. Cada uno quedó
como fila en `replica/features.csv` con `original = no` y `clone = no`.

| # | arreglo | qué se construye | tamaño | skill | evidencia |
| --- | --- | --- | --- | --- | --- |
| 1 | **Tu fecha no cambia sola** | El botón final dice la fecha y la hora ("Enviar solicitud para el sábado 14 de diciembre, 14:00"). La confirmación las repite en grande. Si el horario se ocupa mientras llenas el formulario, se dice con esas palabras y nunca se elige otro horario por ti | S | `/replica-build` | 1.8 (8 reseñas, 2 fuentes) y 1.1 (31 reseñas, 2 fuentes) |
| 2 | **Si cancelamos, sabes por qué al momento** | Al rechazar o cancelar, el motivo es obligatorio. "Mi taquiza" lo muestra, sale el correo y se abre el WhatsApp con el mensaje listo. En el mismo paso, opción de proponer otra fecha | S | `/replica-build` | 1.1: "Cancelan sin dar explicaciones" y 4 citas más |
| 3 | **Anticipo claro, con fecha y monto** | En el resumen (S05), en "Mi taquiza" (S07) y en el correo de confirmación: "Si cancelas antes del 7 de diciembre te devolvemos $1,800 a tu tarjeta (Mercado Pago tarda unos días)". Junto a la opción de pagar: "También puedes agendar sin pagar en línea" | S | `/replica-build` | 1.5 (21 reseñas, 3 fuentes) |
| 4 | **Comparte la invitación con tus invitados** | Botón "Avisar a mis invitados por WhatsApp" en la confirmación y en "Mi taquiza". Manda fecha, hora, dirección y mapa, nunca el enlace privado. Sin WhatsApp, copia el texto | S | `/replica-build` | 2.1 *(delgado)*; trabajo central del anfitrión |
| 5 | **Recupera tu enlace sin códigos** | "¿Perdiste el enlace de tu taquiza?": escribes tu WhatsApp. Si dejaste correo, te llegan tus enlaces. Si no, botón para pedírselo al negocio por WhatsApp. Con límite de intentos y la misma respuesta exista o no el número | M | `/replica-build` y `/replica-backend` | 1.7 (19 reseñas, 2 fuentes, sobre todo México) |
| 6 | **Tu página, tus clientes** | En el panel: tu enlace de agendar con código QR y texto listo para Facebook, Instagram y tu estado de WhatsApp. Así los pedidos llegan directo y sin comisión | S | `/replica-build`; el mensaje, en `/replica-launch` | 1.9 (11 reseñas, 3 fuentes) y 1.10 *(delgado)* |

Lo que **ya** hace el sistema y responde a estas quejas:
- No pide cuenta ni códigos (1.7, 2.2).
- Puedes agendar sin pagar en línea (1.5).
- WhatsApp directo con el negocio (1.6).
- Un solo recordatorio y una sola petición de reseña (1.4).
- Si cierras un día que ya tiene taquizas, el panel te las lista con su enlace (1.1).
- Notas para peticiones especiales (2.4).
- Si se interrumpe el formulario, al volver sigue donde iba (BUG-002/003).
- Correo en cada cambio de estado (1.1).
- Sin puntos (1.2).

Los cobros por comensal y las comisiones (1.9) van a `/replica-launch` si algún día vendes este
sistema a otros taqueros. Para D' Garden Tacos no aplica: el sistema es tuyo.

---

## 5. El ángulo

**A. Tu taquiza, confirmada por quien la va a servir**
> Para quien organiza una fiesta y no quiere llegar a la hora y descubrir que nadie lo esperaba,
> D' Garden Tacos confirma tu taquiza en persona, por WhatsApp, y si algo cambia te avisa al
> momento y con el motivo.
>
> Evidencia: "la reservación confirmada no existe o la cancelan sin avisar", 31 reseñas en 2
> fuentes, más "cambia la fecha sin avisar", 8 reseñas en 2 fuentes.

**B. Sin cuenta, sin contraseña, sin códigos**
> Para quien está harto de cuentas y códigos de verificación que nunca llegan, en D' Garden Tacos
> agendas con tu nombre y tu WhatsApp, y tu taquiza vive en un enlace que abre en cualquier
> celular.
>
> Evidencia: "cuenta y códigos que no sirven", 19 reseñas en 2 fuentes, la mayoría de México.

**C. Aparta sin dejar tu tarjeta en garantía**
> Para quien no quiere que le retengan dinero solo por apartar, en D' Garden Tacos apartas sin
> pagar en línea o con un anticipo que se devuelve completo hasta una fecha que ves antes de pagar.
>
> Evidencia: "cargos, depósitos y tarjeta retenida", 21 reseñas en 3 fuentes.

### Recomendación: A

- Es el tema con más evidencia de los que aplican a una taquiza.
- Es lo que más le duele a quien organiza una fiesta: que el día del evento no llegue nadie.
- Lo puede cumplir D' Garden Tacos y una plataforma no: quien confirma es el mismo taquero.

B y C van como pruebas, en una línea cada una, debajo de la promesa principal. Este ángulo guía
el nombre y la voz en `/replica-brand` y el encabezado de la página en `/replica-launch`.

**Reglas que se respetan:**
- El nombre de OpenTable no va en tu nombre, tus anuncios ni tu página.
- Estas reseñas son investigación: no son testimonios y no se publican.
- Una página que te compare con OpenTable es una pregunta para un abogado en México.
