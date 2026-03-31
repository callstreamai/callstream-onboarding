"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Account } from "@/types/account";
import { Spinner } from "@/components/ui/Spinner";
import { Building2, Plus, ArrowRight, Users } from "lucide-react";
import { VERTICALS } from "@/types";

export default function AdminAccountsPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", property_url: "", vertical: "", notes: "" });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAdmin) { router.push("/"); return; }
    fetchAccounts();
  }, [authLoading, isAdmin]);

  async function fetchAccounts() {
    const res = await fetch("/api/admin/accounts");
    if (res.ok) {
      const data = await res.json();
      setAccounts(data.accounts || []);
    }
    setLoading(false);
  }

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await fetch("/api/admin/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const data = await res.json();
      router.push(`/admin/accounts/${data.account.id}`);
    }
    setCreating(false);
  }

  if (authLoading) return <div className="flex justify-center py-16"><Spinner size={28} /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building2 size={20} className="text-cs-accent-blue" />
          <h1 className="text-2xl font-semibold">Accounts</h1>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="cs-btn-primary text-sm">
          <Plus size={16} />
          New Account
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={createAccount} className="cs-card p-5 mb-6 max-w-lg space-y-4">
          <p className="text-sm font-medium text-cs-text-primary">Create Account</p>
          <div>
            <label className="cs-label block mb-1.5">ACCOUNT NAME</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="The Grand Hotel"
              className="cs-input"
              required
            />
          </div>
          <div>
            <label className="cs-label block mb-1.5">PROPERTY URL</label>
            <input
              value={form.property_url}
              onChange={(e) => setForm({ ...form, property_url: e.target.value })}
              placeholder="https://thegrandhotel.com"
              className="cs-input"
            />
          </div>
          <div>
            <label className="cs-label block mb-1.5">VERTICAL</label>
            <select
              value={form.vertical}
              onChange={(e) => setForm({ ...form, vertical: e.target.value })}
              className="cs-input"
            >
              <option value="">Select...</option>
              {Object.entries(VERTICALS).map(([key, meta]) => (
                <option key={key} value={key}>{meta.icon} {meta.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="cs-label block mb-1.5">NOTES</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Internal notes about this account..."
              className="cs-input min-h-[60px]"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={creating} className="cs-btn-primary text-sm">
              {creating ? "Creating..." : "Create Account"}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="cs-btn-ghost text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Accounts list */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={28} /></div>
      ) : accounts.length === 0 ? (
        <div className="cs-card p-12 text-center">
          <Building2 size={40} className="mx-auto text-cs-text-muted mb-3" />
          <p className="text-cs-text-secondary">No accounts yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map((acct) => (
            <Link
              key={acct.id}
              href={`/admin/accounts/${acct.id}`}
              className="cs-card-hover flex items-center justify-between p-4 group"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-cs-text-primary font-medium">{acct.name}</p>
                  {acct.vertical && (
                    <span className="cs-badge bg-cs-card text-cs-text-muted">
                      {VERTICALS[acct.vertical as keyof typeof VERTICALS]?.icon} {acct.vertical}
                    </span>
                  )}
                </div>
                <p className="text-xs text-cs-text-muted mt-0.5">
                  {acct.property_url || "No URL"}
                  {acct.contacts && acct.contacts.length > 0 && ` · ${acct.contacts.length} contact(s)`}
                </p>
              </div>
              <ArrowRight size={16} className="text-cs-text-muted group-hover:text-cs-text-primary transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
