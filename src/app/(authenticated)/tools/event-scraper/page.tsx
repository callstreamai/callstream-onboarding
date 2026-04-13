"use client";

import { useState, useRef } from "react";
import {
  CalendarSearch, Play, Copy, Download, Loader2, CheckCircle2,
  AlertCircle, Clock, Globe, ChevronDown, ChevronRight,
} from "lucide-react";

interface ScrapedEvent {
  id: number;
  title: string;
  event_type: string;
  venue: string;
  recurrence: string;
  dates_in_month: string[];
  voice_description: string;
  url: string;
}

interface ScrapeResult {
  source: string;
  hotel: string;
  month: string;
  last_updated: string;
  unique_events: number;
  events: ScrapedEvent[];
  daily_calendar: Record<string, number[]>;
}

type Status = "idle" | "scraping" | "done" | "error";

export default function EventScraperPage() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [statusLog, setStatusLog] = useState<string[]>([]);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  function addLog(msg: string) {
    setStatusLog((prev) => [...prev, msg]);
    setTimeout(() => {
      logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  }

  async function handleScrape() {
    if (!url.trim()) return;
    setStatus("scraping");
    setStatusLog([]);
    setResult(null);
    setError("");
    setCopied(false);

    addLog("Starting scrape of " + url);
    addLog("Launching headless browser...");

    try {
      const res = await fetch("/api/tools/scrape-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Scrape failed");
      }

      if (data.logs) {
        for (const log of data.logs) addLog(log);
      }

      addLog("Scrape complete — " + data.result.unique_events + " unique events found");
      setResult(data.result);
      setStatus("done");
    } catch (err: any) {
      addLog("Error: " + err.message);
      setError(err.message);
      setStatus("error");
    }
  }

  function copyJson() {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadJson() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (result.hotel || "events").replace(/\s+/g, "-").toLowerCase() + "-events.json";
    a.click();
  }

  const typeColors: Record<string, string> = {
    recurring_weekly: "bg-cs-accent-blue/10 text-cs-accent-blue",
    daily: "bg-cs-accent-green/10 text-cs-accent-green",
    one_time: "bg-cs-accent-purple/10 text-cs-accent-purple",
    all_month: "bg-cs-accent-orange/10 text-cs-accent-orange",
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-cs-card border border-cs-border rounded-lg">
          <CalendarSearch size={20} className="text-cs-accent-blue" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-cs-text-primary">Event Page Scraper</h1>
          <p className="text-sm text-cs-text-muted">
            Scrape events from a property website and generate voice-AI-ready JSON
          </p>
        </div>
      </div>

      {/* URL input */}
      <div className="cs-card p-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-cs-text-muted" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && status !== "scraping") handleScrape(); }}
              placeholder="https://www.1hotels.com/south-beach/do/events"
              className="cs-input pl-9"
              disabled={status === "scraping"}
            />
          </div>
          <button
            onClick={handleScrape}
            disabled={!url.trim() || status === "scraping"}
            className="cs-btn-primary text-sm whitespace-nowrap"
          >
            {status === "scraping" ? (
              <><Loader2 size={14} className="animate-spin" /> Scraping...</>
            ) : (
              <><Play size={14} /> Scrape Events</>
            )}
          </button>
        </div>
      </div>

      {/* Status log */}
      {statusLog.length > 0 && (
        <div className="cs-card p-4">
          <div className="flex items-center gap-2 mb-2">
            {status === "scraping" && <Loader2 size={12} className="animate-spin text-cs-accent-blue" />}
            {status === "done" && <CheckCircle2 size={12} className="text-cs-accent-green" />}
            {status === "error" && <AlertCircle size={12} className="text-cs-accent-red" />}
            <span className="text-xs text-cs-text-muted uppercase tracking-wide">Status</span>
          </div>
          <div ref={logRef} className="max-h-32 overflow-y-auto space-y-0.5 font-mono">
            {statusLog.map((log, i) => (
              <p key={i} className="text-[11px] text-cs-text-secondary">
                <span className="text-cs-text-muted mr-2">[{String(i + 1).padStart(2, "0")}]</span>
                {log}
              </p>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-cs-accent-red/10 border border-cs-accent-red/30 rounded-md p-3">
          <p className="text-xs text-cs-accent-red">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Summary bar */}
          <div className="grid grid-cols-4 gap-3">
            <div className="cs-card p-3 text-center">
              <p className="text-lg font-semibold text-cs-accent-blue">{result.unique_events}</p>
              <p className="text-[10px] text-cs-text-muted uppercase">Unique Events</p>
            </div>
            <div className="cs-card p-3 text-center">
              <p className="text-lg font-semibold text-cs-text-primary">{result.hotel || "—"}</p>
              <p className="text-[10px] text-cs-text-muted uppercase">Property</p>
            </div>
            <div className="cs-card p-3 text-center">
              <p className="text-lg font-semibold text-cs-text-primary">{result.month}</p>
              <p className="text-[10px] text-cs-text-muted uppercase">Month</p>
            </div>
            <div className="cs-card p-3 text-center">
              <p className="text-lg font-semibold text-cs-text-primary">
                {Object.keys(result.daily_calendar).length}
              </p>
              <p className="text-[10px] text-cs-text-muted uppercase">Days Covered</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button onClick={copyJson} className="cs-btn-secondary text-xs">
              {copied ? <><CheckCircle2 size={13} /> Copied</> : <><Copy size={13} /> Copy JSON</>}
            </button>
            <button onClick={downloadJson} className="cs-btn-secondary text-xs">
              <Download size={13} /> Download JSON
            </button>
            <button onClick={() => setShowJson(!showJson)} className="cs-btn-ghost text-xs">
              {showJson ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              {showJson ? "Hide" : "Show"} Raw JSON
            </button>
            <button onClick={() => setShowCalendar(!showCalendar)} className="cs-btn-ghost text-xs">
              {showCalendar ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              Daily Calendar
            </button>
          </div>

          {/* Events table */}
          <div className="cs-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-cs-border">
                    <th className="text-left py-2 px-3 text-cs-text-muted font-medium">#</th>
                    <th className="text-left py-2 px-3 text-cs-text-muted font-medium">Event</th>
                    <th className="text-left py-2 px-3 text-cs-text-muted font-medium">Type</th>
                    <th className="text-left py-2 px-3 text-cs-text-muted font-medium">Venue</th>
                    <th className="text-left py-2 px-3 text-cs-text-muted font-medium">Schedule</th>
                    <th className="text-left py-2 px-3 text-cs-text-muted font-medium">Dates</th>
                  </tr>
                </thead>
                <tbody>
                  {result.events.map((ev) => (
                    <tr key={ev.id} className="border-b border-cs-border/50 hover:bg-cs-card/50">
                      <td className="py-2 px-3 text-cs-text-muted">{ev.id}</td>
                      <td className="py-2 px-3">
                        {ev.url ? (
                          <a href={ev.url} target="_blank" rel="noopener" className="text-cs-accent-blue hover:underline">
                            {ev.title}
                          </a>
                        ) : (
                          <span className="text-cs-text-primary">{ev.title}</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <span className={"text-[10px] px-1.5 py-0.5 rounded " + (typeColors[ev.event_type] || "bg-cs-card text-cs-text-muted")}>
                          {ev.event_type.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-cs-text-secondary">{ev.venue}</td>
                      <td className="py-2 px-3 text-cs-text-secondary">{ev.recurrence}</td>
                      <td className="py-2 px-3 text-cs-text-muted">{ev.dates_in_month.length} dates</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Daily calendar */}
          {showCalendar && (
            <div className="cs-card p-4">
              <p className="cs-label mb-3">DAILY CALENDAR</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                {Object.entries(result.daily_calendar)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([date, ids]) => (
                    <div key={date} className="flex items-start gap-2 py-1.5 px-2 bg-cs-surface rounded text-xs">
                      <span className="text-cs-accent-blue font-mono whitespace-nowrap">{date}</span>
                      <span className="text-cs-text-secondary">
                        {(ids as number[]).map((id) => {
                          const ev = result.events.find((e) => e.id === id);
                          return ev ? ev.title : "Event " + id;
                        }).join(", ")}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Raw JSON */}
          {showJson && (
            <div className="cs-card p-4">
              <p className="cs-label mb-2">RAW JSON OUTPUT</p>
              <pre className="text-[10px] text-cs-text-secondary bg-cs-bg p-3 rounded overflow-x-auto max-h-96 font-mono">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
