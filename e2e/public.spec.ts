import { expect, test } from "@playwright/test";

const BASE_PATH = "/RevisionedPortfolio";
const sitePath = (path = "") => `${BASE_PATH}/${path}`;

test("home renders real content without horizontal overflow", async ({ page }) => {
  await page.goto(sitePath());
  await expect(page.getByRole("heading", { level: 1 })).toContainText("ELANG");
  await expect(page.getByText("pwn · rev · web exploit")).toBeVisible();
  await expect(page.locator(`main ol a[href^='${BASE_PATH}/writeups/']`).first()).toBeAttached();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
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
  await page.goto(sitePath("achievements"));
  await page.getByRole("button", { name: /^View certificate:/ }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/achievements$/);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
