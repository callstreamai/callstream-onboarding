import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 120; // Allow up to 2 minutes

interface RawEvent {
  title: string;
  date_text: string;
  venue: string;
  schedule_text: string;
  url: string;
}

// Classify event type from schedule text
function classifyEvent(schedule: string): string {
  const s = schedule.toLowerCase().trim();
  if (/month of|all month|entire month/i.test(s)) return "all_month";
  if (/^daily$|every day|daily(?:\s|$)/i.test(s)) return "daily";
  if (/monday|tuesday|wednesday|thursday|friday|saturday|sunday/i.test(s)) {
    if (/,|&|and|-|through/i.test(s) || /s\b/.test(s)) return "recurring_weekly";
    // Check if it's a specific date like "Friday, April 24"
    if (/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d/i.test(s)) {
      return "one_time";
    }
    return "recurring_weekly";
  }
  if (/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d/i.test(s)) {
    return "one_time";
  }
  if (/^\w+days$/i.test(s)) return "recurring_weekly";
  return "one_time";
}

// Parse day names to day-of-week indices (0=Sun, 1=Mon, ..., 6=Sat)
function parseDayNames(text: string): number[] {
  const dayMap: Record<string, number> = {
    sunday: 0, sundays: 0, sun: 0,
    monday: 1, mondays: 1, mon: 1,
    tuesday: 2, tuesdays: 2, tue: 2,
    wednesday: 3, wednesdays: 3, wed: 3,
    thursday: 4, thursdays: 4, thu: 4,
    friday: 5, fridays: 5, fri: 5,
    saturday: 6, saturdays: 6, sat: 6,
  };
  const days: number[] = [];
  const lower = text.toLowerCase();

  // Handle ranges like "Thursday - Saturday"
  const rangeMatch = lower.match(/(\w+)\s*[-–]\s*(\w+)/);
  if (rangeMatch) {
    const start = dayMap[rangeMatch[1]];
    const end = dayMap[rangeMatch[2]];
    if (start !== undefined && end !== undefined) {
      let d = start;
      while (true) {
        days.push(d);
        if (d === end) break;
        d = (d + 1) % 7;
      }
      return days;
    }
  }

  // Handle lists like "Mondays", "Fridays & Saturdays"
  for (const [name, idx] of Object.entries(dayMap)) {
    if (lower.includes(name)) {
      if (!days.includes(idx)) days.push(idx);
    }
  }
  return days;
}

// Get all dates in a month matching certain day-of-week indices
function getDatesForDays(year: number, month: number, dayIndices: number[]): string[] {
  const dates: string[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    if (dayIndices.includes(date.getDay())) {
      dates.push(date.toISOString().split("T")[0]);
    }
  }
  return dates;
}

// Get all dates in a month
function getAllDatesInMonth(year: number, month: number): string[] {
  const dates: string[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    dates.push(new Date(year, month - 1, d).toISOString().split("T")[0]);
  }
  return dates;
}

// Parse specific date like "April 16" or "Friday, April 24"
function parseSpecificDate(text: string, year: number): string | null {
  const monthMap: Record<string, number> = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  };
  const match = text.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})/i);
  if (match) {
    const month = monthMap[match[1].toLowerCase()];
    const day = parseInt(match[2]);
    if (month && day) {
      return new Date(year, month - 1, day).toISOString().split("T")[0];
    }
  }
  return null;
}

function generateVoiceDescription(ev: { title: string; venue: string; recurrence: string; event_type: string }): string {
  const venue = ev.venue ? " at " + ev.venue : "";
  switch (ev.event_type) {
    case "daily":
      return ev.title + " is held daily" + venue + ".";
    case "recurring_weekly":
      return ev.title + " takes place " + ev.recurrence.toLowerCase() + venue + ".";
    case "all_month":
      return ev.title + " runs all month long" + venue + ".";
    case "one_time":
      return ev.title + " is a one-time event on " + ev.recurrence + venue + ".";
    default:
      return ev.title + " is scheduled " + ev.recurrence.toLowerCase() + venue + ".";
  }
}

