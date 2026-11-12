import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const SITE = JSON.parse(readFileSync("content/site.json", "utf8")) as { basePath?: string };
const BASE_PATH = SITE.basePath === "/" || !SITE.basePath ? "" : `/${SITE.basePath.split("/").filter(Boolean).join("/")}`;
const sitePath = (path = "") => `${BASE_PATH}/${path}`;

async function clickPrimaryNav(page: import("@playwright/test").Page, mobile: boolean, label: string) {
  if (mobile) await page.getByRole("button", { name: "menu" }).click();
  const menu = mobile ? page.locator("#mobile-menu") : page.locator("nav");
  await menu.getByRole("link", { name: label, exact: true }).click();
}

async function deferredOrLoadedSource(image: import("@playwright/test").Locator) {
  return (await image.getAttribute("src")) || (await image.getAttribute("data-deferred-src"));
}

test("home renders real content without horizontal overflow", async ({ page }) => {
  await page.goto(sitePath());
  await expect(page.getByRole("heading", { level: 1 })).toContainText("ELANG");
  await expect(page.getByText("pwn · rev · web exploit")).toBeVisible();
  await expect(page.locator(`main ol a[href^='${BASE_PATH}/writeups/']`).first()).toBeAttached();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("primary navigation transitions to projects and achievements", async ({ page }, info) => {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("requestfailed", (request) => {
    if (request.method() !== "HEAD" && request.url().startsWith("http://127.0.0.1:3100")) {
      failures.push(`${request.method()} ${request.url()}`);
    }
  });
  await page.addInitScript(() => sessionStorage.setItem("intro-seen", "1"));
  await page.goto(sitePath());

  const nav = page.locator("nav");
  const menu = info.project.name === "mobile" ? page.locator("#mobile-menu") : nav;
  const openMobileMenu = async () => {
    if (info.project.name === "mobile") await page.getByRole("button", { name: "menu" }).click();
  };

  await openMobileMenu();
  await menu.getByRole("link", { name: "Projects", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${BASE_PATH}/projects/$`));
  await expect(page.locator("main h1")).toContainText("Projects");

  await openMobileMenu();
  await menu.getByRole("link", { name: "Record", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${BASE_PATH}/achievements/$`));
  await expect(page.locator("main h1")).toContainText("Record");
  expect(failures).toEqual([]);
});

test("project images keep their project-site base path after client navigation", async ({ page }, info) => {
  const imageFailures: string[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/assets/uploads/") && response.status() >= 400) imageFailures.push(`${response.status()} ${response.url()}`);
  });
  await page.addInitScript(() => sessionStorage.setItem("intro-seen", "1"));
  await page.goto(sitePath());
  await clickPrimaryNav(page, info.project.name === "mobile", "Projects");

  const images = page.locator("main article img");
  await expect(images).toHaveCount(12);
  const imageSources: string[] = [];
  for (let index = 0; index < await images.count(); index += 1) {
    const image = images.nth(index);
    await expect.poll(() => deferredOrLoadedSource(image)).toMatch(new RegExp(`^${BASE_PATH}/assets/uploads/`));
    const source = await deferredOrLoadedSource(image);
    imageSources.push(source!);
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveAttribute("src", source!);
    await expect.poll(() => image.evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
  const assetStatuses = await Promise.all(imageSources.map(async (src) => (await page.request.get(new URL(src, page.url()).toString())).status()));
  expect(assetStatuses).toEqual(Array(12).fill(200));
  expect(imageFailures).toEqual([]);
});

test("project cards link to generated individual project pages", async ({ page }) => {
  await page.goto(sitePath("projects"));
  const firstProject = page.locator("main article h2 a").first();
  await expect(firstProject).toBeVisible();
  const href = await firstProject.getAttribute("href");
  expect(href).toMatch(new RegExp(`^${BASE_PATH}/projects/[a-z0-9-]+/?$`));
  await firstProject.click();
  await expect(page.locator("main h1")).toBeVisible();
  await expect(page.getByRole("link", { name: /all projects/i })).toBeVisible();
});

test("home defers project screenshots until their cards approach the viewport", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("intro-seen", "1"));
  await page.goto(sitePath());
  const images = page.locator(".stack-card img");
  await expect(images).toHaveCount(6);
  const initial = await images.evaluateAll((nodes) => nodes.map((node) => ({
    src: node.getAttribute("src"),
    deferred: node.getAttribute("data-deferred-src"),
  })));
  expect(initial.every((image) => image.src === null && image.deferred?.startsWith(`${BASE_PATH}/assets/uploads/`))).toBe(true);

  const first = images.first();
  await first.scrollIntoViewIfNeeded();
  await expect.poll(() => first.getAttribute("src")).toMatch(new RegExp(`^${BASE_PATH}/assets/uploads/`));
  await expect.poll(() => first.evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const stillDeferred = await images.evaluateAll((nodes) => nodes.filter((node) => node.hasAttribute("data-deferred-src")).length);
  expect(stillDeferred).toBeGreaterThan(0);
});

test("home defers the about portrait until its section enters the viewport", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("intro-seen", "1"));
  await page.goto(sitePath());
  const image = page.locator(".about-photo img");
  await expect(image).toHaveCount(1);
  await expect(image).not.toHaveAttribute("src", /.+/);
  await expect(image).toHaveAttribute("data-deferred-src", `${BASE_PATH}/profile.jpg`);
  await image.scrollIntoViewIfNeeded();
  await expect(image).toHaveAttribute("src", `${BASE_PATH}/profile.jpg`);
  await expect.poll(() => image.evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
});

test("achievement thumbnails keep their project-site base path after client navigation", async ({ page }, info) => {
  const imageFailures: string[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/assets/uploads/") && response.status() >= 400) imageFailures.push(`${response.status()} ${response.url()}`);
  });
  await page.addInitScript(() => sessionStorage.setItem("intro-seen", "1"));
  await page.goto(sitePath());
  await clickPrimaryNav(page, info.project.name === "mobile", "Record");

  const images = page.locator(".achievement-gallery img");
  await expect.poll(() => images.count()).toBeGreaterThan(0);
  const count = await images.count();
  expect(count).toBeGreaterThan(0);
  const sources: string[] = [];
  for (let index = 0; index < Math.min(count, 6); index += 1) {
    const image = images.nth(index);
    await expect.poll(() => deferredOrLoadedSource(image)).toMatch(new RegExp(`^${BASE_PATH}/assets/uploads/`));
    const source = await deferredOrLoadedSource(image);
    sources.push(source!);
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveAttribute("src", source!);
    await expect.poll(() => image.evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
  const statuses = await Promise.all(sources.map(async (src) => (await page.request.get(src)).status()));
  expect(statuses).toEqual(Array(sources.length).fill(200));
  expect(imageFailures).toEqual([]);
});

test("writeup body images and attachments keep their project-site base path after navigation", async ({ page }, info) => {
  const failedAssets: string[] = [];
  page.on("response", (response) => {
    if ((response.url().includes("/assets/uploads/") || response.url().includes("/assets/exports/")) && response.status() >= 400) {
      failedAssets.push(`${response.status()} ${response.url()}`);
    }
  });
  await page.addInitScript(() => sessionStorage.setItem("intro-seen", "1"));
  await page.goto(sitePath());
  await clickPrimaryNav(page, info.project.name === "mobile", "Writeups");
  await page.locator(`main ol a[href^="${BASE_PATH}/writeups/pwn-abbys"]`).click();
  await expect(page.locator("main h1")).toBeVisible();

  const articleImages = page.locator("article.writeup-prose img");
  const count = await articleImages.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < Math.min(count, 4); index += 1) {
    const image = articleImages.nth(index);
    await expect(image).toHaveAttribute("src", new RegExp(`^${BASE_PATH}/assets/uploads/`));
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
  await page.goto(sitePath("writeups"));
  await page.locator(`main ol a[href^="${BASE_PATH}/writeups/pwn-abbys"]`).click();
  await expect(page.locator("main h1")).toContainText(/Abbys/i);
  const attachment = page.locator(`#attachments a[href^="${BASE_PATH}/assets/uploads/"]`).first();
  await expect(attachment).toBeVisible();
  const attachmentUrl = await attachment.getAttribute("href");
  expect(attachmentUrl).toMatch(new RegExp(`^${BASE_PATH}/assets/uploads/`));
  expect((await page.request.get(new URL(attachmentUrl!, page.url()).toString())).status()).toBe(200);
  expect(failedAssets).toEqual([]);
});

test("related writeup cover images wait until the related section is visible", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("intro-seen", "1"));
  await page.goto(sitePath("writeups/pwn-abbys"));
  const section = page.locator('section[aria-labelledby="related-heading"]');
  const images = section.locator("img");
  await expect(images).toHaveCount(3);
  const sources: string[] = [];
  for (let index = 0; index < await images.count(); index += 1) {
    const image = images.nth(index);
    await expect(image).not.toHaveAttribute("src", /.+/);
    const source = await image.getAttribute("data-deferred-src");
    expect(source).toMatch(new RegExp(`^(?:${BASE_PATH}/assets/uploads/|https?://)`));
    sources.push(source!);
  }
  await section.scrollIntoViewIfNeeded();
  for (let index = 0; index < await images.count(); index += 1) {
    const image = images.nth(index);
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveAttribute("src", sources[index]);
    if (sources[index].startsWith(`${BASE_PATH}/`)) {
      await expect.poll(() => image.evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    }
  }
});

test("first visit to home opens behind the preloader, which then lifts", async ({ page }, info) => {
  test.skip(info.project.name === "reduced-motion", "no preloader when motion is reduced");
  await page.goto(sitePath());
  const loader = page.getByRole("status", { name: "Loading" });
  await expect(loader).toBeVisible();
  await expect(loader).toHaveCount(0, { timeout: 8000 });
  expect(await page.evaluate(() => sessionStorage.getItem("intro-seen"))).toBe("1");
  await page.reload();
  await expect(page.getByRole("status", { name: "Loading" })).toBeHidden();
});

test("large hero headings schedule their SplitText work during browser idle after a refresh", async ({ page }, info) => {
  test.skip(info.project.name === "reduced-motion", "SplitText is disabled when reduced motion is requested");
  await page.addInitScript(() => {
    sessionStorage.setItem("intro-seen", "1");
    const idleWindow = window as Window & {
      __idleSchedules?: number;
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
    };
    idleWindow.__idleSchedules = 0;
    const native = idleWindow.requestIdleCallback?.bind(window);
    if (native) {
      idleWindow.requestIdleCallback = (callback, options) => {
        idleWindow.__idleSchedules = (idleWindow.__idleSchedules ?? 0) + 1;
        return native(callback, options);
      };
    }
  });
  await page.goto(sitePath());
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.evaluate(() => (window as Window & { __idleSchedules?: number }).__idleSchedules ?? 0)).toBe(2);
  await expect(page.locator("main h1")).toContainText("ELANG");
  await expect(page.locator("main h1")).toContainText("DIMAS SYADEWA");
  const images = await page.locator("main img").evaluateAll((nodes) => nodes.map((node) => ({
    loading: (node as HTMLImageElement).loading,
    fetchPriority: (node as HTMLImageElement).fetchPriority,
  })));
  expect(images.every((image) => image.loading === "lazy" && image.fetchPriority === "low")).toBe(true);
});

