/** The content of `robots.txt`: every crawler may visit every page and finds the sitemap. */
export function buildRobotsText(sitemapUrl: URL): string {
  return ["User-agent: *", "Allow: /", `Sitemap: ${sitemapUrl.href}`, ""].join(
    "\n",
  );
}
