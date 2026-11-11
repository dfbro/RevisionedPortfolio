import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve("out");
const SITE = JSON.parse(readFileSync(path.resolve("content/site.json"), "utf8"));
const BASE = process.env.STATIC_SITE_BASE_PATH ?? new URL(process.env.STATIC_SITE_URL ?? SITE.url).pathname.replace(/\/+$/, "");

if (BASE && (!BASE.startsWith("/") || BASE.startsWith("//") || BASE.includes("..") || /[?#]/.test(BASE))) {
  throw new Error("Invalid static site base path: " + BASE);
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : entry.isFile() ? [absolute] : [];
  });
}

let changed = 0;
const baseName = BASE.slice(1).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const htmlRootReference = BASE ? new RegExp(`((?:href|src|poster|action|formaction)=[\"'])\\/(?!\\/|${baseName}(?:\\/|[\"?#]))`, "g") : null;
const cssRootReference = BASE ? new RegExp(`url\\(([\"']?)\\/(?!\\/|${baseName}(?:\\/|[)'\"?#]))`, "g") : null;
for (const file of walk(OUT)) {
  if (!/\.(html|css)$/.test(file)) continue;
  const original = readFileSync(file, "utf8");
  const updated = htmlRootReference && cssRootReference
    ? original.replace(htmlRootReference, `$1${BASE}/`).replace(cssRootReference, `url($1${BASE}/`)
    : original;
  if (updated !== original) {
    writeFileSync(file, updated);
    changed++;
  }
}
console.log(JSON.stringify({ basePath: BASE || "(root)", rewrittenFiles: changed }));
