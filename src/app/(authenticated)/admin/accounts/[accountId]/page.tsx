"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import type { Account, Contact } from "@/types/account";
import { Spinner } from "@/components/ui/Spinner";
import {
  Building2, UserPlus, Plus, Trash2, FileInput, ArrowLeft,
  Phone, Mail, Star, ArrowRight, Link2, Copy, Check, ExternalLink,
} from "lucide-react";

export default function AccountDetailPage() {
  const params = useParams();
  const accountId = params.accountId as string;
  const { isAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [account, setAccount] = useState<Account | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Contact form
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactForm, setContactForm] = useState({
    full_name: "", email: "", phone: "", title: "", is_primary: false,
  });
  const [saving, setSaving] = useState(false);

  // Link generation
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [generatedLinks, setGeneratedLinks] = useState<Record<string, { magicLink: string; loginUrl: string; onboardingUrl: string }>>({});
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAdmin) { router.push("/"); return; }
    fetchData();
  }, [authLoading, isAdmin, accountId]);

  async function fetchData() {
    const res = await fetch("/api/admin/accounts/" + accountId);
    if (res.ok) {
      const data = await res.json();
      setAccount(data.account);
      setContacts(data.contacts || []);
      setJobs(data.jobs || []);
    }
    setLoading(false);
  }

  async function addContact(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/admin/accounts/" + accountId + "/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(contactForm),
    });
    if (res.ok) {
      const data = await res.json();
      setContacts([...contacts, data.contact]);
      setContactForm({ full_name: "", email: "", phone: "", title: "", is_primary: false });
      setShowAddContact(false);
    }
    setSaving(false);
  }

  async function deleteContact(contactId: string) {
    await fetch("/api/admin/accounts/" + accountId + "/contacts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId }),
    });
    setContacts(contacts.filter((c) => c.id !== contactId));
  }

  async function generateLink(contact: Contact) {
    if (!contact.email) return;
    setGeneratingFor(contact.id);
    try {
      const res = await fetch("/api/admin/accounts/" + accountId + "/generate-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: contact.email,
          fullName: contact.full_name,
          contactId: contact.id,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedLinks((prev) => ({
          ...prev,
          [contact.id]: {
            magicLink: data.magicLink,
            loginUrl: data.loginUrl,
            onboardingUrl: data.onboardingUrl,
          },
        }));
      }
    } catch {}
    setGeneratingFor(null);
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  function startOnboarding() {
    router.push("/admin/accounts/" + accountId + "/onboard");
  }

  if (loading || authLoading) {
    return <div className="flex justify-center py-16"><Spinner size={28} /></div>;
  }

  if (!account) {
    return <div className="cs-card p-8 text-center"><p className="text-cs-text-muted">Account not found</p></div>;
  }

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div>
      <button onClick={() => router.push("/admin/accounts")} className="cs-btn-ghost text-xs mb-4">
        <ArrowLeft size={14} /> Back to Accounts
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">{account.name}</h1>
          <p className="text-sm text-cs-text-secondary mt-0.5">
            {account.property_url || "No property URL"} · {account.vertical || "No vertical"}
          </p>
        </div>
        <button onClick={startOnboarding} className="cs-btn-primary text-sm">
          <FileInput size={16} /> Start Onboarding
        </button>
      </div>

      {/* Contacts */}
      <div className="cs-card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <p className="cs-label">CONTACTS ({contacts.length})</p>
          <button onClick={() => setShowAddContact(!showAddContact)} className="cs-btn-secondary text-xs">
            <UserPlus size={14} /> Add Contact
          </button>
        </div>

        {showAddContact && (
          <form onSubmit={addContact} className="bg-cs-surface border border-cs-border rounded-md p-4 mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="cs-label block mb-1">NAME</label>
                <input value={contactForm.full_name} onChange={(e) => setContactForm({ ...contactForm, full_name: e.target.value })}
                  placeholder="Jane Smith" className="cs-input" required />
              </div>
              <div>
                <label className="cs-label block mb-1">TITLE</label>
                <input value={contactForm.title} onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })}
                  placeholder="General Manager" className="cs-input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="cs-label block mb-1">EMAIL</label>
                <input value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  placeholder="jane@hotel.com" className="cs-input" type="email" />
              </div>
              <div>
                <label className="cs-label block mb-1">PHONE</label>
                <input value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  placeholder="+1 (555) 123-4567" className="cs-input" />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={contactForm.is_primary}
                onChange={(e) => setContactForm({ ...contactForm, is_primary: e.target.checked })}
                className="rounded border-cs-border" />
              <span className="text-xs text-cs-text-secondary">Primary contact</span>
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="cs-btn-primary text-xs">{saving ? "Saving..." : "Add Contact"}</button>
              <button type="button" onClick={() => setShowAddContact(false)} className="cs-btn-ghost text-xs">Cancel</button>
            </div>
          </form>
        )}

        {contacts.length === 0 ? (
          <p className="text-xs text-cs-text-muted">No contacts yet</p>
        ) : (
          <div className="space-y-2">
            {contacts.map((c) => (
              <div key={c.id} className="bg-cs-surface border border-cs-border rounded-md p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {c.is_primary && <Star size={12} className="text-cs-accent-orange" />}
                    <div>
                      <p className="text-sm text-cs-text-primary">{c.full_name}{c.title && <span className="text-cs-text-muted"> · {c.title}</span>}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {c.email && <span className="text-xs text-cs-text-muted flex items-center gap-1"><Mail size={10} />{c.email}</span>}
                        {c.phone && <span className="text-xs text-cs-text-muted flex items-center gap-1"><Phone size={10} />{c.phone}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.email && (
                      <button
                        onClick={() => generateLink(c)}
                        disabled={generatingFor === c.id}
                        className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-cs-accent-blue/10 text-cs-accent-blue hover:bg-cs-accent-blue/20 transition"
                      >
                        <Link2 size={12} />
                        {generatingFor === c.id ? "Generating..." : "Get Login Link"}
                      </button>
                    )}
                    <button onClick={() => deleteContact(c.id)} className="text-cs-text-muted hover:text-cs-accent-red transition-colors p-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Generated links panel */}
                {generatedLinks[c.id] && (
                  <div className="mt-3 p-3 bg-cs-bg rounded-md space-y-2 border border-cs-border">
                    <p className="text-[10px] text-cs-text-muted uppercase tracking-wide">Login credentials created for {c.email}</p>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-cs-text-muted uppercase w-20 flex-shrink-0">Magic Link</span>
                        <div className="flex-1 text-xs text-cs-text-secondary bg-cs-surface px-2 py-1 rounded truncate">
                          {generatedLinks[c.id].magicLink.slice(0, 60)}...
                        </div>
                        <button
                          onClick={() => copyToClipboard(generatedLinks[c.id].magicLink, c.id + "-magic")}
                          className="flex items-center gap-1 text-[10px] text-cs-accent-blue hover:underline flex-shrink-0"
                        >
                          {copied === c.id + "-magic" ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-cs-text-muted uppercase w-20 flex-shrink-0">Login Page</span>
                        <div className="flex-1 text-xs text-cs-text-secondary bg-cs-surface px-2 py-1 rounded truncate">
                          {generatedLinks[c.id].loginUrl}
                        </div>
                        <button
                          onClick={() => copyToClipboard(generatedLinks[c.id].loginUrl, c.id + "-login")}
                          className="flex items-center gap-1 text-[10px] text-cs-accent-blue hover:underline flex-shrink-0"
                        >
                          {copied === c.id + "-login" ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
                        </button>
                      </div>

                      {generatedLinks[c.id].onboardingUrl !== generatedLinks[c.id].loginUrl && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-cs-text-muted uppercase w-20 flex-shrink-0">Workspace</span>
                          <div className="flex-1 text-xs text-cs-text-secondary bg-cs-surface px-2 py-1 rounded truncate">
                            {generatedLinks[c.id].onboardingUrl}
                          </div>
                          <button
                            onClick={() => copyToClipboard(generatedLinks[c.id].onboardingUrl, c.id + "-onboard")}
                            className="flex items-center gap-1 text-[10px] text-cs-accent-blue hover:underline flex-shrink-0"
                          >
                            {copied === c.id + "-onboard" ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
                          </button>
                        </div>
                      )}
                    </div>

                    <p className="text-[10px] text-cs-text-muted mt-1">
                      Send the magic link for one-click sign-in, or the login page URL for them to use email + magic link.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Onboarding Jobs */}
      <div className="cs-card p-5">
        <p className="cs-label mb-4">ONBOARDING SUBMISSIONS ({jobs.length})</p>
        {jobs.length === 0 ? (
          <p className="text-xs text-cs-text-muted">No submissions yet. Start onboarding above.</p>
        ) : (
          <div className="space-y-2">
            {jobs.map((job: any) => (
              <div key={job.id} className="bg-cs-surface border border-cs-border rounded-md p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-cs-text-primary">{job.property_url}</p>
                    <p className="text-xs text-cs-text-muted">{job.status.replace(/_/g, " ")} · {new Date(job.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(appUrl + "/onboarding/" + job.id + "/workspace", "job-" + job.id)}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-cs-accent-purple/10 text-cs-accent-purple hover:bg-cs-accent-purple/20 transition"
                    >
                      {copied === "job-" + job.id ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy Link</>}
                    </button>
                    <a href={"/api/jobs/" + job.id + "/export"} download className="cs-btn-ghost text-xs py-1">JSON</a>
                    <button onClick={() => router.push("/onboarding/" + job.id + "/workspace")} className="cs-btn-ghost text-xs py-1">
                      <ArrowRight size={12} /> View
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
