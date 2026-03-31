import { fetchPage, extractLinks, isPriorityUrl, classifyPageType } from "./fetcher";
import { parseSitemap } from "./sitemap";

export interface CrawlResult {
  url: string;
  title: string;
  text: string;
  pageType: string | null;
  method: "http" | "playwright";
  error: string | null;
}

export interface CrawlProgress {
  found: number;
  crawled: number;
  failed: number;
  current: string;
}

export async function crawlProperty(
  propertyUrl: string,
  options: {
    maxPages?: number;
    onProgress?: (progress: CrawlProgress) => void;
  } = {}
): Promise<CrawlResult[]> {
  const maxPages = options.maxPages || 30;
  const results: CrawlResult[] = [];
  const visited = new Set<string>();
  const queue: { url: string; priority: number }[] = [];

  // Normalize base URL
  const base = new URL(propertyUrl);
  const baseUrl = base.origin;

  // Step 1: Fetch homepage
  try {
    const homepage = await fetchPage(propertyUrl);
    visited.add(propertyUrl);
    results.push({
      url: propertyUrl,
      title: homepage.title,
      text: homepage.text,
      pageType: "homepage",
      method: "http",
      error: null,
    });

    // Extract links from homepage
    const links = extractLinks(homepage.html, propertyUrl);
    for (const link of links) {
      if (!visited.has(link)) {
        queue.push({ url: link, priority: isPriorityUrl(link) ? 1 : 0 });
      }
    }

    options.onProgress?.({
      found: queue.length + 1,
      crawled: 1,
      failed: 0,
      current: propertyUrl,
    });
  } catch (err) {
    results.push({
      url: propertyUrl,
      title: "",
      text: "",
      pageType: "homepage",
      method: "http",
      error: err instanceof Error ? err.message : "Failed to fetch homepage",
    });
  }

  // Step 2: Parse sitemap
  const sitemapUrls = await parseSitemap(baseUrl);
  for (const su of sitemapUrls) {
    if (!visited.has(su.loc) && !queue.find((q) => q.url === su.loc)) {
      queue.push({ url: su.loc, priority: isPriorityUrl(su.loc) ? 2 : 0 });
    }
  }

  // Sort queue: priority pages first
  queue.sort((a, b) => b.priority - a.priority);

  // Step 3: Crawl pages from queue
  let failed = 0;
  while (queue.length > 0 && results.length < maxPages) {
    const item = queue.shift()!;
    if (visited.has(item.url)) continue;
    visited.add(item.url);

    try {
      const page = await fetchPage(item.url);
      const pageType = classifyPageType(item.url, page.title);

      results.push({
        url: item.url,
        title: page.title,
        text: page.text,
        pageType,
        method: "http",
        error: null,
      });

      // Extract new links from this page
      const newLinks = extractLinks(page.html, item.url);
      for (const link of newLinks) {
        if (!visited.has(link) && !queue.find((q) => q.url === link)) {
          queue.push({ url: link, priority: isPriorityUrl(link) ? 1 : 0 });
        }
      }
      // Re-sort
      queue.sort((a, b) => b.priority - a.priority);
    } catch (err) {
      failed++;
      results.push({
        url: item.url,
        title: "",
        text: "",
        pageType: classifyPageType(item.url, ""),
        method: "http",
        error: err instanceof Error ? err.message : "Fetch failed",
      });
    }

    options.onProgress?.({
      found: visited.size + queue.length,
      crawled: results.filter((r) => !r.error).length,
      failed,
      current: item.url,
    });

    // Small delay to be polite
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return results;
}
