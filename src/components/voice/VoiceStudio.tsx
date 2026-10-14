"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Headphones, Loader2, Mic2, RefreshCw, Search, Volume2 } from "lucide-react";
import type { PreviewVoice } from "@/lib/voice-preview";

const samples = [
  { name: "Welcome", text: "Thank you for calling. How can I assist you today?" },
  { name: "Reservation", text: "Your reservation has been confirmed for this evening. We look forward to welcoming you." },
  { name: "Transfer", text: "Of course. Let me connect you with our front desk team. Please hold for just a moment." },
];
const pageSize = 12;

export default function VoiceStudio() {
  const [voices, setVoices] = useState<PreviewVoice[]>([]);
  const [selected, setSelected] = useState("");
  const [text, setText] = useState(samples[0].text);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState("");
  const [error, setError] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "ready" | "playing">("idle");
  const [clip, setClip] = useState("");
  const [playHint, setPlayHint] = useState("");
  const audio = useRef<HTMLAudioElement>(null);
  const request = useRef<AbortController | null>(null);
  const revision = useRef(0);
  const clipUrl = useRef("");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => controller.abort(), 20000);
    setLibraryLoading(true);
    setLibraryError("");
    (async () => {
      try {
        const res = await fetch("/api/voice/voices", { signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "The voice library could not be loaded.");
        if (!Array.isArray(data.voices)) throw new Error("The voice library could not be loaded.");
        if (!active) return;
        setVoices(data.voices);
        setSelected(current => data.voices.some((v: PreviewVoice) => v.id === current) ? current : data.voices[0]?.id || "");
      } catch (e) {
        if (!active) return;
        if (!controller.signal.aborted) setLibraryError(e instanceof Error ? e.message : "Unable to load voices.");
        else setLibraryError("Loading voices took too long. Please try again.");
      } finally { clearTimeout(timer); if (active) setLibraryLoading(false); }
    })();
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [reload]);

  useEffect(() => () => {
    revision.current++;
    request.current?.abort();
    if (clipUrl.current) URL.revokeObjectURL(clipUrl.current);
  }, []);

  function resetPreview() {
    revision.current++;
    request.current?.abort();
    request.current = null;
    audio.current?.pause();
    if (clipUrl.current) URL.revokeObjectURL(clipUrl.current);
    clipUrl.current = "";
    setClip(""); setState("idle"); setError(""); setPlayHint("");
  }

  async function preview() {
    if (request.current || !selected || !text.trim()) return;
    if (clip && audio.current) {
      audio.current.currentTime = 0;
      try { await audio.current.play(); } catch { setPlayHint("Press Play in the audio controls below to listen."); }
      return;
    }
    const id = ++revision.current;
    const controller = new AbortController();
    request.current = controller;
    const timer = setTimeout(() => controller.abort(), 35000);
    setState("loading"); setError(""); setPlayHint("");
    try {
      const res = await fetch("/api/voice/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, voice: selected }), signal: controller.signal });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || "We could not generate this preview."); }
      if (!res.headers.get("content-type")?.startsWith("audio/")) throw new Error("The voice service returned an unreadable preview. Please try again.");
      const blob = await res.blob();
      if (id !== revision.current) return;
      if (!blob.size) throw new Error("The voice service returned an empty preview. Please try again.");
      clipUrl.current = URL.createObjectURL(blob);
      setClip(clipUrl.current); setState("ready");
      // Keep playback explicit: browsers can block autoplay after a network request.
      setPlayHint("Your preview is ready. Press Play below to listen.");
    } catch (e) {
      if (id !== revision.current) return;
      setState("idle");
      setError(controller.signal.aborted ? "The preview took too long. Try again or choose another voice." : e instanceof Error ? e.message : "Unable to generate a preview. Please try again.");
    } finally {
      clearTimeout(timer);
      if (id === revision.current) request.current = null;
    }
  }

  const voice = voices.find(v => v.id === selected);
  const query = search.trim().toLowerCase();
  const filtered = voices.filter(v => (filter !== "recommended" || v.recommended) && `${v.name} ${v.description} ${v.tags.join(" ")}`.toLowerCase().includes(query));
  const visible = filtered.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="max-w-7xl mx-auto">
      <header className="mb-8 flex items-start gap-4">
        <div className="rounded-2xl bg-cs-accent-brand/10 border border-cs-accent-brand/20 p-3"><Mic2 className="text-cs-accent-brand" size={24} /></div>
        <div><p className="cs-label mb-1 text-cs-accent-brand">CALL STREAM AI / VOICE</p><h1 className="text-3xl font-semibold tracking-tight">Voice Studio</h1><p className="text-sm text-cs-text-secondary mt-2">Find the voice that feels like your brand. Try a greeting, compare voices, and listen.</p></div>
      </header>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)] gap-6 items-start">
        <section className="cs-card p-5 sm:p-6" aria-labelledby="voice-library-heading">
          <div className="flex items-center justify-between gap-3 mb-5"><div><p className="cs-label mb-1">01 / CHOOSE</p><h2 id="voice-library-heading" className="text-lg font-semibold">Your voice library</h2></div><span className="cs-badge bg-cs-border text-cs-text-secondary">{voices.length} voices</span></div>
          <label className="relative block mb-3"><Search size={16} className="absolute left-3 top-3 text-cs-text-muted" /><input aria-label="Search voices" type="search" className="cs-input pl-10" placeholder="Search name, language, or style" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} /></label>
          <div className="flex gap-2 mb-5">{[ ["all", "All voices"], ["recommended", "Curated"] ].map(([value, label]) => <button key={value} onClick={() => { setFilter(value); setPage(0); }} aria-pressed={filter === value} className={`rounded-full px-3 py-1.5 text-xs border ${filter === value ? "border-cs-accent-brand/50 text-cs-accent-brand bg-cs-accent-brand/10" : "border-cs-border text-cs-text-secondary"}`}>{label}</button>)}</div>
          {libraryLoading ? <p role="status" className="flex gap-2 items-center py-12 text-sm text-cs-text-secondary"><Loader2 size={16} className="animate-spin" />Loading your voices…</p> : libraryError ? <div role="alert" className="py-8"><p className="text-sm text-cs-accent-red mb-3">{libraryError}</p><button className="cs-btn-secondary" onClick={() => setReload(n => n + 1)}><RefreshCw size={14} />Reload voices</button></div> : <>
            <div className="grid sm:grid-cols-2 gap-3">{visible.map(v => <button key={v.id} aria-pressed={selected === v.id} onClick={() => { if (selected !== v.id) { resetPreview(); setSelected(v.id); } }} className={`rounded-xl p-4 text-left border transition-colors ${selected === v.id ? "border-cs-accent-brand/60 bg-cs-accent-brand/10" : "border-cs-border bg-cs-surface hover:border-cs-border-hover"}`}>
              <div className="flex items-center justify-between gap-2"><span className="font-medium text-sm truncate">{v.name}</span>{selected === v.id ? <Check size={16} className="shrink-0 text-cs-accent-brand" /> : <Mic2 size={16} className="shrink-0 text-cs-text-muted" />}</div>
              <p className="text-xs text-cs-text-secondary mt-2 line-clamp-2 min-h-8">{v.tags.filter(t => t !== "Call Stream Curated").slice(0, 3).join(" · ") || v.description || "Voice preview available"}</p>
              <p className="text-[10px] text-cs-text-muted mt-3">Voice preview{v.recommended ? " · Curated" : ""}</p>
            </button>)}</div>
            {!visible.length && <p className="text-sm text-cs-text-secondary py-8">{voices.length ? "No voices match these filters. Try a different search." : "No compatible voices are available for this account. Contact your administrator."}</p>}
            {filtered.length > pageSize && <div className="flex justify-between items-center mt-5 gap-2"><button className="cs-btn-secondary text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button><span className="text-xs text-cs-text-secondary">{page * pageSize + 1}–{Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length}</span><button className="cs-btn-secondary text-xs" disabled={(page + 1) * pageSize >= filtered.length} onClick={() => setPage(p => p + 1)}>Next</button></div>}
          </>}
        </section>
        <section className="cs-card p-5 sm:p-6 lg:sticky lg:top-6" aria-labelledby="preview-heading">
          <p className="cs-label mb-1">02 / MAKE IT YOURS</p><h2 id="preview-heading" className="text-lg font-semibold mb-5">Give your brand a voice</h2>
          <label htmlFor="preview-script" className="cs-label block mb-2">Preview script</label>
          <textarea id="preview-script" className="cs-input min-h-40 resize-y leading-relaxed" maxLength={300} value={text} onChange={e => { resetPreview(); setText(e.target.value); }} />
          <div className="flex flex-wrap gap-2 mt-3">{samples.map(sample => <button key={sample.name} className="text-xs rounded-full border border-cs-border px-3 py-1.5 text-cs-text-secondary hover:text-white" onClick={() => { resetPreview(); setText(sample.text); }}>{sample.name}</button>)}<span className="text-xs text-cs-text-muted ml-auto self-center">{text.length}/300</span></div>
          <div className="mt-6 mb-4 p-4 rounded-xl bg-cs-surface border border-cs-border flex gap-3 items-center"><Headphones size={22} className="text-cs-accent-brand shrink-0" /><div className="min-w-0"><p className="text-xs text-cs-text-secondary">Selected voice</p><p className="font-medium truncate mt-1">{voice?.name || "Choose a voice to begin"}</p></div></div>
          <button className="cs-btn-primary w-full py-3" disabled={state === "loading" || !selected || !text.trim() || libraryLoading || !!libraryError} onClick={preview}>{state === "loading" ? <><Loader2 size={16} className="animate-spin" />Creating your preview…</> : <><Volume2 size={16} />{clip ? "Replay preview" : error ? "Try preview again" : "Generate preview"}</>}</button>
          {state === "loading" && <button className="cs-btn-ghost w-full mt-2" onClick={resetPreview}>Cancel</button>}
          {error && <p role="alert" className="text-sm text-cs-accent-red mt-4">{error}</p>}
          <div aria-live="polite" className="text-xs text-cs-text-secondary mt-4">{state === "playing" ? "Playing your preview" : playHint || "Choose a voice, then generate a preview. This does not change your live agent."}</div>
          {clip && <audio ref={audio} src={clip} controls preload="auto" className="w-full mt-4" aria-label={`Preview of ${voice?.name || "selected voice"}`} onPlay={() => setState("playing")} onPause={() => setState("ready")} onEnded={() => setState("ready")} onError={() => { resetPreview(); setError("Your browser could not play this preview. Try generating it again."); }} />}
        </section>
      </div>
    </div>
  );
}
