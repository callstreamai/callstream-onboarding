"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
export default function PropertyDetails({ property }: { property: any }) {
  const router = useRouter();
  const [name, setName] = useState(property.name),
    [url, setUrl] = useState(property.website_url),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/properties/" + property.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, website_url: url }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setMessage(
        "Property updated. Use Rescrape website in Knowledge to refresh its sources.",
      );
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="cs-card p-6">
      <summary className="cursor-pointer font-medium">
        Property details · Team only
      </summary>
      <form onSubmit={save} className="mt-5 max-w-2xl space-y-4">
        <label className="block text-sm">
          Property name
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="cs-input mt-2"
          />
        </label>
        <label className="block text-sm">
          Official website
          <input
            required
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="cs-input mt-2"
          />
        </label>
        <p className="text-sm text-cs-text-muted">
          Updating the website keeps your files and existing knowledge versions.
          Refresh the website separately when ready.
        </p>
        <button disabled={busy} className="cs-btn-primary">
          {busy ? "Saving…" : "Save property details"}
        </button>
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
        <Link
          className="block text-sm text-cs-accent-brand"
          href={
            property.account_id
              ? "/admin/accounts/" + property.account_id
              : "/admin/accounts"
          }
        >
          Manage client account and access →
        </Link>
      </form>
    </details>
  );
}