test("activity heatmap restores the original spring-pop cascade without per-cell JavaScript", async ({ page }, info) => {
  test.skip(info.project.name === "reduced-motion", "cell motion is disabled when reduced motion is requested");
  await page.addInitScript(() => sessionStorage.setItem("intro-seen", "1"));
  await page.goto(sitePath());
  const card = page.locator(".hm-card");
  await card.scrollIntoViewIfNeeded();
  await expect(card).toBeVisible();
  await expect(card).toHaveClass(/is-visible/);
  const cells = page.locator(".hm-cell");
  expect(await cells.count()).toBeGreaterThan(350);
  await expect.poll(() => page.locator(".hm-grid-visual").evaluate((node) => getComputedStyle(node).opacity)).toBe("1");
  const canvas = card.locator(".hm-canvas");
  await expect(canvas).toHaveAttribute("data-cell-count", String(await cells.count()));
  await expect(canvas).toHaveAttribute("data-stagger-ms", "1100");
  await expect(canvas).toHaveAttribute("data-duration-ms", "400");
  await expect(canvas).toHaveAttribute("data-motion-state", "animating");
  const paintedPixels = () => canvas.evaluate((node) => {
    const element = node as HTMLCanvasElement;
    const pixels = element.getContext("2d")!.getImageData(0, 0, element.width, element.height).data;
    let count = 0;
    for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 0) count += 1;
    return count;
  });
  await expect.poll(paintedPixels).toBeGreaterThan(0);
  await expect(canvas).toHaveAttribute("data-motion-state", "complete", { timeout: 4000 });
  await expect(card).toHaveClass(/is-complete/);
  await expect.poll(() => cells.first().evaluate((node) => getComputedStyle(node).visibility)).toBe("visible");
  await expect.poll(() => canvas.evaluate((node) => getComputedStyle(node).visibility)).toBe("hidden");
  await expect(card.locator(".hm-total")).not.toHaveText("0");
});