export async function POST(req: NextRequest) {
  const logs: string[] = [];
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    logs.push("Navigating to " + url);

    // Use the WebCrawler approach: fetch page with dynamic content handling
    // We'll use our crawl API internally, or fetch + parse
    // For the scraping, we need to handle JS-rendered content

    // Step 1: Fetch the page with dynamic content support
    logs.push("Fetching page with dynamic content support...");

    // Use a headless approach via our existing infrastructure
    // First try: fetch the page and look for event data in the HTML/JSON
    const pageRes = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    const html = await pageRes.text();
    logs.push("Page fetched — " + Math.round(html.length / 1024) + "KB");

    // Try to find JSON-LD structured data
    const jsonLdMatches = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
    let structuredEvents: any[] = [];

    if (jsonLdMatches) {
      logs.push("Found " + jsonLdMatches.length + " JSON-LD blocks");
      for (const match of jsonLdMatches) {
        try {
          const json = match.replace(/<script[^>]*>/, "").replace(/<\/script>/, "");
          const data = JSON.parse(json);
          if (data["@type"] === "Event" || (Array.isArray(data) && data[0]?.["@type"] === "Event")) {
            const items = Array.isArray(data) ? data : [data];
            structuredEvents.push(...items);
          }
        } catch {}
      }
    }

    // Try to extract events from HTML patterns
    logs.push("Parsing event cards from HTML...");

    // Common event card patterns
    const rawEvents: RawEvent[] = [];

    // Look for event cards with common CSS patterns
    // Pattern 1: Links with event titles
    const eventLinkRegex = /<a[^>]*href="([^"]*(?:event|happening)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    const cardRegex = /<(?:article|div|li)[^>]*class="[^"]*(?:event|card|listing)[^"]*"[^>]*>([\s\S]*?)<\/(?:article|div|li)>/gi;

    // Try extracting from card-like structures
    let cardMatch;
    const seenTitles = new Set<string>();
    
    // Method 1: Look for heading + detail patterns within cards
    const cardRegex2 = /<(?:article|div|li|section)[^>]*class="[^"]*(?:event|card|listing|item|post|entry)[^"]*"[^>]*>([\s\S]*?)<\/(?:article|div|li|section)>/gi;
    let cm;
    while ((cm = cardRegex2.exec(html)) !== null) {
      const card = cm[1];
      // Extract title
      const titleMatch = card.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
      if (!titleMatch) continue;
      const title = titleMatch[1].replace(/<[^>]+>/g, "").trim();
      if (!title || seenTitles.has(title.toLowerCase())) continue;
      seenTitles.add(title.toLowerCase());

      // Extract link
      const linkMatch = card.match(/<a[^>]*href="([^"]+)"[^>]*>/);
      let eventUrl = linkMatch ? linkMatch[1] : "";
      if (eventUrl && !eventUrl.startsWith("http")) {
        try {
          eventUrl = new URL(eventUrl, url).href;
        } catch {}
      }

      // Extract date/time text
      const dateMatch = card.match(/(?:date|time|when|schedule)[^>]*>([^<]+)/i) ||
                        card.match(/<(?:time|span|p|div)[^>]*class="[^"]*(?:date|time|schedule|day|month)[^"]*"[^>]*>([^<]+)/i);
      const dateText = dateMatch ? dateMatch[1].trim() : "";

      // Extract venue
      const venueMatch = card.match(/(?:venue|location|where|place)[^>]*>([^<]+)/i) ||
                         card.match(/<(?:span|p|div)[^>]*class="[^"]*(?:venue|location|place)[^"]*"[^>]*>([^<]+)/i);
      const venue = venueMatch ? venueMatch[1].trim() : "";

      // Extract schedule text
      const schedMatch = card.match(/(?:recurrence|schedule|recurring|frequency)[^>]*>([^<]+)/i) ||
                         card.match(/((?:Daily|Every|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Month of)[^<]*)/i);
      const schedule = schedMatch ? schedMatch[1].trim() : dateText;

      rawEvents.push({
        title,
        date_text: dateText,
        venue,
        schedule_text: schedule || dateText,
        url: eventUrl,
      });
    }

    // Method 2: If structured data found, use it
    if (structuredEvents.length > 0 && rawEvents.length === 0) {
      logs.push("Using JSON-LD structured data");
      for (const ev of structuredEvents) {
        const title = ev.name || "";
        if (!title || seenTitles.has(title.toLowerCase())) continue;
        seenTitles.add(title.toLowerCase());
        rawEvents.push({
          title,
          date_text: ev.startDate || "",
          venue: ev.location?.name || "",
          schedule_text: ev.startDate || "",
          url: ev.url || "",
        });
      }
    }

    // Method 3: Broader regex extraction as fallback
    if (rawEvents.length === 0) {
      logs.push("Trying broad text extraction...");
      // Look for any heading followed by date-like text
      const headingsRegex = /<h[2-4][^>]*>([^<]+)<\/h[2-4]>/gi;
      let h;
      while ((h = headingsRegex.exec(html)) !== null) {
        const title = h[1].trim();
        if (title.length < 3 || title.length > 200) continue;
        if (seenTitles.has(title.toLowerCase())) continue;
        seenTitles.add(title.toLowerCase());
        rawEvents.push({
          title,
          date_text: "",
          venue: "",
          schedule_text: "",
          url: "",
        });
      }
    }

    logs.push("Extracted " + rawEvents.length + " event cards");

    // Determine target month/year
    const now = new Date();
    const targetYear = now.getFullYear();
    const targetMonth = now.getMonth() + 1;
    const monthNames = ["", "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    const monthLabel = monthNames[targetMonth] + " " + targetYear;

    logs.push("Target month: " + monthLabel);

    // Try to extract hotel/property name from page
    const titleTag = html.match(/<title>([^<]+)<\/title>/i);
    const ogSiteName = html.match(/<meta[^>]*property="og:site_name"[^>]*content="([^"]+)"/i);
    let hotelName = ogSiteName ? ogSiteName[1] : (titleTag ? titleTag[1].split("|")[0].split("-")[0].trim() : "");

    logs.push("Property: " + (hotelName || "Unknown"));

    // Process events
    logs.push("Classifying events and expanding dates...");

    const events = rawEvents.map((raw, i) => {
      const eventType = classifyEvent(raw.schedule_text || raw.date_text);
      let datesInMonth: string[] = [];
      let recurrence = raw.schedule_text || raw.date_text || "Unknown schedule";

      switch (eventType) {
        case "daily":
        case "all_month":
          datesInMonth = getAllDatesInMonth(targetYear, targetMonth);
          break;
        case "recurring_weekly": {
          const dayIndices = parseDayNames(raw.schedule_text || raw.date_text);
          datesInMonth = getDatesForDays(targetYear, targetMonth, dayIndices);
          if (datesInMonth.length === 0) {
            datesInMonth = getAllDatesInMonth(targetYear, targetMonth);
          }
          break;
        }
        case "one_time": {
          const specificDate = parseSpecificDate(raw.schedule_text || raw.date_text, targetYear);
          if (specificDate) {
            datesInMonth = [specificDate];
          }
          break;
        }
      }

      const event = {
        id: i + 1,
        title: raw.title,
        event_type: eventType,
        venue: raw.venue,
        recurrence,
        dates_in_month: datesInMonth,
        voice_description: "",
        url: raw.url,
      };

      event.voice_description = generateVoiceDescription(event);

      return event;
    });

    // Build daily calendar
    const dailyCalendar: Record<string, number[]> = {};
    for (const ev of events) {
      for (const date of ev.dates_in_month) {
        if (!dailyCalendar[date]) dailyCalendar[date] = [];
        dailyCalendar[date].push(ev.id);
      }
    }

    const result = {
      source: url,
      hotel: hotelName,
      month: monthLabel,
      last_updated: new Date().toISOString(),
      unique_events: events.length,
      events,
      daily_calendar: dailyCalendar,
    };

    logs.push("Built daily calendar for " + Object.keys(dailyCalendar).length + " days");
    logs.push("Generated " + events.length + " voice descriptions");

    return NextResponse.json({ result, logs });
  } catch (err: any) {
    logs.push("Error: " + err.message);
    return NextResponse.json({ error: err.message, logs }, { status: 500 });
  }
}
