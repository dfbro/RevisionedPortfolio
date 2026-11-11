import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve("out");
const BASE = "/RevisionedPortfolio";

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : entry.isFile() ? [absolute] : [];
  });
}

let changed = 0;
for (const file of walk(OUT)) {
  if (!/\.(html|css)$/.test(file)) continue;
  const original = readFileSync(file, "utf8");
  const updated = original.replace(
    /((?:href|src|poster|action|formaction)=["'])\/(?!\/|RevisionedPortfolio(?:\/|["?#]))/g,
    `$1${BASE}/`,
  ).replace(
    /url\((['"]?)\/(?!\/|RevisionedPortfolio(?:\/|[)'"?#]))/g,
    `url($1${BASE}/`,
  );
  if (updated !== original) {
    writeFileSync(file, updated);
    changed++;
  }
}
console.log(JSON.stringify({ basePath: BASE, rewrittenFiles: changed }));
