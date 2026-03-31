"use client";

import { useState } from "react";
import { Check, Pencil, X, RotateCcw } from "lucide-react";
import type { ExtractionField } from "@/types";
import { SourceSnippetView } from "./SourceSnippet";

interface Props {
  field: ExtractionField;
  onAccept: (fieldName: string) => void;
  onEdit: (fieldName: string, newValue: unknown) => void;
  onReject: (fieldName: string) => void;
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (Array.isArray(val)) {
    if (val.length === 0) return "—";
    if (typeof val[0] === "string") return val.join(", ");
    return JSON.stringify(val, null, 2);
  }
  if (typeof val === "object") return JSON.stringify(val, null, 2);
  return String(val);
}

function confidenceColor(c: number): string {
  if (c >= 0.8) return "text-cs-accent-green";
  if (c >= 0.6) return "text-cs-accent-blue";
  if (c >= 0.4) return "text-cs-accent-orange";
  return "text-cs-accent-red";
}

function statusBadge(status: ExtractionField["status"]): {
  bg: string;
  text: string;
  label: string;
} {
  switch (status) {
    case "accepted":
      return { bg: "bg-cs-accent-green/10", text: "text-cs-accent-green", label: "ACCEPTED" };
    case "edited":
      return { bg: "bg-cs-accent-blue/10", text: "text-cs-accent-blue", label: "EDITED" };
    case "rejected":
      return { bg: "bg-cs-accent-red/10", text: "text-cs-accent-red", label: "REJECTED" };
    default:
      return { bg: "bg-cs-card", text: "text-cs-text-muted", label: "PENDING" };
  }
}

export function FieldReview({ field, onAccept, onEdit, onReject }: Props) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(formatValue(field.extracted_value));
  const [showSources, setShowSources] = useState(false);
  const badge = statusBadge(field.status);

  const displayValue =
    field.status === "edited"
      ? formatValue(field.edited_value)
      : formatValue(field.extracted_value);

  return (
    <div className="cs-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-cs-border">
        <div className="flex items-center gap-3">
          <span className="cs-label text-[11px]">
            {field.field_name.replace(/_/g, " ")}
          </span>
          <span className={`cs-badge ${badge.bg} ${badge.text}`}>
            {badge.label}
          </span>
        </div>
        <span className={`text-xs font-mono ${confidenceColor(field.confidence)}`}>
          {Math.round(field.confidence * 100)}%
        </span>
      </div>

      {/* Value */}
      <div className="px-4 py-3">
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="cs-input font-mono text-xs min-h-[60px] resize-y"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  try {
                    const parsed = JSON.parse(editValue);
                    onEdit(field.field_name, parsed);
                  } catch {
                    onEdit(field.field_name, editValue);
                  }
                  setEditing(false);
                }}
                className="cs-btn-primary text-xs py-1.5 px-3"
              >
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="cs-btn-ghost text-xs py-1.5 px-3"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <pre className="text-sm text-cs-text-primary whitespace-pre-wrap font-sans">
            {displayValue}
          </pre>
        )}
      </div>

      {/* Sources toggle */}
      {field.source_snippets.length > 0 && (
        <div className="px-4 pb-2">
          <button
            onClick={() => setShowSources(!showSources)}
            className="text-xs text-cs-accent-blue hover:underline"
          >
            {showSources ? "Hide" : "Show"} {field.source_snippets.length} source(s)
          </button>
          {showSources && (
            <div className="mt-2 space-y-2">
              {field.source_snippets.map((snippet, i) => (
                <SourceSnippetView key={i} snippet={snippet} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {field.status === "pending" && (
        <div className="flex border-t border-cs-border">
          <button
            onClick={() => onAccept(field.field_name)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs
                       text-cs-accent-green hover:bg-cs-accent-green/5 transition-colors"
          >
            <Check size={14} />
            Accept
          </button>
          <div className="w-px bg-cs-border" />
          <button
            onClick={() => setEditing(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs
                       text-cs-accent-blue hover:bg-cs-accent-blue/5 transition-colors"
          >
            <Pencil size={14} />
            Edit
          </button>
          <div className="w-px bg-cs-border" />
          <button
            onClick={() => onReject(field.field_name)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs
                       text-cs-accent-red hover:bg-cs-accent-red/5 transition-colors"
          >
            <X size={14} />
            Reject
          </button>
        </div>
      )}

      {field.status !== "pending" && (
        <div className="flex border-t border-cs-border">
          <button
            onClick={() => {
              onEdit(field.field_name, field.extracted_value);
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs
                       text-cs-text-muted hover:bg-cs-card transition-colors"
          >
            <RotateCcw size={14} />
            Reset to pending
          </button>
        </div>
      )}
    </div>
  );
}