test("activity heatmap stays static when reduced motion is requested", async ({ page }, info) => {
  test.skip(info.project.name !== "reduced-motion", "only applies to reduced-motion project");
  await page.addInitScript(() => sessionStorage.setItem("intro-seen", "1"));
  await page.goto(sitePath());
  const card = page.locator(".hm-card");
  await card.scrollIntoViewIfNeeded();
  await expect(card).toHaveClass(/is-complete/);
  await expect(card.locator(".hm-canvas")).toHaveAttribute("data-motion-state", "reduced");
  await expect.poll(() => card.locator(".hm-cell").first().evaluate((node) => getComputedStyle(node).visibility)).toBe("visible");
});

test("all sections become visible after scrolling (nothing stuck at opacity 0)", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("intro-seen", "1"));
  await page.goto(sitePath());
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < height; y += 700) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(1500);
  const hidden = await page.$$eval("main li, main h2, main p", (els) =>
    els
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.height > 0 && getComputedStyle(e).opacity === "0" && !e.closest("[aria-hidden]");
      })
      .map((e) => e.textContent?.slice(0, 40)),
  );
  expect(hidden).toEqual([]);
});

test("writeup article loads static uploads and reveals flag", async ({ page }) => {
  const statuses: number[] = [];
  page.on("response", (r) => {
    if (r.url().includes("/assets/uploads/")) statuses.push(r.status());
  });
  await page.goto(sitePath("writeups/pwn-truman"));
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Truman");
  await page.locator("article img").first().scrollIntoViewIfNeeded();
  await expect.poll(() => statuses.length).toBeGreaterThan(0);
  expect(statuses.every((s) => s === 200)).toBe(true);
  const reveal = page.getByRole("button", { name: "Reveal flag" });
  if (await reveal.count()) {
    await reveal.click();
    await expect(page.locator("code.text-primary", { hasText: /\{.*\}/ })).toBeVisible();
  }
});

