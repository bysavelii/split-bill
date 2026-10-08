import { describe, expect, it } from "vitest";
import { buildSiteRoot } from "./site-root";

const SITE = new URL("https://bysavelii.github.io");

describe("buildSiteRoot", () => {
  it("joins the site and the base path", () => {
    expect(buildSiteRoot(SITE, "/split-bill/").href).toBe(
      "https://bysavelii.github.io/split-bill/",
    );
  });

  it("adds the trailing slash to the base path", () => {
    expect(buildSiteRoot(SITE, "/split-bill").href).toBe(
      "https://bysavelii.github.io/split-bill/",
    );
  });

  it("uses the site root for the root base path", () => {
    expect(buildSiteRoot(SITE, "/").href).toBe("https://bysavelii.github.io/");
  });

  it("explains that the site is missing", () => {
    expect(() => buildSiteRoot(undefined, "/")).toThrow("site");
  });
});
