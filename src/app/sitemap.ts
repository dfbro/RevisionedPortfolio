import type { MetadataRoute } from "next";
import { listAchievements } from "@/lib/data/achievements";
import { listProjects } from "@/lib/data/projects";
import { listWriteups } from "@/lib/data/writeups";
import { getSiteConfig } from "@/lib/content";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const site = await getSiteConfig();
  const route = (pathname: string) => {
    const clean = pathname.startsWith("/") ? pathname : "/" + pathname;
    const normalized = clean.replace(/\/{2,}/g, "/");
    return base + (site.trailingSlash && normalized !== "/" ? normalized.replace(/\/$/, "") + "/" : site.trailingSlash ? "/" : normalized.replace(/\/$/, ""));
  };
  const [writeups, projects, achievements] = await Promise.all([listWriteups(), listProjects(), listAchievements()]);
  const abs = (u: string | null) => (u && !u.startsWith("data:") ? (u.startsWith("http") ? u : `${base}${u}`) : null);
  const latest = writeups.map((w) => w.updated).sort().at(-1);
  const images = (list: (string | null)[]) => list.map(abs).filter((u): u is string => !!u);

  return [
    { url: route("/"), lastModified: latest, changeFrequency: "weekly", priority: 1 },
    { url: route("/writeups"), lastModified: latest, changeFrequency: "weekly", priority: 0.9 },
    { url: route("/projects"), changeFrequency: "monthly", priority: 0.7, images: images(projects.map((p) => p.imageUrl)) },
    { url: route("/achievements"), changeFrequency: "monthly", priority: 0.6, images: images(achievements.map((a) => a.imageUrl)).slice(0, 50) },
    { url: route("/about"), changeFrequency: "monthly", priority: 0.8 },
    ...writeups.map((w) => ({
      url: route(w.href),
      lastModified: w.updated,
      changeFrequency: "yearly" as const,
      priority: w.category === "Pwn" ? 0.8 : 0.7,
      images: images([w.cover]),
    })),
  ];
}
