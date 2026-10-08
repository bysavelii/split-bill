import type { APIRoute } from "astro";
import { buildRobotsText } from "../seo/robots";
import { buildSiteRoot } from "../seo/site-root";

const SITEMAP_FILE_NAME = "sitemap-index.xml";

export const GET: APIRoute = ({ site }) => {
  const siteRoot = buildSiteRoot(site, import.meta.env.BASE_URL);
  const sitemapUrl = new URL(SITEMAP_FILE_NAME, siteRoot);

  return new Response(buildRobotsText(sitemapUrl), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
