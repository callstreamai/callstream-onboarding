"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, Globe, FolderOpen, ArrowRight } from "lucide-react";
export default function ManagedOnboarding({
  accountId,
}: {
  accountId?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [jobId, setJobId] = useState("");
  const [accounts, setAccounts] = useState<
    { id: string; name: string; property_url?: string }[]
  >([]);
  const [selectedAccount, setSelectedAccount] = useState(accountId || "");
  useEffect(() => {
    fetch("/api/admin/accounts")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok)
          throw new Error(d.error || "Could not load client accounts.");
        setAccounts(d.accounts || []);
        const current = d.accounts?.find(
          (a: { id: string }) => a.id === accountId,
        );
        if (current) {
          setName(current.name || "");
          setUrl(current.property_url || "");
        }
      })
      .catch((e) => setError(e.message));
  }, [accountId]);

  async function post(path: string, body: unknown) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Please try again.");
    return data;
  }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const key =
        "managed-property:" +
        JSON.stringify([selectedAccount, name.trim(), url.trim()]);
      let requestId = sessionStorage.getItem(key);
      if (!requestId) {
        requestId = crypto.randomUUID();
        sessionStorage.setItem(key, requestId);
      }
      setMessage("Creating your property workspace…");
      const job = await post("/api/jobs", {
        requestId,
        name,
        url,
        accountId: selectedAccount,
      });
      setJobId(job.jobId);
      if(job.reused){router.push(`/properties/${job.jobId}`);return;}
      setMessage("Reading the property website…");
      await post("/api/crawl", { jobId: job.jobId });
      let result;
      do {
        setMessage(
          result?.pending
            ? `Preparing knowledge · ${result.completed} of ${result.total} sections saved…`
            : "Preparing the first knowledge draft…",
        );
        result = await post(`/api/jobs/${job.jobId}/knowledge`, {
          action: "generate",
        });
      } while (result.pending);
      sessionStorage.removeItem(key);
      router.push(`/properties/${job.jobId}`);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not create the property.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <p className="cs-label text-cs-accent-brand mb-2">Managed onboarding</p>
        <h1 className="text-3xl font-semibold">Create a property</h1>
        <p className="text-cs-text-secondary mt-3">
          Prepare the website knowledge, then invite your client into their
          shared workspace.
        </p>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          [Globe, "Read the website"],
          [Building2, "Review the knowledge"],
          [FolderOpen, "Collect client files"],
        ].map(([Icon, title]: any, i) => (
          <div className="cs-card p-4" key={title}>
            <Icon size={19} className="text-cs-accent-brand mb-3" />
            <p className="text-sm">
              {i + 1}. {title}
            </p>
          </div>
        ))}
      </div>
      <form onSubmit={create} className="cs-card p-6 space-y-5">
        <div>
          <label htmlFor="client-account" className="block text-sm mb-2">
            Client account
          </label>
          <select
            id="client-account"
            required
            className="cs-input"
            disabled={busy || !!accountId}
            value={selectedAccount}
            onChange={(e) => {
              setSelectedAccount(e.target.value);
              const a = accounts.find((a) => a.id === e.target.value);
              if (a) {
                setName(a.name);
                setUrl(a.property_url || "");
              }
            }}
          >
            <option value="">Choose a client account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-cs-text-muted mt-2">
            Existing account members can access this workspace.{" "}
            <Link
              href={
                selectedAccount
                  ? `/admin/accounts/${selectedAccount}`
                  : "/admin/accounts"
              }
              className="text-cs-accent-brand"
            >
              Manage client access
            </Link>
          </p>
        </div>
        <div>
          <label htmlFor="property-name" className="block text-sm mb-2">
            Property name
          </label>
          <input
            id="property-name"
            className="cs-input"
            required
            maxLength={200}
            value={name}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter the property name"
          />
        </div>
        <div>
          <label htmlFor="property-url" className="block text-sm mb-2">
            Official website
          </label>
          <input
            id="property-url"
            type="url"
            className="cs-input"
            required
            value={url}
            disabled={busy}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.property.com"
          />
          <p className="text-xs text-cs-text-muted mt-2">
            Use a public website you are authorized to process. Files can be
            added later.
          </p>
        </div>
        {busy && (
          <p role="status" className="text-sm text-cs-accent-brand">
            {message} Keep this page open; completed sections are saved.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-cs-accent-red">
            {error} You can retry to continue from saved work.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <button className="cs-btn-primary" disabled={busy}>
            {busy
              ? "Preparing…"
              : jobId
                ? "Continue preparation"
                : "Create & prepare knowledge"}
            <ArrowRight size={16} />
          </button>
          {jobId && (
            <Link
              href={`/onboarding/${jobId}/workspace`}
              className="text-sm text-cs-accent-brand"
            >
              Open workspace
            </Link>
          )}
        </div>
      </form>
      <p className="text-sm text-cs-text-muted">
        The draft stays private to your team until reviewed. Client uploads are
        processed only when your team starts a new knowledge version.
      </p>
    </div>
  );
}
