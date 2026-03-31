"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter } from "next/navigation";
import type { Profile } from "@/types/auth";
import { Spinner } from "@/components/ui/Spinner";
import { Users, Shield, User } from "lucide-react";

export default function AdminUsersPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push("/");
      return;
    }
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => setUsers(data.users || []))
      .finally(() => setLoading(false));
  }, [authLoading, isAdmin]);

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

  if (authLoading || (!isAdmin && !authLoading)) {
    return <div className="flex justify-center py-16"><Spinner size={28} /></div>;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Users size={20} className="text-cs-accent-purple" />
        <h1 className="text-2xl font-semibold">Users</h1>
      </div>

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
                <span className={`cs-badge ${
                  user.role === "admin"
                    ? "bg-cs-accent-purple/10 text-cs-accent-purple"
                    : "bg-cs-card text-cs-text-muted"
                }`}>
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
        </div>
      )}
    </div>
  );
}
