import { existsSync, lstatSync, readdirSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve(process.cwd(), process.argv[2] ?? "out");
const DEFAULT_LIMIT_MIB = 900;
const configuredLimit = process.env.STATIC_SITE_MAX_SIZE_MB?.trim();
const maxSizeMiB = configuredLimit ? Number(configuredLimit) : DEFAULT_LIMIT_MIB;
const errors = [];

if (!Number.isFinite(maxSizeMiB) || maxSizeMiB <= 0) {
  throw new Error("STATIC_SITE_MAX_SIZE_MB must be a positive number.");
}

function walk(directory, relative = "") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    const name = path.posix.join(relative, entry.name);
    const info = lstatSync(absolute);

    if (info.isSymbolicLink()) {
      errors.push("Symbolic links are not supported in a GitHub Pages branch publication: " + name);
      return [];
    }

    return info.isDirectory()
      ? walk(absolute, name)
      : info.isFile()
        ? [{ path: name, bytes: info.size }]
        : [];
  });
}

function requirePath(relative, description = relative) {
  if (!existsSync(path.join(OUT, relative))) errors.push("Missing expected static output " + description + ": " + relative);
}

if (!existsSync(OUT) || !lstatSync(OUT).isDirectory()) {
  console.error("ERROR Static export directory does not exist: " + OUT);
  process.exit(1);
}

requirePath("index.html", "root entry point");
requirePath("_next/static", "Next.js static asset directory");
requirePath("robots.txt");
requirePath("sitemap.xml");
requirePath("profile.jpg", "profile image");
requirePath("assets/uploads", "public upload directory");

const forbidden = [
  ".git",
  ".next",
  ".github",
  "node_modules",
  "src",
  "tests",
  "e2e",
  "package.json",
  "pnpm-lock.yaml",
  "next.config.ts",
  "tsconfig.json",
];

for (const entry of forbidden) {
  if (existsSync(path.join(OUT, entry))) errors.push("Development/source file must not be published: " + entry);
}

const files = walk(OUT);
const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
const maxBytes = Math.floor(maxSizeMiB * 1024 * 1024);
const largestFiles = [...files].sort((a, b) => b.bytes - a.bytes).slice(0, 10);

if (!files.some((file) => file.path.startsWith("_next/static/") && file.bytes > 0)) {
  errors.push("No files were found under _next/static/.");
}
if (!files.some((file) => file.path.startsWith("assets/uploads/") && file.bytes > 0)) {
  errors.push("No public upload assets were found under assets/uploads/.");
}

if (totalBytes > maxBytes) {
  errors.push(
    "Static output is " + (totalBytes / (1024 * 1024)).toFixed(2) +
    " MiB, above STATIC_SITE_MAX_SIZE_MB=" + maxSizeMiB + " MiB.",
  );
}

const report = {
  directory: OUT,
  rootIndexHtml: existsSync(path.join(OUT, "index.html")),
  nextStaticAssets: existsSync(path.join(OUT, "_next", "static")),
  fileCount: files.length,
  totalBytes,
  totalMiB: Number((totalBytes / (1024 * 1024)).toFixed(2)),
  maximumMiB: maxSizeMiB,
  largestFiles: largestFiles.map((file) => ({
    path: file.path,
    bytes: file.bytes,
    MiB: Number((file.bytes / (1024 * 1024)).toFixed(2)),
  })),
  errors: errors.length,
};

console.log(JSON.stringify(report, null, 2));
errors.forEach((error) => console.error("ERROR " + error));
if (errors.length) process.exitCode = 1;
