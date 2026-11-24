// Genera replica/design/tokens.css (variables CSS) y replica/design/tailwind.css (el tema
// de Tailwind v4) desde replica/design/tokens.json. tokens.json es la única fuente:
// después de cambiarlo, corre `npm run tokens` y `npm run contrast`.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "replica", "design");
const t = JSON.parse(readFileSync(join(dir, "tokens.json"), "utf8"));

const rem = (px) => `${px / 16}rem`;
const header = "/* Generado por scripts/build-tokens.mjs desde tokens.json. No editar a mano. */\n";

// 1. Variables CSS, utilizables en cualquier lado.
const vars = [];
for (const [name, value] of Object.entries(t.color)) vars.push(`--dg-color-${name}: ${value};`);
for (const [name, value] of Object.entries(t.font)) vars.push(`--dg-font-${name}: ${value};`);
for (const [name, s] of Object.entries(t.type)) {
  vars.push(`--dg-text-${name}: ${rem(s.size)};`);
  vars.push(`--dg-text-${name}-line: ${rem(s.line)};`);
  vars.push(`--dg-text-${name}-weight: ${s.weight};`);
}
t.space.forEach((px) => vars.push(`--dg-space-${px}: ${rem(px)};`));
for (const [name, px] of Object.entries(t.radius)) vars.push(`--dg-radius-${name}: ${px}px;`);
for (const [name, value] of Object.entries(t.shadow)) vars.push(`--dg-shadow-${name}: ${value};`);
for (const [name, value] of Object.entries(t.motion)) vars.push(`--dg-motion-${name}: ${value};`);
for (const [name, px] of Object.entries(t.layout)) vars.push(`--dg-layout-${name}: ${px}px;`);

writeFileSync(join(dir, "tokens.css"), `${header}:root {\n  ${vars.join("\n  ")}\n}\n`);

// 2. Tema de Tailwind v4: solo existen los colores, tamaños y radios de los tokens.
//    `--color-*: initial` borra la paleta por defecto, así no hay forma de usar un hex suelto.
const theme = ["--color-*: initial;", "--text-*: initial;", "--radius-*: initial;", "--shadow-*: initial;"];
for (const name of Object.keys(t.color)) theme.push(`--color-${name}: var(--dg-color-${name});`);
for (const name of Object.keys(t.font)) theme.push(`--font-${name}: var(--dg-font-${name});`);
for (const name of Object.keys(t.type)) {
  theme.push(`--text-${name}: var(--dg-text-${name});`);
  theme.push(`--text-${name}--line-height: var(--dg-text-${name}-line);`);
  theme.push(`--text-${name}--font-weight: var(--dg-text-${name}-weight);`);
}
for (const name of Object.keys(t.radius)) theme.push(`--radius-${name}: var(--dg-radius-${name});`);
for (const name of Object.keys(t.shadow)) theme.push(`--shadow-${name}: var(--dg-shadow-${name});`);
theme.push(`--ease-brand: var(--dg-motion-ease);`);
theme.push(`--container-content: var(--dg-layout-content-max);`);
theme.push(`--container-flow: var(--dg-layout-flow-max);`);
theme.push(`--container-sidebar: var(--dg-layout-sidebar);`);
theme.push(`--spacing-header: var(--dg-layout-header);`);
theme.push(`--spacing-header-mobile: var(--dg-layout-header-mobile);`);
theme.push(`--spacing-tap: var(--dg-layout-tap-min);`);

writeFileSync(join(dir, "tailwind.css"), `${header}@theme inline {\n  ${theme.join("\n  ")}\n}\n`);
console.log("tokens.css y tailwind.css generados en replica/design/");
