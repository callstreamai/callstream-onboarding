import * as cheerio from "cheerio";

export interface FetchResult {
  url: string;
  html: string;
  text: string;
  title: string;
  status: number;
  method: "http" | "playwright";
}

// Priority page patterns for hospitality properties
const PRIORITY_PATTERNS = [
  /ameniti/i, /floor.?plan/i, /pric/i, /rat/i,
  /faq/i, /question/i, /neighbor/i, /area/i, /location/i,
  /contact/i, /polic/i, /pet/i, /park/i, /fee/i,
  /deposit/i, /lease/i, /appl/i, /tour/i, /schedul/i,
  /special/i, /promot/i, /deal/i, /offer/i,
  /room/i, /suite/i, /unit/i, /avail/i,
  /menu/i, /dining/i, /spa/i, /pool/i, /fitness/i,
  /gallery/i, /photo/i, /virtual/i,
  /book/i, /reserv/i, /check.?in/i,
  /about/i, /team/i, /manage/i,
  /event/i, /meeting/i, /wedding/i, /group/i,
];

export function classifyPageType(url: string, title: string): string | null {
  const combined = `${url} ${title}`.toLowerCase();
  if (/ameniti/i.test(combined)) return "amenities";
  if (/floor.?plan/i.test(combined)) return "floor_plans";
  if (/pric|rat/i.test(combined)) return "pricing";
  if (/faq|question/i.test(combined)) return "faq";
  if (/neighbor|area|location/i.test(combined)) return "neighborhood";
  if (/contact/i.test(combined)) return "contact";
  if (/polic|pet|park|fee|deposit|lease/i.test(combined)) return "policies";
  if (/room|suite|unit|avail/i.test(combined)) return "units";
  if (/menu|dining|restaurant/i.test(combined)) return "dining";
  if (/spa|pool|fitness/i.test(combined)) return "wellness";
  if (/gallery|photo|virtual/i.test(combined)) return "gallery";
  if (/book|reserv|check.?in/i.test(combined)) return "booking";
  if (/event|meeting|wedding|group/i.test(combined)) return "events";
  if (/about|team|manage/i.test(combined)) return "about";
  if (/special|promot|deal|offer/i.test(combined)) return "specials";
  return null;
}

export function isPriorityUrl(url: string): boolean {
  return PRIORITY_PATTERNS.some((p) => p.test(url));
}

export async function fetchPage(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CallStreamBot/1.0; +https://callstreamai.com)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);

    const html = await res.text();
    const $ = cheerio.load(html);

    // Remove scripts, styles, nav, footer noise
    $("script, style, nav, footer, header, iframe, noscript").remove();

    const title = $("title").text().trim() || $("h1").first().text().trim() || "";
    const text = $("body").text().replace(/\s+/g, " ").trim();

    return {
      url,
      html,
      text: text.slice(0, 50000), // cap at 50k chars
      title,
      status: res.status,
      method: "http",
    };
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

export function extractLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const base = new URL(baseUrl);
  const links = new Set<string>();

  $("a[href]").each((_, el) => {
    try {
      const href = $(el).attr("href") || "";
      if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      const resolved = new URL(href, baseUrl);
      // Only same-domain links
      if (resolved.hostname === base.hostname) {
        // Normalize: remove hash, trailing slash
        resolved.hash = "";
        let clean = resolved.toString().replace(/\/+$/, "");
        links.add(clean);
      }
    } catch {
      // skip invalid URLs
    }
  });

  return Array.from(links);
}
