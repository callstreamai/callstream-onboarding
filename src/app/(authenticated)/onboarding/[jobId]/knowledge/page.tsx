"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import JobTabs from "@/components/project/JobTabs";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { RefreshCw, BookOpen, Download, ArrowUpRight } from "lucide-react";
type Version = {
  id: string;
  source_hash: string;
  created_at: string;
  status: string;
  qa: { question: string; answer: string; sources: string[] }[];
  warnings: string[];
  canRefresh?: boolean;
  error_message?: string;
  source_manifest: { id: string; name: string }[];
};
export default function KnowledgePage() {
  const { isAdmin } = useAuth();
  const { jobId } = useParams<{ jobId: string }>();
  const [versions, setVersions] = useState<Version[]>([]);
  const [selected, setSelected] = useState("");
  const [hash, setHash] = useState("");
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [ack, setAck] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedQA, setEditedQA] = useState<Version["qa"]>([]);
  const [baseQA, setBaseQA] = useState<Version["qa"]>([]);
  const [submission, setSubmission] = useState<any>(null);
  const endpoint = `/api/jobs/${jobId}/knowledge`;
  const load = useCallback(async () => {
    const res = await fetch(endpoint);
    const d = await res.json();
    if (!res.ok) throw new Error(d.error);
    setVersions(d.versions);
    setHash(d.sourceHash);
    setCount(d.sourceCount);
    const s = await fetch(`/api/jobs/${jobId}/submission`);
    if (s.ok) setSubmission(await s.json());
  }, [endpoint, jobId]);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  const version = versions.find((v) => v.id === selected) || versions[0];
  async function post(path: string, body: unknown) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok)
      throw new Error(data.error || "The request could not be completed.");
    return data;
  }
  async function run(action: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setProgress("");
    try {
      if (action === "rescrape") {
        let id = sessionStorage.getItem(`rescrape:${jobId}`);
        if (!id) {
          id = crypto.randomUUID();
          sessionStorage.setItem(`rescrape:${jobId}`, id);
        }
        setProgress("Refreshing the website…");
        await post("/api/crawl", { jobId, rescrape: true, requestId: id });
        sessionStorage.removeItem(`rescrape:${jobId}`);
        action = "generate";
      }
      let result;
      do {
        setProgress(
          result?.pending
            ? `Preparing knowledge · ${result.completed} of ${result.total} sections saved. Keep this page open.`
            : action === "generate"
              ? "Preparing knowledge from current sources…"
              : "Checking this version…",
        );
        result = await post(endpoint, {
          action,
          versionId: version?.id,
          acknowledgeWarnings: ack,
          qa: action === "save" ? editedQA : undefined,
          baseQA: action === "save" ? baseQA : undefined,
        });
      } while (result.pending);
      if (result.versionId) setSelected(result.versionId);
      setAck(false);
      setEditing(false);
      await load();
      setProgress(
        action === "generate"
          ? "Draft ready for review."
          : "Version status updated.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
      await load().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <JobTabs jobId={jobId} propertyName={submission?.propertyName} />
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <p className="cs-label text-cs-accent-brand mb-2">
            Property workspace
          </p>
          <h1 className="text-2xl font-semibold">KB</h1>
          <p className="text-sm text-cs-text-secondary mt-2">
            Manage your knowledge base: review and edit questions and answers,
            then publish your CSV.
          </p>
        </div>
        <Link
          href={`/onboarding/${jobId}/workspace`}
          className="cs-btn-secondary self-start"
        >
          Shared workspace <ArrowUpRight size={15} />
        </Link>
      </div>
      <div className="cs-card p-5 flex flex-wrap gap-5 items-center justify-between">
        <div>
          <p className="font-medium">{count} sources connected</p>
          <p className="text-sm text-cs-text-muted mt-1">
            {submission?.submittedAt
              ? `Files submitted ${new Date(submission.submittedAt).toLocaleDateString()}${submission.changedSinceSubmission ? " · Sources changed since submission" : ""}`
              : "Client files have not been submitted for review."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <button
              disabled={busy || editing}
              onClick={() => run("rescrape")}
              className="cs-btn-secondary"
            >
              <RefreshCw size={14} /> Refresh website
            </button>
          )}
          <button
            disabled={busy || editing}
            onClick={() => run("generate")}
            className="cs-btn-primary"
          >
            <BookOpen size={14} />{" "}
            {busy ? "Working…" : "Prepare / resume draft"}
          </button>
        </div>
      </div>
      {progress && (
        <p role="status" className="text-sm text-cs-accent-brand">
          {progress}
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="cs-card p-4 border-cs-accent-red/40 text-sm text-cs-accent-red"
        >
          {error}
        </div>
      )}
      {!version ? (
        <div className="cs-card p-10 text-center">
          <BookOpen className="mx-auto text-cs-accent-brand mb-4" />
          <h2 className="font-medium">
            Your first knowledge version starts here
          </h2>
          <p className="text-sm text-cs-text-muted mt-2">
            Prepare the website and uploaded documents into a unified Q&A draft.
          </p>
        </div>
      ) : (
        <>
          <div className="cs-card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="text-sm">
                Knowledge version
                <select
                  aria-label="Knowledge version"
                  disabled={busy || editing}
                  value={version.id}
                  onChange={(e) => {
                    setEditing(false);
                    setSelected(e.target.value);
                    setAck(false);
                  }}
                  className="cs-input mt-2"
                >
                  {versions.map((v, i) => (
                    <option value={v.id} key={v.id}>
                      Version {versions.length - i} ·{" "}
                      {new Date(v.created_at).toLocaleString()} · {v.status}
                    </option>
                  ))}
                </select>
              </label>
              <a
                href={`${endpoint}?format=csv&version=${version.id}`}
                className="cs-btn-secondary"
              >
                <Download size={14} /> Download Q&A CSV
              </a>
            </div>
            <p className="text-sm text-cs-text-secondary">
              {version.qa.length} answers ·{" "}
              <span className="capitalize">{version.status}</span>
              {version.source_hash !== hash &&
                " · Sources have changed; prepare a new draft before publishing."}
            </p>
            {!!version.warnings.length && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                <p className="text-sm font-medium mb-2">
                  Review before publishing
                </p>
                <ul className="list-disc pl-5 text-sm text-cs-text-secondary space-y-1">
                  {version.warnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
                {version.status === "draft" && !editing && (
                  <label className="flex gap-2 text-sm mt-4">
                    <input
                      type="checkbox"
                      checked={ack}
                      onChange={(e) => setAck(e.target.checked)}
                    />
                    I reviewed the missing sources and content warnings.
                  </label>
                )}
              </div>
            )}
            {version.error_message && (
              <p className="text-sm text-cs-accent-red">
                {version.error_message}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              {version.status === "draft" && !editing && (
                <button
                  className="cs-btn-primary"
                  disabled={
                    busy ||
                    editing ||
                    version.source_hash !== hash ||
                    (!!version.warnings.length && !ack)
                  }
                  onClick={() => run("publish")}
                >
                  Publish KB
                </button>
              )}
              {version.canRefresh && (
                <button
                  className="cs-btn-secondary"
                  disabled={busy}
                  onClick={() => run("refresh")}
                >
                  Refresh publishing status
                </button>
              )}
              {["uncertain", "publishing"].includes(version.status) &&
                !version.canRefresh && (
                  <button
                    className="cs-btn-secondary"
                    disabled={busy}
                    onClick={() => run("reconcile")}
                  >
                    Check delivery
                  </button>
                )}
            </div>
            <div className="flex gap-3 flex-wrap">
              {version.status === "draft" && (
                <button
                  className="cs-btn-secondary"
                  disabled={busy}
                  onClick={() => {
                    if (editing) {
                      setEditing(false);
                    } else {
                      setEditedQA(version.qa.map((row) => ({ ...row })));
                      setBaseQA(version.qa);
                      setEditing(true);
                    }
                  }}
                >
                  {editing ? "Cancel editing" : "Edit draft answers"}
                </button>
              )}
              {["published", "failed"].includes(version.status) && (
                <button
                  className="cs-btn-secondary"
                  disabled={busy}
                  onClick={() => run("revise")}
                >
                  Create editable revision
                </button>
              )}
              {editing && (
                <button
                  className="cs-btn-primary"
                  disabled={busy}
                  onClick={() => run("save")}
                >
                  Save draft changes
                </button>
              )}
            </div>
            <p className="text-sm text-cs-text-secondary">
              AI-generated draft: verify every answer against current property
              information before publishing. Resolve conflicting hours, prices,
              and policies with your team.
            </p>
            <p className="text-xs text-cs-text-muted">
              Publishing uploads your Q&A CSV as a new KB version. Your Call
              Stream team connects the published version to your voice agent.
              Previous versions remain in your history.
            </p>
          </div>
          {editing && (
            <button
              className="cs-btn-secondary"
              disabled={busy || !version.source_manifest.length}
              onClick={() =>
                setEditedQA((rows) => [
                  ...rows,
                  { question: "", answer: "", sources: [] },
                ])
              }
            >
              Add question
            </button>
          )}
          <div className="space-y-3">
            {(editing ? editedQA : version.qa).map((row, i) => (
              <article key={i} className="cs-card p-5">
                {editing ? (
                  <>
                    <button
                      className="cs-btn-secondary mb-3"
                      disabled={busy || editedQA.length <= 1}
                      onClick={() =>
                        setEditedQA((rows) => rows.filter((_, n) => n !== i))
                      }
                    >
                      Remove question
                    </button>
                    <label className="block text-xs mb-2">
                      Question and alternate phrasings
                      <textarea
                        disabled={busy}
                        className="cs-input mt-2"
                        value={row.question}
                        onChange={(e) =>
                          setEditedQA((rows) =>
                            rows.map((q, n) =>
                              n === i ? { ...q, question: e.target.value } : q,
                            ),
                          )
                        }
                      />
                    </label>
                    <label className="block text-xs">
                      Spoken answer
                      <textarea
                        disabled={busy}
                        className="cs-input mt-2 min-h-24"
                        value={row.answer}
                        onChange={(e) =>
                          setEditedQA((rows) =>
                            rows.map((q, n) =>
                              n === i ? { ...q, answer: e.target.value } : q,
                            ),
                          )
                        }
                      />
                    </label>
                  </>
                ) : (
                  <h2 className="text-sm font-medium">{row.question}</h2>
                )}
                <p
                  hidden={editing}
                  className="text-sm text-cs-text-secondary mt-3 whitespace-pre-wrap"
                >
                  {row.answer}
                </p>
                {editing && (
                  <fieldset className="mt-3 text-xs space-y-2" disabled={busy}>
                    <legend>Supporting sources (select at least one)</legend>
                    {version.source_manifest.map((source) => (
                      <label key={source.id} className="flex gap-2">
                        <input
                          type="checkbox"
                          checked={row.sources.includes(source.id)}
                          onChange={(e) =>
                            setEditedQA((rows) =>
                              rows.map((q, n) =>
                                n === i
                                  ? {
                                      ...q,
                                      sources: e.target.checked
                                        ? [...q.sources, source.id]
                                        : q.sources.filter(
                                            (id) => id !== source.id,
                                          ),
                                    }
                                  : q,
                              ),
                            )
                          }
                        />
                        {source.name}
                      </label>
                    ))}
                  </fieldset>
                )}
                <details
                  hidden={editing}
                  className="mt-3 text-xs text-cs-text-muted"
                >
                  <summary className="cursor-pointer">
                    Supporting sources
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {row.sources.map((id) => (
                      <li key={id}>
                        {version.source_manifest.find((s) => s.id === id)
                          ?.name || id}
                      </li>
                    ))}
                  </ul>
                </details>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
