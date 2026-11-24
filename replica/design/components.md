# Componentes: taquizas de D' Garden Tacos

Código en `src/components/ui/`. Se revisan todos en `/design` (con `npm run dev`; en
producción solo existe con `SHOW_DESIGN=1`). Capturas: `primitives-desktop.png` y
`primitives-mobile.png`. Contraste: `contrast.txt` (35 pares, 0 fallas AA).

## De dónde sale el sistema

- **Medición:** no hubo capturas de OpenTable. Su sitio bloqueó la lectura (ver
  `replica/recon.md`) y no se intentó saltar el bloqueo. Lo que se reconstruye de OpenTable son
  **patrones de interacción** documentados en el recon: botones de horario, selector de
  personas, calendario con estados, pasos, resumen y diálogo de confirmación. Ningún color,
  medida, ícono ni texto suyo.
- **Marca:** dorado `brand #f2bd6c` y negro `ink`, medidos del logo **de D' Garden Tacos** (la
  marca propia del cliente, no la del original). Hay que confirmarlos con el archivo
  original del logo.
- **Fuentes (libres, OFL):** Inter para texto y Bricolage Grotesque para títulos, instaladas
  con `@fontsource` (no dependen de Google Fonts en tiempo de ejecución).
- **Íconos:** Lucide (licencia ISC).
- **Logo:** pendiente. `SiteHeader` usa el nombre escrito y un círculo "DG" provisional.
  Cuando llegue el SVG o PNG del logo, se reemplaza ahí.
- **Fotos:** pendientes. Las capturas del video de YouTube son del canal, no del negocio, y no
  se usan.

## Reglas para todos

- Colores, tamaños, radios y sombras solo desde los tokens. `npm run tokens` regenera
  `tokens.css` y `tailwind.css`. La paleta por defecto de Tailwind está desactivada, así que
  `bg-red-500` no existe.
- Área táctil mínima de **44px** en todo lo que se toca con el dedo (botones `md`/`lg`, días,
  horarios, navegación).
- Texto de campos a **16px** (en iPhone no hace zoom al escribir).
- Foco visible: contorno de 2px `focus` en fondo claro y `brand` sobre fondo `ink`.
- El estado nunca va solo en el color: siempre lleva ícono, texto o tachado.
- `prefers-reduced-motion` apaga animaciones y transiciones.
- Idioma `es-MX`, dinero con `formatMXN`, horas en "hora del centro de México".

---

```
Button / ButtonLink                                     Button.tsx
  variants  primary (accent), secondary (borde), ghost, danger, whatsapp
  sizes     sm 36px (tablas del panel), md 44px, lg 52px
  states    default, hover, active, focus-visible (2px focus), disabled (50 %), loading
  tokens    bg accent · text on-accent · radius md · font sm/600
  a11y      <button type="button"> por defecto; loading = aria-busy, se bloquea y conserva la
            etiqueta; ButtonLink external abre en otra pestaña y lo dice en texto sr-only
  used on   todas; whatsapp en S06, S07, S12
```

```
TextField / PhoneField / TextareaField / SelectField    Field.tsx
  variants  texto, correo, número; teléfono con prefijo +52 fijo; área de texto; select nativo
  states    vacío, foco, lleno, error (borde danger + mensaje con ícono), deshabilitado,
            requerido (*), opcional ("(opcional)")
  tokens    bg surface · border border-input (3.97:1) · radius md · alto 44px · texto base 16px
  a11y      <label for>, aria-describedby enlaza ayuda y error, aria-invalid en error,
            required nativo; select nativo para que el celular abra su propio selector;
            teléfono con inputMode numeric y autocomplete tel-national
  used on   S04, S10, S13, S14, S15, S16, S17, S18
```

```
GuestStepper                                            GuestStepper.tsx
  variants  único; step configurable (5 por defecto), se puede escribir cualquier número
  states    normal, en mínimo (− deshabilitado), en máximo (+ deshabilitado), error
            (ej. "Este paquete es desde 30 invitados")
  tokens    border border-input · botones 44px · número base/600 tabular
  a11y      <label> en el input; botones con aria-label "Agregar 5 invitados" y aria-controls;
            al salir del campo se ajusta al rango
  used on   S01, S03, S08, S13
```

```
BookingCalendar                                         BookingCalendar.tsx (react-day-picker 9)
  variants  cliente (S03/S08); admin reusa el mismo con otros días
  states    por día: available, few (punto warning), full (tachado), blocked (fondo
            surface-muted), closed/out (texto muted, deshabilitado), selected (accent),
            today (anillo focus); el mes entero: loading (aria-busy)
  tokens    days 44px · radius md · bg surface · shadow card
  a11y      tabla de cuadrícula con flechas, Inicio/Fin y RePág/AvPág (de react-day-picker);
            cada día dice su estado en voz: "sábado 14 de diciembre, pocos lugares";
            leyenda visible debajo; locale es (semana empieza en lunes)
  datos     recibe { "yyyy-MM-dd": DayState } de GET /api/disponibilidad/mes
  used on   S03, S08, S11, S14
```

```
TimeSlots                                               TimeSlots.tsx
  variants  único; 3 columnas en celular y 4 en escritorio
  states    libre, seleccionado (accent), ocupado (tachado + "(ocupado)" para lector de
            pantalla, deshabilitado), sin horarios (mensaje)
  tokens    alto 44px · border border-input · radius md
  a11y      radios nativos dentro de <fieldset>/<legend>: flechas para moverse;
            aclara "Hora del centro de México"
  used on   S03, S08, S13
```

