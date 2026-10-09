/**
 * The address the site is published at, with the base path and a trailing slash, for example
 * `https://split-bill.bysavelii.com/`. Page addresses are built from it.
 */
export function buildSiteRoot(site: URL | undefined, basePath: string): URL {
  if (site === undefined) {
    throw new Error(
      "The Astro config has no `site`: canonical addresses, the sitemap and link previews cannot be built without it",
    );
  }

  const normalizedBasePath = basePath.endsWith("/") ? basePath : `${basePath}/`;

  return new URL(normalizedBasePath, site);
}
