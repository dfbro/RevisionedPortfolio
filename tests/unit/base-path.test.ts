import { describe, expect, it } from "vitest";
import { BASE_PATH, withBasePath } from "@/lib/base-path";

describe("withBasePath", () => {
  it("prefixes root-relative public assets for GitHub project-site hosting", () => {
    expect(withBasePath("/assets/uploads/image.jpg")).toBe(`${BASE_PATH}/assets/uploads/image.jpg`);
    expect(withBasePath("/profile.jpg")).toBe(`${BASE_PATH}/profile.jpg`);
  });

  it("does not duplicate an existing project base path", () => {
    expect(withBasePath(`${BASE_PATH}/assets/uploads/image.jpg`)).toBe(`${BASE_PATH}/assets/uploads/image.jpg`);
    expect(withBasePath(BASE_PATH)).toBe(BASE_PATH);
  });

  it("leaves external, inline, anchor and mail URLs unchanged", () => {
    for (const url of [
      "https://cdn.example/image.jpg",
      "//cdn.example/image.jpg",
      "data:image/png;base64,AAAA",
      "blob:https://example.test/id",
      "#evidence",
      "mailto:hello@example.test",
      "/api/public/uploads/legacy.png",
    ]) {
      expect(withBasePath(url)).toBe(url);
    }
  });

  it("preserves a null source", () => {
    expect(withBasePath(null)).toBeNull();
  });
});
