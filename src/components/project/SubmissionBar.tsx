"use client";
import { useEffect, useState } from "react";
export default function SubmissionBar({
  jobId,
  revision,
}: {
  jobId: string;
  revision: number;
}) {
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    const r = await fetch(`/api/jobs/${jobId}/submission`);
    if (r.ok) setData(await r.json());
  }
  useEffect(() => {
    load().catch(() => setError("Could not load submission status."));
  }, [jobId, revision]);
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/jobs/${jobId}/submission`, {
        method: "POST",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="cs-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-medium">
            {data?.propertyName || "Your property"} · Shared workspace
          </p>
          <p className="text-sm text-cs-text-secondary mt-2">
            1. Add files to folders &nbsp; 2. Submit for review &nbsp; 3. Our
            team prepares your knowledge
          </p>
        </div>
        <button
          className="cs-btn-primary"
          disabled={
            busy ||
            !data?.fileCount ||
            (!!data?.submittedAt && !data?.changedSinceSubmission)
          }
          onClick={submit}
        >
          {busy
            ? "Submitting…"
            : data?.submittedAt && !data?.changedSinceSubmission
              ? "Submitted for review"
              : "Submit files for review"}
        </button>
      </div>
      <p role="status" className="text-xs text-cs-text-muted">
        {data?.submittedAt
          ? `Submitted ${new Date(data.submittedAt).toLocaleString()}.${data.changedSinceSubmission ? " Sources have changed. Submit again when your files are ready." : " Our team will review your submission."}`
          : "Upload all available property documents, then submit them together. You can add more files later."}
      </p>
      {error && (
        <p role="alert" className="text-sm text-cs-accent-red">
          {error}
        </p>
      )}
    </section>
  );
}
