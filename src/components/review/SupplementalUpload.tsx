"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, FileText, Check } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";

interface Props {
  jobId: string;
  onUploadComplete: () => void;
}

const ACCEPTED_TYPES = {
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "text/plain": [".txt"],
  "text/csv": [".csv"],
};

export function SupplementalUpload({ jobId, onUploadComplete }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const onDrop = useCallback((accepted: File[]) => {
    setFiles((prev) => [...prev, ...accepted]);
    setResult(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: 25 * 1024 * 1024,
  });

  async function handleUpload() {
    if (files.length === 0) return;
    setUploading(true);
    setResult(null);

    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file);
    }

    try {
      const res = await fetch(`/api/jobs/${jobId}/files`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setResult({ success: true, message: `${data.filesAdded} file(s) added. Re-run extraction to include new content.` });
        setFiles([]);
        onUploadComplete();
      } else {
        setResult({ success: false, message: data.error || "Upload failed" });
      }
    } catch {
      setResult({ success: false, message: "Upload failed" });
    }

    setUploading(false);
  }

  return (
    <div className="cs-card p-5">
      <p className="cs-label mb-3">ADD MORE FILES</p>

      <div
        {...getRootProps()}
        className={`border border-dashed border-cs-border rounded-md p-4 text-center cursor-pointer transition-colors
          ${isDragActive ? "border-cs-accent-blue bg-cs-accent-blue/5" : "hover:border-cs-border-hover"}`}
      >
        <input {...getInputProps()} />
        <Upload size={20} className="mx-auto text-cs-text-muted mb-2" />
        <p className="text-xs text-cs-text-secondary">
          Drop additional files here (PDF, images, text)
        </p>
      </div>

      {files.length > 0 && (
        <div className="mt-3 space-y-1">
          {files.map((file, i) => (
            <div key={i} className="flex items-center justify-between bg-cs-surface rounded px-3 py-1.5">
              <span className="text-xs text-cs-text-primary flex items-center gap-2">
                <FileText size={12} /> {file.name}
              </span>
              <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-cs-text-muted hover:text-cs-accent-red">
                <X size={12} />
              </button>
            </div>
          ))}
          <button onClick={handleUpload} disabled={uploading} className="cs-btn-primary text-xs mt-2">
            {uploading ? <><Spinner size={12} /> Uploading...</> : <><Upload size={12} /> Upload {files.length} file(s)</>}
          </button>
        </div>
      )}

      {result && (
        <div className={`mt-3 text-xs flex items-center gap-1.5 ${result.success ? "text-cs-accent-green" : "text-cs-accent-red"}`}>
          {result.success ? <Check size={12} /> : <X size={12} />}
          {result.message}
        </div>
      )}
    </div>
  );
}
