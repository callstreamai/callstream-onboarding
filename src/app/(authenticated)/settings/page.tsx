"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

type Status = "checking" | "ok" | "error" | "idle";

function StatusBadge({ status, label }: { status: Status; label?: string }) {
  if (status === "checking") return (
    <div className="flex items-center gap-1.5 text-cs-text-muted text-xs">
      <Loader2 size={12} className="animate-spin" /> Checking...
    </div>
  );
  if (status === "ok") return (
    <div className="flex items-center gap-1.5 text-cs-accent-green text-xs">
      <CheckCircle2 size={12} /> {label || "Connected"}
    </div>
  );
  if (status === "error") return (
    <div className="flex items-center gap-1.5 text-cs-accent-red text-xs">
      <XCircle size={12} /> {label || "Not configured"}
    </div>
  );
  return null;
}

export default function SettingsPage() {
  const { isAdmin, isLoading } = useAuth();
  const router = useRouter();

  const [supabaseStatus, setSupabaseStatus] = useState<Status>("checking");
  const [openaiStatus, setOpenaiStatus] = useState<Status>("checking");
  const [blandStatus, setBlandStatus] = useState<Status>("checking");
  const [blandVoiceCount, setBlandVoiceCount] = useState<number | null>(null);
  const [supabaseUrl, setSupabaseUrl] = useState<string>("");

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.push("/");
    }
  }, [isAdmin, isLoading]);

  useEffect(() => {
    if (!isAdmin) return;

    // Check Supabase
    fetch("/api/settings/status")
      .then((r) => r.json())
      .then((data) => {
        setSupabaseStatus(data.supabase ? "ok" : "error");
        setOpenaiStatus(data.openai ? "ok" : "error");
        setSupabaseUrl(data.supabaseUrl || "");
      })
      .catch(() => {
        setSupabaseStatus("error");
        setOpenaiStatus("error");
      });

    // Check Bland (reuse the voices endpoint)
    fetch("/api/bland/voices")
      .then((r) => r.json())
      .then((data) => {
        const voices = data.voices || [];
        setBlandStatus(voices.length > 0 ? "ok" : "error");
        setBlandVoiceCount(voices.length);
      })
      .catch(() => setBlandStatus("error"));
  }, [isAdmin]);

  if (isLoading || !isAdmin) return null;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>
      <div className="max-w-xl space-y-6">

        {/* Supabase */}
        <div className="cs-card p-5">
          <p className="cs-label mb-1">SUPABASE CONNECTION</p>
          <p className="text-xs text-cs-text-muted mb-4">Database and authentication provider.</p>
          <div className="space-y-3">
            <div>
              <label className="cs-label block mb-1.5">PROJECT URL</label>
              <input
                type="text"
                value={supabaseUrl || ""}
                placeholder="https://xxxx.supabase.co"
                className="cs-input"
                disabled
              />
            </div>
            <div>
              <label className="cs-label block mb-1.5">STATUS</label>
              <StatusBadge status={supabaseStatus} label="Connected" />
            </div>
          </div>
        </div>

        {/* OpenAI */}
        <div className="cs-card p-5">
          <p className="cs-label mb-1">OPENAI API</p>
          <p className="text-xs text-cs-text-muted mb-4">Used for AI document extraction when files are uploaded to workspace spaces.</p>
          <div className="space-y-3">
            <div>
              <label className="cs-label block mb-1.5">API KEY</label>
              <input type="password" placeholder="sk-..." className="cs-input" disabled />
            </div>
            <div>
              <label className="cs-label block mb-1.5">STATUS</label>
              <StatusBadge status={openaiStatus} label="Configured" />
            </div>
            <div>
              <label className="cs-label block mb-1.5">MODEL</label>
              <p className="text-sm text-cs-text-secondary">GPT-4o (extraction) + GPT-4o-mini (confidence)</p>
            </div>
          </div>
        </div>

        {/* Bland */}
        <div className="cs-card p-5">
          <p className="cs-label mb-1">BLAND AI</p>
          <p className="text-xs text-cs-text-muted mb-4">Powers the Voice Preview — fetches curated voices and generates audio samples.</p>
          <div className="space-y-3">
            <div>
              <label className="cs-label block mb-1.5">API KEY</label>
              <input type="password" placeholder="sk-bland-..." className="cs-input" disabled />
            </div>
            <div>
              <label className="cs-label block mb-1.5">STATUS</label>
              <StatusBadge
                status={blandStatus}
                label={blandVoiceCount !== null ? blandVoiceCount + " curated voices available" : "Connected"}
              />
            </div>
            <div>
              <label className="cs-label block mb-1.5">VOICES</label>
              <p className="text-sm text-cs-text-secondary">Bland Curated (V2 / V3) only</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
