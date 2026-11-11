import { readFileSync } from "node:fs";
import path from "node:path";

/** The configured origin is part of versioned site content, so SEO and sitemap share one source. */
export function siteUrl(): string {
  try {
    const configPath = path.join(process.cwd(), "content", "site.json");
    const config = JSON.parse(readFileSync(configPath, "utf8")) as { url?: unknown };
    if (typeof config.url === "string" && /^https?:\/\//i.test(config.url)) return config.url.replace(/\/+$/, "");
  } catch {
    // Keep local development usable before the first content snapshot exists.
  }
  return "https://claritys.web.id";
}
