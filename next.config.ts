import type { NextConfig } from "next";
import { readFileSync } from "node:fs";

const site = JSON.parse(readFileSync(new URL("./content/site.json", import.meta.url), "utf8")) as { url: string; trailingSlash?: boolean };
const basePath = process.env.STATIC_SITE_BASE_PATH ?? new URL(site.url).pathname.replace(/\/+$/, "");

if (basePath && (!basePath.startsWith("/") || basePath.startsWith("//") || basePath.includes("..") || /[?#]/.test(basePath))) {
  throw new Error("STATIC_SITE_BASE_PATH must be an absolute URL path without query, fragment or traversal.");
}

const nextConfig: NextConfig = {
  output: "export",
  basePath: basePath || undefined,
  trailingSlash: site.trailingSlash ?? true,
  poweredByHeader: false,
  images: {
    // GitHub Pages serves the files generated at build time; no image optimizer API exists there.
    unoptimized: true,
  },
};

export default nextConfig;
