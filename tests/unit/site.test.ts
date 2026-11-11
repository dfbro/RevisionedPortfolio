import { afterEach, describe, expect, it } from "vitest";
import { siteUrl } from "@/lib/site";

afterEach(() => {
  delete process.env.SITE_URL;
  delete process.env.STATIC_SITE_URL;
});

describe("siteUrl", () => {
  it("defaults to the GitHub Pages project URL", () => {
    expect(siteUrl()).toBe("https://dfbro.github.io/RevisionedPortfolioSite");
  });
  it("uses the static deployment URL override when the build provides it", () => {
    process.env.STATIC_SITE_URL = "https://dfbro.github.io/RevisionedPortfolioSite/";
    expect(siteUrl()).toBe("https://dfbro.github.io/RevisionedPortfolioSite");
  });
  it("ignores unrelated site environment variables", () => {
    process.env.SITE_URL = "http://localhost:3007/";
    expect(siteUrl()).toBe("https://dfbro.github.io/RevisionedPortfolioSite");
  });
});