test("legacy /ctf URL is served as a static alias to the canonical writeup", async ({ request }) => {
  const response = await request.get(sitePath("ctf/pwn-truman"));
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain('http-equiv="refresh"');
  expect(html).toContain(`${BASE_PATH}/writeups/pwn-truman`);
});

test("writeups filter narrows to pwn", async ({ page }) => {
  await page.goto(sitePath("writeups"));
  const resultCount = page.getByText(/^\d+ results$/);
  const allCount = Number((await resultCount.textContent())?.match(/^\d+/)?.[0] ?? 0);
  await page.getByRole("button", { name: "Pwn", exact: true }).click();
  await expect(resultCount).toBeVisible();
  const pwnCount = Number((await resultCount.textContent())?.match(/^\d+/)?.[0] ?? 0);
  expect(pwnCount).toBeGreaterThan(0);
  expect(pwnCount).toBeLessThan(allCount);
  await expect(page.getByRole("button", { name: "Pwn", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("main ol li")).toHaveCount(pwnCount);
});

test("about strip opens on cybersecurity and follows the pointer", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "hover");
  await page.addInitScript(() => sessionStorage.setItem("intro-seen", "1"));
  await page.goto(sitePath());
  const strip = page.getByRole("list", { name: "Focus areas" });
  await strip.scrollIntoViewIfNeeded();
  const cell = (name: string) => strip.locator("li").filter({ hasText: name });
  await expect(cell("Cybersecurity")).toHaveAttribute("data-on", "true");
  await cell("Web Development").hover();
  await expect(cell("Web Development")).toHaveAttribute("data-on", "true");
  await expect(cell("Cybersecurity")).not.toHaveAttribute("data-on");
});

