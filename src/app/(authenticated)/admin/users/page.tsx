"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter } from "next/navigation";
import type { Profile } from "@/types/auth";
import { Spinner } from "@/components/ui/Spinner";
import { Users, Shield, User, UserPlus, Send, X, Copy, Check, Link2, ChevronRight } from "lucide-react";

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
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

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

  async function openUserDetail(userId: string) {
    setSelectedUserId(userId);
    setLoadingDetail(true);
    setUserDetail(null);
    try {
      const res = await fetch("/api/admin/users/" + userId);
      const data = await res.json();
      if (res.ok) setUserDetail(data);
      else setUserDetail({ error: data.error || "Failed to load user detail" });
    } catch {
      setUserDetail({ error: "Network error loading user detail" });
    } finally {
      setLoadingDetail(false);
    }
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
            <button key={user.id} onClick={() => openUserDetail(user.id)} className="cs-card w-full flex items-center justify-between p-4 text-left hover:border-cs-accent-blue/40 transition">
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
                  onClick={(e) => { e.stopPropagation(); toggleRole(user.id, user.role); }}
                  className="cs-btn-ghost text-xs py-1.5"
                >
                  {user.role === "admin" ? "Demote" : "Promote"}
                </button>
                <ChevronRight size={14} className="text-cs-text-muted" />
              </div>
            </button>
          ))}
          {users.length === 0 && (
            <p className="text-center text-cs-text-muted text-sm py-12">No users yet.</p>
          )}
        </div>
      )}

      {selectedUserId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setSelectedUserId(null)}>
          <div className="w-full max-w-2xl h-full bg-cs-bg border-l border-cs-border overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <p className="cs-label text-[10px] mb-1">User Detail</p>
                <h2 className="text-xl font-semibold text-cs-text-primary">
                  {userDetail?.user?.full_name || users.find((u) => u.id === selectedUserId)?.full_name || "User"}
                </h2>
                <p className="text-sm text-cs-text-muted font-mono">
                  {userDetail?.user?.email || users.find((u) => u.id === selectedUserId)?.email}
                </p>
              </div>
              <button onClick={() => setSelectedUserId(null)} className="text-cs-text-muted hover:text-cs-text-primary">
                <X size={18} />
              </button>
            </div>

            {loadingDetail ? (
              <div className="flex justify-center py-16"><Spinner size={28} /></div>
            ) : userDetail?.error ? (
              <div className="cs-card p-4 text-sm text-cs-accent-red">{userDetail.error}</div>
            ) : userDetail ? (
              <div className="space-y-5">
                <div className="cs-card p-4">
                  <p className="text-sm font-medium text-cs-text-primary mb-3">Validated records</p>
                  <div className="divide-y divide-cs-border">
                    {(userDetail.records || []).map((record: any) => (
                      <div key={record.label} className="flex items-center justify-between py-2 text-sm">
                        <span className="text-cs-text-muted">{record.label}</span>
                        <span className="text-cs-text-primary">{record.status}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="cs-card p-4">
                    <p className="text-sm font-medium text-cs-text-primary mb-3">Contact records</p>
                    {(userDetail.contacts || []).length === 0 ? (
                      <p className="text-xs text-cs-text-muted">No matching contact record.</p>
                    ) : (userDetail.contacts || []).map((contact: any) => (
                      <div key={contact.id} className="text-xs text-cs-text-secondary space-y-1">
                        <p className="text-cs-text-primary font-medium">{contact.full_name || "Unnamed"}</p>
                        <p>{contact.email}</p>
                        {contact.title && <p>{contact.title}</p>}
                      </div>
                    ))}
                  </div>

                  <div className="cs-card p-4">
                    <p className="text-sm font-medium text-cs-text-primary mb-3">Auth</p>
                    <div className="text-xs text-cs-text-secondary space-y-2">
                      <p>Created: {userDetail.auth?.created_at ? new Date(userDetail.auth.created_at).toLocaleString() : "—"}</p>
                      <p>Last sign in: {userDetail.auth?.last_sign_in_at ? new Date(userDetail.auth.last_sign_in_at).toLocaleString() : "Never"}</p>
                      <p>Email confirmed: {userDetail.auth?.email_confirmed_at ? "Yes" : "No"}</p>
                    </div>
                  </div>
                </div>

                <div className="cs-card p-4">
                  <p className="text-sm font-medium text-cs-text-primary mb-3">Linked accounts</p>
                  {(userDetail.accounts || []).length === 0 ? (
                    <p className="text-xs text-cs-text-muted">No linked accounts.</p>
                  ) : (
                    <div className="space-y-2">
                      {(userDetail.accounts || []).map((account: any) => (
                        <div key={account.id} className="text-xs text-cs-text-secondary border border-cs-border rounded-md p-3">
                          <p className="text-cs-text-primary font-medium">{account.name}</p>
                          {account.property_url && <p className="truncate">{account.property_url}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="cs-card p-4">
                  <p className="text-sm font-medium text-cs-text-primary mb-3">Project memberships</p>
                  {(userDetail.projects || []).length === 0 ? (
                    <p className="text-xs text-cs-text-muted">No project memberships.</p>
                  ) : (
                    <div className="space-y-2">
                      {(userDetail.projects || []).map((project: any) => (
                        <div key={project.id} className="flex items-center justify-between gap-3 text-xs border border-cs-border rounded-md p-3">
                          <div className="min-w-0">
                            <p className="text-cs-text-primary font-medium truncate">{project.property_name || project.property_url}</p>
                            <p className="text-cs-text-muted truncate">{project.property_url}</p>
                          </div>
                          <span className="cs-badge bg-cs-card text-cs-text-muted flex-shrink-0">{project.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