```
StepBar                                                 StepBar.tsx
  variants  3 pasos (Fecha y hora · Datos del evento · Pago)
  states    pendiente, actual (accent), completado (ink + palomita)
  a11y      <nav aria-label> + <ol>; aria-current="step"; "(completado)" para lector de
            pantalla; en celular solo se muestra el nombre del paso actual
  used on   S03, S04, S05
```

```
PackageCard                                             PackageCard.tsx
  variants  full (foto, descripción, incluye), compact; selectable (radio)
  states    normal, seleccionada (borde y anillo accent + palomita), inactiva
            (fondo surface-muted + "No disponible por ahora"), sin foto (ícono)
  tokens    bg surface · radius lg · shadow card · precio xl/700
  a11y      selectable es un radio nativo con su <label>; la marca de selección es
            decorativa (aria-hidden); "Incluye" es una lista con nombre
  used on   S01, S02, S04, S15
```

```
PriceSummary                                            PriceSummary.tsx
  variants  estimado (antes de confirmar) o final; con o sin anticipo, traslado y complementos
  tokens    bg surface · border · anticipo en accent-subtle
  a11y      <dl> con <dt>/<dd>; cifras tabulares
  used on   S05, S06, S07, S12
```

```
PaymentChoice                                           PaymentChoice.tsx
  variants  depositMode optional (dos opciones) o required (solo "pagar ahora")
  states    "Pagar anticipo ahora" / "Agendar sin pagar en línea"
  nota      el formulario de tarjeta NO es nuestro: Mercado Pago Checkout Pro lo muestra
            en su página. Aquí solo se elige y se explica qué pasa.
  a11y      radios nativos en <fieldset>; aviso de pago seguro en texto
  used on   S05, S07
```

```
StatusBadge                                             StatusBadge.tsx
  variants  los 10 estados de bookings.status: solicitada, pendiente de pago, confirmada,
            otra fecha propuesta, rechazada, cancelada (cliente/negocio), completada,
            no se realizó, vencida
  tokens    warning/success/accent/danger/neutral sobre su fondo -subtle (todos ≥ 5.3:1)
  a11y      ícono + texto: nunca solo color
  used on   S06, S07, S11, S12
```

```
BookingCard                                             BookingCard.tsx
  variants  agenda (S11), historial del cliente (S18)
  states    normal, pendiente (barra izquierda accent), pasada (fondo surface-muted),
            requiere atención (texto danger con ícono)
  a11y      toda la tarjeta es un solo enlace al detalle (S12)
  used on   S11, S18
```

```
Modal / ConfirmDialog                                   Modal.tsx (Radix Dialog)
  variants  normal; confirmación (primary o danger)
  states    abierto, enviando (botón loading, no se cierra a medias)
  layout    hoja desde abajo en celular; centrado en escritorio (máx. 448px)
  a11y      foco atrapado, Escape cierra, el foco vuelve al botón que lo abrió
            (probado: abre en "Cerrar" y regresa a "Cancelar taquiza"); título y
            descripción enlazados
  used on   S07 (cancelar), S12 (rechazar, proponer, reembolsar, cancelar)
```

```
Toast                                                   Toast.tsx (sonner)
  variants  success, error, warning, info (barra izquierda del color del tono)
  a11y      región aria-live de sonner; botón de cerrar; arriba al centro
  used on   todas las acciones del panel
```

```
Alert                                                   Feedback.tsx
  variants  info, warning, danger, success
  a11y      danger = role="alert" (se anuncia de inmediato); los demás role="status"
  used on   S03 (horario ocupado), S04 (fuera de zona), S05, S06, S07, S12
```

```
EmptyState                                              Feedback.tsx
  variants  con o sin acción
  used on   S01 (sin paquetes), S11 (sin taquizas), S15, S16, S18
```

```
AdminNav                                                AdminNav.tsx
  variants  barra lateral 240px (≥ md) · barra inferior fija con 5 accesos (celular)
  states    activo (brand), normal, hover, foco (contorno brand sobre ink)
  a11y      <nav aria-label="Panel">, aria-current="page", respeta safe-area del iPhone
  used on   S11 a S18
```

```
SiteHeader                                              SiteHeader.tsx
  variants  único; sticky, fondo ink
  states    en celular el botón dice "Agendar" (el lector de pantalla oye "Agendar taquiza")
  pendiente logo real del negocio
  used on   S01, S02, S03 a S09
```

```
Gallery                                                 Misc.tsx
  variants  con fotos, sin fotos ("Foto pendiente")
  a11y      lista con nombre; el contenedor se enfoca para desplazarlo con teclado;
            scroll-snap nativo
  used on   S01
```

```
MapLink                                                 Misc.tsx
  a11y      abre Google Maps (Maps URLs oficial) en otra pestaña y lo dice; 44px de alto
  used on   S04, S12
```

```
StarsDisplay / StarsInput                               Misc.tsx
  a11y      Display es role="img" con "4.6 de 5 estrellas"; Input son radios nativos
            ("1 estrella" … "5 estrellas") con flechas
  used on   S01, S19
```

```
Timeline                                                Misc.tsx
  a11y      <ol aria-label="Historial">, lo más reciente arriba
  used on   S07, S12
```

## Verificación

- `npm run contrast`: 35 pares, 0 fallas AA (`contrast.txt`).
- axe-core 4 sobre `/design` (WCAG 2.0, 2.1 y 2.2 A/AA, más buenas prácticas), en escritorio
  1280px y en celular 390px: **0 violaciones**. Las primeras pasadas encontraron tres, ya
  corregidas:
  - Opacidad que bajaba el contraste del texto.
  - Galería sin acceso por teclado.
  - Dos `nav` con el mismo nombre.
- Consola del navegador sin errores.
- Diálogo: el foco entra y regresa correctamente.
- `next build` y `tsc --noEmit` pasan.
