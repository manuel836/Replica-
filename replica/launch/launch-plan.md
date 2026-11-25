# Plan de lanzamiento: D' Garden Tacos agenda en línea

Es un negocio local, así que los primeros clientes no llegan por internet en general: llegan por
tu gente, tu puesto, tu Facebook y tu WhatsApp.

## 0. Antes de abrir (bloquea el lanzamiento)

- [ ] **Tus datos reales en el panel:**
  - paquetes con precio y mínimo (Paquetes);
  - zonas y traslado (Zonas);
  - días, horas y cuántas taquizas por día (Disponibilidad);
  - anticipo y días para devolverlo, WhatsApp y correo de avisos (Ajustes).
- [ ] **Tus fotos:** la plancha, los tacos y el equipo trabajando (Ajustes → Fotos). Sin fotos
  la portada no convence.
- [ ] **La descripción del negocio** en Ajustes. Hoy dice "Texto de ejemplo".
- [ ] **El logo real** (brief en `replica/brand.md`).
- [ ] **El dominio**, por ejemplo `dgardentacos.com`. Ver `replica/brand.md`.
- [ ] **Las cuentas y llaves** de Mercado Pago, Resend y Supabase, y publicar
  (`/replica-deploy`).
- [ ] **La lista manual** de `replica/test-plan.md` con tu celular:
  - un pago real de prueba;
  - que lleguen los correos;
  - que WhatsApp abra bien;
  - que el QR impreso abra la página.

## 1. Prueba con 10 personas conocidas (antes de anunciar)

Las primeras 10 son gente que ya te conoce y que tiene un evento próximo: clientes anteriores,
familia, amigos. Pídeles que agenden **con el sistema**, no por mensaje, mientras tú miras el
panel. Después pregunta tres cosas, por WhatsApp o en persona:

1. ¿Hubo algo que no entendiste o que te hizo dudar?
2. ¿Te quedó claro cuánto ibas a pagar y hasta cuándo podías cancelar?
3. ¿Le mandaste la invitación a tus invitados con el botón? ¿Cómo les llegó?

Anota las respuestas. Lo que se repita dos veces se arregla antes de anunciar (`/replica-build`).

## 2. Dónde avisar

No hace falta Product Hunt ni Hacker News: tus clientes están en Lázaro Cárdenas.

| dónde | qué | listo en el sistema |
| --- | --- | --- |
| Tu página de Facebook | Una publicación que empiece por la promesa, más el enlace | Panel → **Compartir**: texto "Publicación para Facebook o Instagram" |
| Tu estado de WhatsApp y tus listas de difusión | El mensaje corto con el enlace | Panel → **Compartir**: "Mensaje o estado de WhatsApp" |
| Instagram | La bio con el enlace | `listing.json` → `instagram_bio` |
| Google (Perfil de Negocio) | Abrir o actualizar tu perfil con la descripción, el sitio y fotos. Así apareces al buscar "taquiza Lázaro Cárdenas" | `listing.json` → `google_business_profile` |
| **El puesto, el carrito y las playeras** | El **QR** impreso: quien te ve trabajando en una fiesta agenda la suya | Panel → **Compartir** → "Descargar QR" |
| Grupos de Facebook de la ciudad (eventos, compra-venta) | Una publicación cuando ya tengas fotos y precios reales | El mismo texto; respeta las reglas de cada grupo |
| Salones de fiestas, inflables, renta de mobiliario | Que tengan tu QR o tu enlace para sus clientes | El QR |
| El canal de YouTube que ya te grabó ("PACKO RAMIREZ MICH-MEX") | Pedirles, si quieren, que mencionen que ya se agenda en línea | — |

**El mensaje lleva la promesa por delante**, nunca "somos los mejores":

> 🌮 ¿Tienes fiesta? Llevamos la plancha a tu evento en Lázaro Cárdenas.
> Ves los días libres, eliges tu paquete y te confirmamos nosotros mismos por WhatsApp.
> Antes de pagar sabes hasta qué día te devolvemos el anticipo.
> Agenda aquí: {tu enlace}

## 3. Reseñas (de verdad)

- El sistema le pide la reseña al cliente **después** de la taquiza (cuando la marcas
  "Completada") por correo, y tú puedes mandarla por WhatsApp. Tú decides cuáles se publican.
- **Nunca** reseñas inventadas, ni tuyas ni de familiares haciéndose pasar por clientes, ni contra
  la competencia. Puede contar como publicidad engañosa ante la Profeco, y en EE. UU. la FTC lo
  prohíbe expresamente desde 2024.
- Las reseñas de OpenTable que se leyeron son investigación: no se publican.

## 4. Medir el primer mes

Sin instalar nada más, el panel ya te da:
- **Reportes:** taquizas, vendido, cobrado y por cobrar del mes, contra el mes anterior.
- **Agenda:** solicitudes "por responder". Respóndelas el mismo día: es la promesa.
- **Correo de resumen diario:** mañana y pendientes.
- **Ajustes:** correos que no salieron.

Cuatro números para ver cada semana:
1. Solicitudes nuevas por semana.
2. Cuántas confirmas y en cuánto tiempo respondes.
3. Cuántas pagan anticipo en línea y cuántas apartan sin pagar.
4. Cancelaciones, con sus motivos.

**Analítica y avisos de errores:** el sistema no trae ninguna herramienta para contar visitas ni
para avisar de errores. Si quieres agregarlas (por ejemplo la analítica de Vercel o Sentry), se
hace en `/replica-deploy`. Cada herramienta que agregues va en el aviso de privacidad, porque
también procesa datos.

## 5. Después de lanzar

- **A las 2 semanas:** repasa las respuestas de las 10 personas y los motivos de cancelación.
- **Lo que falta por construir:**
  - proponer otra fecha para una taquiza ya confirmada (FX2, parcial);
  - WhatsApp automático, cuando el volumen pague la API de WhatsApp Business.
- **Si algún día vendes el sistema a otros taqueros,** entonces sí aplica la parte de planes,
  precios por suscripción y tiendas de apps. Ese producto necesitaría su propio nombre
  (`replica/brand.md`).
