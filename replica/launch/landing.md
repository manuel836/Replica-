# Página de lanzamiento: la portada de D' Garden Tacos

La página de lanzamiento es la portada del sistema (`/`, archivo `src/app/(public)/page.tsx`), y
ya está construida (commit `7d1586d`). Aquí va sección por sección con su texto y de dónde sale.
Voz: cercana, clara y cumplida (`replica/brand.md`).

Revisada:
- Pruebas `e2e/landing.spec.ts`, a 1440 y 390 px: sin desborde y axe sin violaciones.
- Contraste de la paleta: 35 pares, 0 fallan AA (`contrast.py`).
- Capturas: `replica/clone-screens/S01-1440.png` y `S01.png`.

## 1. Arriba (hero)

- **Antetítulo:** "Taquizas · Lázaro Cárdenas, Michoacán"
- **Título:** "La plancha de D' Garden Tacos en tu fiesta"
- **Descripción:** la del negocio, que cambias en Ajustes. Hoy es un texto de ejemplo.
- **La promesa (el ángulo):** "Tú eliges el día. Te confirma por WhatsApp el mismo equipo que
  llega a servir."
- **Un botón:** "¿Cuántos invitados?" + "Ver fechas disponibles", que lleva al calendario.
- **El producto real:** aquí van **tus fotos** de la plancha y del equipo trabajando (Ajustes →
  Fotos). Hoy se ven cuadros de "Foto pendiente". Sin fotos reales la página no convence: es lo
  primero que hay que subir.

## 2. El problema

Dentro de "Lo que te prometemos", en una frase, con las dos quejas que más pesan en la
investigación (`replica/fixes.md`), dichas con nuestras palabras y sin citar a nadie:

> "Organizar una fiesta ya es bastante. Lo último que quieres es llegar la hora y que nadie tenga
> tu fecha, o no saber si te devuelven el anticipo."

## 3. Cómo funciona ("Así de fácil")

1. **Elige fecha y hora:** "Ves en el calendario qué días tenemos libres."
2. **Cuéntanos de tu evento:** "Paquete, invitados y dirección. Sin crear cuenta."
3. **Te confirmamos y llegamos:** "Nosotros mismos te confirmamos por WhatsApp. El día del evento
   llegamos con la plancha."

## 4. Lo que te prometemos (los arreglos, no el catálogo)

Cada punto es un arreglo de `replica/fixes.md`. Funciones como el calendario o los paquetes no
se presumen: son lo mínimo.

| promesa | arreglo |
| --- | --- |
| **Te confirma quien va a servir.** No un sistema ni un centro de llamadas: el mismo equipo que llega con la plancha. Si algo cambia, te avisamos al momento y te decimos por qué. | El ángulo y FX2 |
| **La fecha que eliges es la que queda.** Antes de enviar ves el día, el año y la hora. Si algo deja de estar libre mientras agendas, te lo decimos; nunca la cambiamos por ti. | FX1 |
| **Anticipo sin letras chiquitas.** Antes de pagar ves hasta qué día te devolvemos el anticipo completo, con fecha y monto. Y si prefieres, apartas sin pagar en línea. | FX3 |
| **Sin cuenta, sin contraseña, sin códigos.** Agendas con tu nombre y tu WhatsApp. Tu taquiza vive en un enlace; si lo pierdes, te lo volvemos a mandar. | FX5 |
| **Avisa a tus invitados con un toque.** Cuando está confirmada, mandas por WhatsApp la fecha, la hora y cómo llegar. | FX4 |

## 5. Precios

Los paquetes con su precio por persona y su mínimo de invitados, que capturas en Paquetes.
Debajo van las zonas con su costo de traslado. Antes de agendar, el cliente ve el total estimado
y el anticipo. Hoy los paquetes son de ejemplo: **pon los tuyos antes de lanzar**. Cómo
presentarlos, en `pricing.md`.

## 6. Preguntas frecuentes

Las respuestas **salen de tus ajustes**, así que si cambias algo en Ajustes la página cambia
sola (prueba L-H2):

- **¿Tengo que crear una cuenta?** No, tu nombre y tu WhatsApp.
- **¿Tengo que pagar en línea?** Depende de tu anticipo: ninguno, opcional u obligatorio, con su
  porcentaje o monto.
- **¿Hasta cuándo me devuelven el anticipo si cancelo?** Con tus días de plazo; antes de pagar se
  ve la fecha exacta.
- **¿Puedo cambiar la fecha o los invitados?** Sí, desde su enlace, si hay lugar.
- **¿Con cuánta anticipación tengo que agendar?** Tus días mínimos y máximos.
- **¿Llegan a mi colonia?** Tus zonas.

No se incluyen preguntas cuya respuesta no esté en el sistema, como qué pasa si llueve o si
llevas mesas. Si quieres agregarlas, dime la respuesta y van a "Políticas y preguntas".

## 7. Llamada final

"¿Ya tienes fecha?" · "Ve los días libres, elige tu paquete y aparta en un par de minutos." ·
botones "Ver fechas disponibles" y "Preguntar por WhatsApp" (este aparece cuando captures tu
número).

## Lo que **no** tiene, a propósito

- **Testimonios inventados, "miles de clientes", estrellas o logos de prensa:** no hay. La prueba
  L-H1 revisa que no aparezcan frases así.
- **Reseñas:** la sección "Lo que dicen nuestros clientes" solo aparece con reseñas **reales** de
  tus clientes, que tú publicas desde el panel. Hoy no hay ninguna, y está bien así.
- **El video del canal "PACKO RAMIREZ MICH-MEX":** sería una prueba real, pero solo con el
  permiso del canal. Si te lo da, se puede poner el enlace en la portada.
- **Reseñas de OpenTable:** son investigación, nunca testimonios.
