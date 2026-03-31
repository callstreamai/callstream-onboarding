"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useOnboardingStore } from "@/lib/store";
import { Upload, X, FileText, Image, ArrowRight, ArrowLeft } from "lucide-react";

const ACCEPTED_TYPES = {
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "text/plain": [".txt"],
  "text/csv": [".csv"],
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ type }: { type: string }) {
  if (type.startsWith("image/")) return <Image size={16} className="text-cs-accent-purple" />;
  return <FileText size={16} className="text-cs-accent-blue" />;
}

export function FileUploadStep() {
  const { files, addFiles, removeFile, setStep } = useOnboardingStore();

  const onDrop = useCallback(
    (accepted: File[]) => {
      addFiles(accepted);
    },
    [addFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: 25 * 1024 * 1024, // 25 MB
  });

  const handleContinue = () => {
    setStep("processing");
  };

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-cs-card border border-cs-border rounded-lg">
          <Upload size={20} className="text-cs-accent-purple" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-cs-text-primary">
            Upload Documents
          </h2>
          <p className="text-sm text-cs-text-secondary">
            PDFs, brochures, floor plans, policy docs, images
          </p>
        </div>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`
          cs-card p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? "border-cs-accent-blue bg-cs-accent-blue/5" : "hover:border-cs-border-hover"}
        `}
      >
        <input {...getInputProps()} />
        <Upload size={32} className="mx-auto text-cs-text-muted mb-3" />
        <p className="text-sm text-cs-text-primary">
          {isDragActive
            ? "Drop files here..."
            : "Drag & drop files here, or click to browse"}
        </p>
        <p className="text-xs text-cs-text-muted mt-1">
          PDF, PNG, JPG, WEBP, TXT, CSV — up to 25 MB each
        </p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="cs-label">UPLOADED FILES ({files.length})</p>
          {files.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="cs-card flex items-center gap-3 px-3 py-2.5"
            >
              <FileIcon type={file.type} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-cs-text-primary truncate">
                  {file.name}
                </p>
                <p className="text-xs text-cs-text-muted">
                  {formatSize(file.size)}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(i);
                }}
                className="text-cs-text-muted hover:text-cs-accent-red transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <button onClick={() => setStep("url_input")} className="cs-btn-ghost">
          <ArrowLeft size={16} />
          Back
        </button>
        <button onClick={handleContinue} className="cs-btn-primary">
          Start Processing
          <ArrowRight size={16} />
        </button>
      </div>

      {files.length === 0 && (
        <p className="text-xs text-cs-text-muted mt-3">
          No files? No problem — you can skip this step and we will extract data from your website only.
        </p>
      )}
    </div>
  );
}
