"use client";

import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { Activity, Kanban, ClipboardCheck, FolderOpen, Play, Loader2, Volume2, Mic } from "lucide-react";

interface BlandVoice {
  id: string;
  name: string;
  description?: string;
  preview_url?: string;
}

export default function ReviewPage() {
  const params = useParams();
  const jobId = params.jobId as string;
  const pathname = usePathname();

  const [text, setText] = useState("");
  const [voices, setVoices] = useState<BlandVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [activePreview, setActivePreview] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const SAMPLE_PROMPTS = [
    "Thank you for calling. How can I assist you today?",
    "Your reservation has been confirmed for this evening.",
    "I can connect you with our front desk right away.",
    "Welcome! Is this your first time staying with us?",
  ];

  const tabs = [
    { label: "Status", href: "/onboarding/" + jobId + "/status", icon: Activity },
    { label: "Workspace", href: "/onboarding/" + jobId + "/workspace", icon: FolderOpen },
    { label: "Project", href: "/onboarding/" + jobId + "/project", icon: Kanban },
    { label: "Review", href: "/onboarding/" + jobId + "/review", icon: ClipboardCheck },
  ];

  useEffect(() => {
    fetch("/api/bland/voices")
      .then((r) => r.json())
      .then((data) => {
        setVoices(data.voices || []);
        if (data.voices?.length > 0) setSelectedVoice(data.voices[0].id);
      })
      .catch(() => {})
      .finally(() => setLoadingVoices(false));
  }, []);

  async function playVoice(voiceId: string, previewUrl?: string) {
    setActivePreview(voiceId);
    setSelectedVoice(voiceId);

    if (previewUrl) {
      if (audioRef.current) {
        audioRef.current.src = previewUrl;
        audioRef.current.play().catch(() => {});
      }
      return;
    }

    const sample = text.trim() || SAMPLE_PROMPTS[0];
    setLoading(true);
    try {
      const res = await fetch("/api/bland/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sample, voice: voiceId }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.play().catch(() => {});
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleHearIt() {
    if (!text.trim() || !selectedVoice) return;
    setLoading(true);
    try {
      const res = await fetch("/api/bland/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: selectedVoice }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.play().catch(() => {});
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-1 border-b border-cs-border mb-6">
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={
                "flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 -mb-px transition " +
                (active
                  ? "border-cs-accent-blue text-cs-accent-blue"
                  : "border-transparent text-cs-text-muted hover:text-cs-text-secondary")
              }
            >
              <t.icon size={14} />
              {t.label}
            </Link>
          );
        })}
      </div>

      <div className="max-w-3xl">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Mic size={18} className="text-cs-accent-blue" />
            <h2 className="text-lg font-semibold text-cs-text-primary">Voice Preview</h2>
          </div>
          <p className="text-sm text-cs-text-muted">Type anything and hear how your Callstream AI voice sounds. Pick a voice and press play.</p>
        </div>

        <div className="cs-card p-5 mb-4">
          <label className="cs-label block mb-2">YOUR TEXT</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type what you want to hear..."
            className="cs-input h-24 resize-none w-full mb-3"
            maxLength={300}
          />
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {SAMPLE_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => setText(p)}
                  className="text-[10px] px-2 py-1 rounded bg-cs-border/50 text-cs-text-muted hover:text-cs-text-secondary hover:bg-cs-border transition"
                >
                  {p.length > 38 ? p.slice(0, 38) + "..." : p}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-cs-text-muted">{text.length}/300</span>
          </div>
        </div>

        <div className="cs-card p-5 mb-4">
          <label className="cs-label block mb-3">CHOOSE A VOICE</label>
          {loadingVoices ? (
            <div className="flex items-center gap-2 text-cs-text-muted text-sm py-4">
              <Loader2 size={14} className="animate-spin" />
              Loading voices...
            </div>
          ) : voices.length === 0 ? (
            <p className="text-sm text-cs-text-muted py-4">
              No voices available. Contact your admin to configure BLAND_API_KEY.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {voices.map((v) => (
                <button
                  key={v.id}
                  onClick={() => playVoice(v.id, v.preview_url)}
                  className={
                    "flex items-center justify-between p-3 rounded-lg border text-left transition " +
                    (selectedVoice === v.id
                      ? "border-cs-accent-blue bg-cs-accent-blue/10"
                      : "border-cs-border hover:border-cs-border/60 bg-cs-bg")
                  }
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-cs-text-primary">{v.name}</p>
                    {v.description && (
                      <p className="text-[10px] text-cs-text-muted mt-0.5 truncate">{v.description}</p>
                    )}
                  </div>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ml-2 bg-cs-border/50">
                    {activePreview === v.id && loading
                      ? <Loader2 size={10} className="animate-spin text-cs-accent-blue" />
                      : <Play size={10} className="text-cs-text-muted" />
                    }
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleHearIt}
          disabled={!text.trim() || !selectedVoice || loading}
          className="cs-btn-primary w-full"
        >
          {loading
            ? <><Loader2 size={14} className="animate-spin" /> Generating audio...</>
            : <><Volume2 size={14} /> Hear it</>
          }
        </button>

        <audio
          ref={audioRef}
          onEnded={() => { setActivePreview(null); }}
          className="hidden"
        />
      </div>
    </div>
  );
}
