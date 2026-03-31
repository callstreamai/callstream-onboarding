"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ExtractionField, OnboardingJob } from "@/types";
import { FieldReview } from "./FieldReview";
import { Spinner } from "@/components/ui/Spinner";
import { StatCard } from "@/components/ui/StatCard";
import { Check, RotateCcw } from "lucide-react";

interface Props {
  jobId: string;
}

export function ExtractionPanel({ jobId }: Props) {
  const [fields, setFields] = useState<ExtractionField[]>([]);
  const [job, setJob] = useState<OnboardingJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, [jobId]);

  async function fetchData() {
    try {
      const [jobRes, fieldsRes] = await Promise.all([
        fetch(`/api/jobs/${jobId}`),
        fetch(`/api/jobs/${jobId}?include=fields`),
      ]);

      if (jobRes.ok) {
        const jobData = await jobRes.json();
        setJob(jobData.job);
      }
      if (fieldsRes.ok) {
        const fieldsData = await fieldsRes.json();
        setFields(fieldsData.fields || []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function updateField(
    fieldName: string,
    action: "accept" | "edit" | "reject",
    newValue?: unknown
  ) {
    const res = await fetch(`/api/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fieldName, action, newValue }),
    });

    if (res.ok) {
      setFields((prev) =>
        prev.map((f) =>
          f.field_name === fieldName
            ? {
                ...f,
                status: action === "accept" ? "accepted" : action === "edit" ? "edited" : "rejected",
                edited_value: action === "edit" ? newValue : f.edited_value,
              }
            : f
        )
      );
    }
  }

  async function approveAll() {
    setSaving(true);
    const res = await fetch(`/api/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve_all" }),
    });

    if (res.ok) {
      setFields((prev) =>
        prev.map((f) =>
          f.status === "pending" ? { ...f, status: "accepted" } : f
        )
      );
    }
    setSaving(false);
  }

  async function rerunExtraction() {
    setSaving(true);
    await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, rerun: true }),
    });
    await fetchData();
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={28} />
      </div>
    );
  }

  const pending = fields.filter((f) => f.status === "pending").length;
  const accepted = fields.filter((f) => f.status === "accepted").length;
  const edited = fields.filter((f) => f.status === "edited").length;
  const rejected = fields.filter((f) => f.status === "rejected").length;

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="PENDING" value={pending} color="orange" />
        <StatCard label="ACCEPTED" value={accepted} color="green" />
        <StatCard label="EDITED" value={edited} color="blue" />
        <StatCard label="REJECTED" value={rejected} color="red" />
      </div>

      {/* Actions */}
      <div className="cs-card p-4 mb-6 flex items-center justify-between">
        <p className="text-sm text-cs-text-secondary">
          {pending > 0
            ? `${pending} field(s) need review`
            : "All fields reviewed"}
        </p>
        <div className="flex gap-2">
          <button
            onClick={rerunExtraction}
            disabled={saving}
            className="cs-btn-secondary text-xs"
          >
            <RotateCcw size={14} />
            Re-run Extraction
          </button>
          {pending > 0 && (
            <button
              onClick={approveAll}
              disabled={saving}
              className="cs-btn-primary text-xs"
            >
              <Check size={14} />
              Accept All Remaining
            </button>
          )}
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-3">
        {fields.map((field) => (
          <FieldReview
            key={field.field_name}
            field={field}
            onAccept={(fn) => updateField(fn, "accept")}
            onEdit={(fn, val) => updateField(fn, "edit", val)}
            onReject={(fn) => updateField(fn, "reject")}
          />
        ))}
      </div>

      {fields.length === 0 && (
        <div className="cs-card p-8 text-center">
          <p className="text-cs-text-muted">
            No extraction data yet. Run processing first.
          </p>
        </div>
      )}
    </div>
  );
}
