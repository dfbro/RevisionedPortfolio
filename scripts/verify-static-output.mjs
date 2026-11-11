import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "out");
const CONTENT = path.join(ROOT, "content");
const PUBLIC = path.join(ROOT, "public");
const errors = [];

function fail(message) {
  errors.push(message);
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(path.join(CONTENT, file), "utf8"));
  } catch (error) {
    fail("Cannot read content/" + file + ": " + error.message);
    return null;
  }
}

function walkFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(absolute) : entry.isFile() ? [absolute] : [];
  });
}

const site = readJson("site.json");
const published = walkFiles(path.join(CONTENT, "writeups"))
  .filter((file) => file.endsWith(".md"))
  .map((file) => {
    const raw = readFileSync(file, "utf8");
    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
    if (!match) {
      fail("Missing frontmatter: " + path.relative(CONTENT, file));
      return null;
    }
    const metadata = {};
    for (const line of match[1].split(/\r?\n/)) {
      const field = /^([a-zA-Z][\w-]*):\s*(.*)$/.exec(line);
      if (!field) continue;
      try { metadata[field[1]] = JSON.parse(field[2]); }
      catch { metadata[field[1]] = field[2]; }
    }
    return metadata.status === "published" ? metadata : null;
  })
  .filter(Boolean);

if (!existsSync(OUT)) fail("Missing out/ directory; run the production build first.");

for (const route of ["index.html", "about/index.html", "projects/index.html", "achievements/index.html", "writeups/index.html", "ctf/index.html", "links/index.html", "robots.txt", "sitemap.xml"]) {
  if (!existsSync(path.join(OUT, route))) fail("Missing static output: " + route);
}

const sitemapPath = path.join(OUT, "sitemap.xml");
let sitemap = "";
if (existsSync(sitemapPath)) sitemap = readFileSync(sitemapPath, "utf8");
const sitemapUrls = [...sitemap.matchAll(new RegExp("<loc>([^<]+)</loc>", "g"))].map((match) => match[1]);
const origin = site?.url?.replace(/\/+$/, "");
if (origin && sitemapUrls.some((url) => !url.startsWith(origin + "/") && url !== origin)) {
  fail("Sitemap contains a URL outside the configured site origin.");
}

for (const item of published) {
  if (!item?.slug) continue;
  for (const prefix of ["writeups", "ctf"]) {
    const route = path.join(OUT, prefix, item.slug, "index.html");
    if (!existsSync(route)) fail("Missing generated article route: " + prefix + "/" + item.slug);
  }
  const expected = origin + "/writeups/" + item.slug + (readJson("site.json")?.trailingSlash ? "/" : "");
  if (!sitemapUrls.includes(expected)) fail("Published article missing from sitemap: " + item.slug);
}

const sourceUploads = walkFiles(path.join(PUBLIC, "assets", "uploads"));
const outputUploads = walkFiles(path.join(OUT, "assets", "uploads"));
if (sourceUploads.length !== outputUploads.length) {
  fail("Upload asset count mismatch: public=" + sourceUploads.length + ", out=" + outputUploads.length);
}

for (const relative of ["src/app/admin", "src/app/api", "src/lib/db.ts", "src/lib/session.ts", "src/generated/prisma", "prisma"]) {
  if (existsSync(path.join(ROOT, relative))) fail("Server/database-only path remains in website source: " + relative);
}

const packageJson = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
for (const dependency of ["@prisma/client", "@prisma/adapter-pg", "pg", "prisma"]) {
  if (packageJson.dependencies?.[dependency] || packageJson.devDependencies?.[dependency]) {
    fail("Database dependency remains in package.json: " + dependency);
  }
}

const staleApiRefs = walkFiles(CONTENT).filter((file) => /\.(md|mdx|json)$/i.test(file)).filter((file) => readFileSync(file, "utf8").includes("/api/public/uploads/"));
if (staleApiRefs.length) fail("Legacy upload API references remain in content: " + staleApiRefs.map((file) => path.relative(CONTENT, file)).join(", "));

const summary = {
  outputFiles: walkFiles(OUT).length,
  publishedWriteups: published.length,
  sitemapUrls: sitemapUrls.length,
  sourceUploads: sourceUploads.length,
  outputUploads: outputUploads.length,
  errors: errors.length,
};
console.log(JSON.stringify(summary, null, 2));
errors.forEach((error) => console.error("ERROR " + error));
if (errors.length) process.exitCode = 1;
