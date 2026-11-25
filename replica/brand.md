# Marca: D' Garden Tacos

Fecha: 2026-11-25. Ángulo (de `replica/fixes.md`): **"Tu taquiza, confirmada por quien la va a
servir."**

## 1. El nombre: se queda D' Garden Tacos

Este sistema no es una app nueva que necesite nombre: es la página de agendar de un negocio que
ya existe, con su nombre, su logo y su clientela en Lázaro Cárdenas. Cambiarle el nombre sería
perder lo que ya tiene. El sistema sale con el nombre del negocio.

Contra los filtros del paso 1:

| filtro | resultado |
| --- | --- |
| ¿Se parece a OpenTable en sonido, forma o significado? | No. No comparte palabras, sonidos ni idea. No es un juego con su nombre |
| ¿Se parece a otras apps de reservas? | No es nombre de app sino de taquería. Falta buscar si otro negocio de comida usa un nombre parecido (ver abajo) |
| ¿Corto, se escribe tras oírlo una vez? | Casi. "D' Garden" con apóstrofo se dicta mal ("de garden", "di garden"). En el dominio y las redes conviene una forma sin apóstrofo: **dgardentacos** |
| ¿Ayuda al ángulo? | Sí: es el nombre del equipo que llega a servir, que es justo la promesa |

**Si algún día vendes el sistema a otros taqueros,** ese producto sí necesitaría su propio
nombre. Ahí se corre el paso 1 completo: 20 nombres, 5 finalistas y las revisiones.

### Revisiones del nombre (de cribado, no son un registro legal)

"Por hacer" = nadie lo ha revisado; no se debe suponer que está libre.

| revisión | dónde | resultado |
| --- | --- | --- |
| Marca en México (lo que importa) | IMPI, MARCia (marcia.impi.gob.mx), clase 43 (alimentos y catering) y 35 | **Por hacer** |
| Marca global | WIPO Global Brand Database | **Por hacer** |
| EE. UU., UE, Canadá | USPTO, EUIPO/TMview, ISED | No aplica mientras solo atiendas en México; **por hacer** si piensas en franquicias fuera |
| dgardentacos.com | RDAP oficial de Verisign | **No aparece registrado** (2026-11-25, respuesta 404) |
| dgarden-tacos.com | RDAP oficial de Verisign | **No aparece registrado** (2026-11-25) |
| taquizasdgarden.com | RDAP oficial de Verisign | **No aparece registrado** (2026-11-25) |
| dgardentacos.net | RDAP oficial de Verisign | **No aparece registrado** (2026-11-25) |
| dgardentacos.mx / .com.mx | registry.mx o tu registrador (el .mx no tiene RDAP público en IANA) | **Por hacer** |
| App Store y Google Play | — | No aplica: es página web |
| Facebook | — | Ya es tuya: "D' Garden Tacos \| Ciudad Lázaro Cárdenas" (vista en la recon, 2026-11-24) |
| Instagram, TikTok, X | buscar @dgardentacos | **Por hacer** |
| La web | buscar "D' Garden Tacos" y "Garden Tacos" taquiza | **Por hacer**: ver si otro negocio de comida usa un nombre parecido |

"No aparece registrado" no garantiza que puedas comprarlo: el dominio puede estar reservado o en
periodo de gracia. Lo confirma tu registrador al comprar. **Recomendación:**
- Compra ya `dgardentacos.com` y, si está libre, `dgardentacos.mx`.
- Antes de invertir en letreros o uniformes nuevos, pide a un abogado de marcas una búsqueda en
  el IMPI y, si conviene, el registro en la clase 43.

## 2. La paleta

Sale del logo del negocio: el negro y el dorado se midieron de la miniatura del video (ver
`replica/design/tokens.json`). OpenTable usa rojo; aquí no hay ningún rojo de marca.

| rol | color | uso |
| --- | --- | --- |
| `ink` | `#141110` | Fondo de la portada, el pie y el menú del panel (el negro del logo) |
| `brand` / `accent` | `#f2bd6c` | Dorado del logo: botón principal, aro del ícono |
| `on-ink` | `#fbf7f0` | Crema del logo: texto sobre negro |
| `bg` | `#fbf7f0` | Fondo de las páginas |
| `accent-text` | (en `tokens.json`) | Dorado oscuro para texto y enlaces sobre fondo claro, con buen contraste |

**Contraste:** `contrast.py` revisó 35 pares: **0 fallan AA** (2026-11-25).

Cuando tengas el archivo original del logo, mide de nuevo el negro y el dorado. Cambia los
valores en `tokens.json` (los nombres de los roles no se tocan), corre `npm run tokens` y luego
`npm run contrast`.

## 3. Brief del logo

Ya tienes logo: un escudo circular negro con "D' GARDEN" en arco y "TACOS" grande, en crema y
dorado. El trabajo no es inventar otro. Es preparar ese logo para pantallas chicas y grandes.

- **La idea en una línea:** el sello de la plancha que llega a tu fiesta.
- **Tipo:** escudo con texto (el actual) para lo grande, y un **monograma "DG"** o el símbolo
  de la plancha, sin texto en arco, para lo chico. A 16 px el texto en arco no se lee.
