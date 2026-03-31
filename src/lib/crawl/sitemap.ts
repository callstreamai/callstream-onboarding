import { parseStringPromise } from "xml2js";

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  priority?: string;
}

export async function parseSitemap(baseUrl: string): Promise<SitemapUrl[]> {
  const urls: SitemapUrl[] = [];
  const sitemapUrl = new URL("/sitemap.xml", baseUrl).toString();

  try {
    const res = await fetch(sitemapUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CallStreamBot/1.0; +https://callstreamai.com)",
      },
    });

    if (!res.ok) return [];

    const xml = await res.text();
    const parsed = await parseStringPromise(xml, { explicitArray: false });

    if (!parsed?.urlset?.url) return [];

    const entries = Array.isArray(parsed.urlset.url)
      ? parsed.urlset.url
      : [parsed.urlset.url];

    for (const entry of entries) {
      if (entry.loc) {
        urls.push({
          loc: entry.loc,
          lastmod: entry.lastmod || undefined,
          priority: entry.priority || undefined,
        });
      }
    }
  } catch {
    // sitemap not available or invalid
  }

  return urls;
}