test("contact opens a mail draft and explains the visitor must send it", async ({ page }) => {
  await page.goto(sitePath("about"));
  await page.locator("#contact").scrollIntoViewIfNeeded();
  const emailLink = page.locator('#contact a[href^="mailto:"]');
  await expect(emailLink).toBeVisible();
  await expect(emailLink).toHaveAttribute("href", /subject=Portfolio%20Inquiry/);
  await expect(page.getByText("Your email app will open with a draft. Review it and press Send there.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy email address" })).toBeVisible();
});

test("404 page", async ({ page }) => {
  const res = await page.goto(sitePath("writeups/nope-nope"));
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
});

test("footer shows ELANG and contact links", async ({ page }) => {
  await page.goto(sitePath("about"));
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);
  await expect(page.locator("footer").getByText("ELANG").first()).toBeAttached();
  await expect(page.locator("footer").getByRole("link", { name: /GitHub/ })).toBeVisible();
});

test("writeup code blocks show a language and copy their contents", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(sitePath("writeups/pwn-truman"));
  const block = page.locator("figure.code-block").filter({ has: page.locator(".code-lang", { hasText: /^c$/ }) }).first();
  await block.scrollIntoViewIfNeeded();
  await block.getByRole("button", { name: "copy" }).click();
  await expect(block.getByRole("button", { name: "copied ✓" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("#include");
});

test("writeup export downloads static HTML and Markdown and can print", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { printed: number }).printed = 0;
    window.print = () => void (window as unknown as { printed: number }).printed++;
  });
  await page.goto(sitePath("writeups/pwn-truman"));
  const htmlLink = page.locator(`a[href="${sitePath("assets/exports/pwn-truman.html")}"]`);
  const markdownLink = page.locator(`a[href="${sitePath("assets/exports/pwn-truman.md")}"]`);
  await expect(htmlLink).toBeVisible();
  await expect(markdownLink).toBeVisible();
  const htmlResponse = await page.request.get(new URL(sitePath("assets/exports/pwn-truman.html"), page.url()).toString());
  const markdownResponse = await page.request.get(new URL(sitePath("assets/exports/pwn-truman.md"), page.url()).toString());
  expect(htmlResponse.status()).toBe(200);
  expect(markdownResponse.status()).toBe(200);
  await page.getByRole("button", { name: "PDF" }).click();
  expect(await page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);
});

test("achievement title opens the certificate preview in place", async ({ page }) => {
  const imageFailures: string[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/assets/uploads/") && response.status() >= 400) imageFailures.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(sitePath("achievements"));
  await page.getByRole("button", { name: /^View certificate:/ }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const certificate = dialog.locator("img");
  await expect(certificate).toHaveAttribute("src", new RegExp(`^${BASE_PATH}/assets/uploads/`));
  await expect.poll(() => certificate.evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  expect(imageFailures).toEqual([]);
  await expect(page).toHaveURL(/\/achievements$/);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