- **Debe funcionar** a 16 px (pestaña del navegador) y a 1024 px (ícono de celular).
- **Entregables:**
  - SVG del escudo completo y SVG del monograma.
  - Ícono de 1024 × 1024 **sin transparencia**: iOS la rellena de negro y se ve mal.
  - Favicon de 16, 32 y 48 px y ícono de iPhone de 180 px.
  - Imagen para compartir de 1200 × 630.
- **No debe parecerse al logo de OpenTable:** sin rojo y sin el círculo liso con un punto
  al centro. Pon los bocetos junto a su logo y compáralos antes de aprobar.
- **Mientras tanto:** el sistema usa íconos provisionales hechos aquí con los colores del logo:
  - círculo negro, aro dorado y "DG" en crema: `src/app/icon.svg` y `src/app/apple-icon.tsx`;
  - la imagen para compartir: `src/app/opengraph-image.tsx`.

  Cuando llegue el logo real, los PNG o SVG reemplazan esos archivos.

## 4. La voz

Cómo suena D' Garden Tacos por escrito: como el taquero que te atiende en el puesto, pero por
escrito.

| palabra | qué sí | qué no |
| --- | --- | --- |
| **Cercana** | Hablamos de tú, como en el puesto | No es confianzuda: sin apodos, sin chistes forzados, sin "¡hey, amigo!" |
| **Clara** | Fecha, hora y monto exactos; frases cortas | No es seca: un "¡Listo!" o un "con la plancha encendida" caben |
| **Cumplida** | Prometemos lo que hacemos: "te confirmamos", "ese día llegamos" | No es exagerada: nada de "la mejor taquiza del universo" ni signos de admiración en todo |

| sí | no |
| --- | --- |
| "Si cancelas a más tardar el viernes 15 de enero, te devolvemos $1,800." | "Aplican políticas de reembolso." |
| "Tuvimos que cancelar tu taquiza. Motivo: se nos descompuso el trompo." | "Tu reservación fue cancelada." |
| "Ese día llegamos con la plancha encendida." | "Te esperamos" (eres tú quien llega a su fiesta, no al revés) |
| "No pudimos conectarnos. Revisa tu internet e intenta de nuevo; lo que escribiste sigue aquí." | "Error de red (500)." |
| "Te confirmamos nosotros mismos por WhatsApp." | "Un agente se comunicará contigo." |

### Los 10 textos que más se ven

| # | dónde | antes | ahora |
| --- | --- | --- | --- |
| 1 | Portada, título | "La plancha de D' Garden Tacos en tu fiesta" | Se queda: ya dice el servicio y la idea |
| 2 | Portada, promesa (nuevo) | — | "Tú eliges el día. Te confirma por WhatsApp el mismo equipo que llega a servir." |
| 3 | Portada, paso 3 | "Llegamos con la plancha · Te confirmamos por WhatsApp y el día del evento servimos." | "Te confirmamos y llegamos · Nosotros mismos te confirmamos por WhatsApp. El día del evento llegamos con la plancha." |
| 4 | Botón principal (encabezado) | "Agendar taquiza" | Se queda |
| 5 | Botón final de agendar | "Enviar solicitud" | "Enviar solicitud · dom 6 de dic, 17:00" (FX1) |
| 6 | Confirmación, confirmada | "Te esperamos con la plancha encendida." | "Ese día llegamos con la plancha encendida." (**el texto anterior decía que el cliente venía a ti**) |
| 7 | Confirmación, solicitud | "Tu fecha está apartada mientras te confirmamos por WhatsApp." | "Ya apartamos tu fecha. Te confirmamos nosotros mismos por WhatsApp." |
| 8 | Correo de confirmación | "Hola, Ana. Te esperamos el sábado 14 de diciembre a las 14:00." | "Hola, Ana. Ahí estaremos el sábado 14 de diciembre a las 14:00, con la plancha encendida." |
| 9 | Error sin conexión | "No pudimos conectarnos. Revisa tu conexión a internet e intenta de nuevo." | "No pudimos conectarnos. Revisa tu internet e intenta de nuevo; lo que escribiste sigue aquí." |
| 10 | Cancelación del negocio | (sin motivo, opcional) | "Tuvimos que cancelar tu taquiza · Motivo: …", y el motivo es obligatorio (FX2) |

Ninguno copia la forma de decir de OpenTable: todos se escribieron aquí, en español de México.

## 5. El barrido

`brand.json` lista lo que no puede quedar en el sistema:
- el nombre de OpenTable;
- sus dominios: opentable.com, opentable.com.mx y otstatic.com;
- su rojo, `#DA3743`. Viene de conocimiento general, con confianza media.

```bash
python3 .claude/skills/replica-brand/sweep.py . --config replica/brand.json
```

**Resultado (2026-11-25): limpio.** Fuera de `replica/` no aparece nada.

Dentro de `replica/` sí aparece, y está bien: son los documentos de investigación (recon,
reseñas, paridad). No se publican. La nota de origen de `tokens.json`, que sí la lee la app, se
reescribió para que no lo nombre.

**Revisado a ojo:**
- Títulos de página: "… · D' Garden Tacos".
- Correos: encabezado "D' Garden Tacos" y colores de los tokens.
- Favicon e ícono de iPhone: provisionales, con los colores del logo.
- Imagen para compartir: nombre, promesa y ciudad.
- Ninguna pantalla menciona a OpenTable.

**Antes de publicar** (`/replica-deploy` vuelve a correr el barrido):
- Pon el logo real.
- Compra el dominio.
- Corre de nuevo el barrido.
