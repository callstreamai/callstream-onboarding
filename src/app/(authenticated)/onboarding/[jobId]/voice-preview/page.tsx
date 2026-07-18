"use client";

import { useParams } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Play, Loader2, Volume2, Mic } from "lucide-react";
import JobTabs from "@/components/project/JobTabs";

interface BlandVoice {
  id: string;
  name: string;
  description?: string;
  preview_url?: string;
}

export default function ReviewPage() {
  const params = useParams();
  const jobId = params.jobId as string;

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
    "I will transfer you to housekeeping right away.",
    "Your room is ready — shall I send up a welcome amenity?",
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
    <div className="max-w-4xl">
      {/* Top nav */}
      <JobTabs jobId={jobId} />

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-lg bg-cs-accent-blue/15 flex items-center justify-center">
            <Mic size={18} className="text-cs-accent-blue" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-cs-text-primary">Voice Preview</h1>
            <p className="text-xs text-cs-text-muted mt-0.5">Type anything and hear how your Callstream AI voice sounds.</p>
          </div>
        </div>
      </div>

      {/* Text input */}
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
                className="text-[10px] px-2.5 py-1 rounded-full bg-cs-border/60 text-cs-text-muted hover:text-cs-text-secondary hover:bg-cs-border transition"
              >
                {p.length > 40 ? p.slice(0, 40) + "..." : p}
              </button>
            ))}
          </div>
          <span className="text-[10px] text-cs-text-muted ml-3 flex-shrink-0">{text.length}/300</span>
        </div>
      </div>

      {/* Voice grid */}
      <div className="cs-card p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <label className="cs-label">CHOOSE A VOICE</label>
          {selectedVoice && (
            <span className="text-[10px] text-cs-accent-blue">
              {voices.find((v) => v.id === selectedVoice)?.name} selected
            </span>
          )}
        </div>

        {loadingVoices ? (
          <div className="flex items-center gap-2 text-cs-text-muted text-sm py-6">
            <Loader2 size={14} className="animate-spin" />
            Loading voices...
          </div>
        ) : voices.length === 0 ? (
          <p className="text-sm text-cs-text-muted py-4">No voices available. Contact your admin to configure BLAND_API_KEY.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {voices.map((v) => {
              const isSelected = selectedVoice === v.id;
              const isPlaying = activePreview === v.id && loading;
              return (
                <button
                  key={v.id}
                  onClick={() => playVoice(v.id, v.preview_url)}
                  className={
                    "flex items-center justify-between p-3 rounded-lg border text-left transition " +
                    (isSelected
                      ? "border-cs-accent-blue bg-cs-accent-blue/10"
                      : "border-cs-border hover:border-cs-border/80 bg-cs-bg hover:bg-cs-card")
                  }
                >
                  <div className="min-w-0 mr-2">
                    <p className={"text-xs font-medium truncate " + (isSelected ? "text-cs-accent-blue" : "text-cs-text-primary")}>
                      {v.name}
                    </p>
                    {v.description && (
                      <p className="text-[10px] text-cs-text-muted mt-0.5 truncate">{v.description}</p>
                    )}
                  </div>
                  <div className={
                    "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition " +
                    (isSelected ? "bg-cs-accent-blue/20" : "bg-cs-border/50")
                  }>
                    {isPlaying
                      ? <Loader2 size={10} className="animate-spin text-cs-accent-blue" />
                      : <Play size={10} className={isSelected ? "text-cs-accent-blue" : "text-cs-text-muted"} />
                    }
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Hear it button */}
      <button
        onClick={handleHearIt}
        disabled={!text.trim() || !selectedVoice || loading}
        className="cs-btn-primary w-full py-3 text-sm"
      >
        {loading
          ? <><Loader2 size={14} className="animate-spin" /> Generating audio...</>
          : <><Volume2 size={15} /> Hear it</>
        }
      </button>

      <audio ref={audioRef} onEnded={() => setActivePreview(null)} className="hidden" />
    </div>
  );
}
