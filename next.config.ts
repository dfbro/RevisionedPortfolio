import type { NextConfig } from "next";
import { readFileSync } from "node:fs";

const site = JSON.parse(readFileSync(new URL("./content/site.json", import.meta.url), "utf8")) as { trailingSlash?: boolean };

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: site.trailingSlash ?? true,
  poweredByHeader: false,
  images: {
    // GitHub Pages serves the files generated at build time; no image optimizer API exists there.
    unoptimized: true,
  },
};

export default nextConfig;
