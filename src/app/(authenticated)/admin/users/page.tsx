"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter } from "next/navigation";
import type { Profile } from "@/types/auth";
import { Spinner } from "@/components/ui/Spinner";
import { Users, Shield, User, UserPlus, Send, X, Copy, Check, Link2 } from "lucide-react";

export default function AdminUsersPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "client">("client");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ link: string; email: string } | null>(null);
  const [inviteError, setInviteError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push("/");
      return;
    }
    loadUsers();
  }, [authLoading, isAdmin]);

  function loadUsers() {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => setUsers(data.users || []))
      .finally(() => setLoading(false));
  }

  async function toggleRole(userId: string, currentRole: string) {
    const newRole = currentRole === "admin" ? "client" : "admin";
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role: newRole }),
    });
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole as "admin" | "client" } : u))
    );
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError("");
    setInviteResult(null);
    try {
      const res = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (res.ok && data.inviteLink) {
        setInviteResult({ link: data.inviteLink, email: inviteEmail.trim() });
        setInviteEmail("");
        loadUsers();
      } else {
        setInviteError(data.error || "Failed to invite user");
      }
    } catch {
      setInviteError("Network error — please try again");
    } finally {
      setInviting(false);
    }
  }

  function copyLink() {
    if (!inviteResult?.link) return;
    navigator.clipboard.writeText(inviteResult.link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  function reset() {
    setShowInvite(false);
    setInviteResult(null);
    setInviteError("");
    setInviteEmail("");
    setCopied(false);
  }

  if (authLoading || (!isAdmin && !authLoading)) {
    return <div className="flex justify-center py-16"><Spinner size={28} /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users size={20} className="text-cs-accent-purple" />
          <h1 className="text-2xl font-semibold">Users</h1>
        </div>
        <button
          onClick={() => { setShowInvite(true); setInviteResult(null); setInviteError(""); }}
          className="cs-btn-primary text-sm"
        >
          <UserPlus size={14} />
          Add User
        </button>
      </div>

      {/* Invite form */}
      {showInvite && !inviteResult && (
        <div className="cs-card p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-cs-text-primary">Invite a new user</p>
            <button onClick={reset} className="text-cs-text-muted hover:text-cs-text-secondary">
              <X size={14} />
            </button>
          </div>
          <form onSubmit={handleInvite} className="flex items-end gap-3">
            <div className="flex-1">
              <label className="cs-label block mb-1.5">EMAIL</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@company.com"
                className="cs-input w-full"
                required
              />
            </div>
            <div>
              <label className="cs-label block mb-1.5">ROLE</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "admin" | "client")}
                className="cs-input"
              >
                <option value="client">Client</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button type="submit" disabled={inviting} className="cs-btn-primary">
              <Send size={14} />
              {inviting ? "Sending..." : "Send Invite"}
            </button>
          </form>
          {inviteError && (
            <p className="text-xs mt-3 text-cs-accent-red">{inviteError}</p>
          )}
        </div>
      )}

      {/* Invite success — show copy link */}
      {inviteResult && (
        <div className="cs-card p-5 mb-6 border border-cs-accent-green/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-cs-accent-green/15 flex items-center justify-center">
                <Check size={12} className="text-cs-accent-green" />
              </div>
              <p className="text-sm font-medium text-cs-text-primary">
                Invite created for {inviteResult.email}
              </p>
            </div>
            <button onClick={reset} className="text-cs-text-muted hover:text-cs-text-secondary">
              <X size={14} />
            </button>
          </div>

          <p className="text-xs text-cs-text-muted mb-3">
            An email has been sent. You can also copy the link below to share via text or any other channel.
          </p>

          <div className="flex items-center gap-2 p-3 bg-cs-bg rounded-lg border border-cs-border">
            <Link2 size={12} className="text-cs-text-muted flex-shrink-0" />
            <p className="text-xs text-cs-text-secondary truncate flex-1 font-mono">
              {inviteResult.link}
            </p>
            <button
              onClick={copyLink}
              className={"flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition flex-shrink-0 " +
                (copied
                  ? "bg-cs-accent-green/15 text-cs-accent-green"
                  : "bg-cs-border/60 text-cs-text-secondary hover:bg-cs-border hover:text-cs-text-primary")}
            >
              {copied ? <><Check size={11} /> Copied!</> : <><Copy size={11} /> Copy link</>}
            </button>
          </div>

          <p className="text-[10px] text-cs-text-muted mt-2">
            This link expires in 24 hours and can only be used once.
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={28} /></div>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <div key={user.id} className="cs-card flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-cs-card border border-cs-border flex items-center justify-center">
                  {user.role === "admin" ? (
                    <Shield size={14} className="text-cs-accent-purple" />
                  ) : (
                    <User size={14} className="text-cs-text-muted" />
                  )}
                </div>
                <div>
                  <p className="text-sm text-cs-text-primary">{user.full_name || "Unnamed"}</p>
                  <p className="text-xs text-cs-text-muted">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={"cs-badge " + (user.role === "admin"
                  ? "bg-cs-accent-purple/10 text-cs-accent-purple"
                  : "bg-cs-card text-cs-text-muted")}>
                  {user.role}
                </span>
                <button
                  onClick={() => toggleRole(user.id, user.role)}
                  className="cs-btn-ghost text-xs py-1.5"
                >
                  {user.role === "admin" ? "Demote" : "Promote"}
                </button>
              </div>
            </div>
          ))}
          {users.length === 0 && (
            <p className="text-center text-cs-text-muted text-sm py-12">No users yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
