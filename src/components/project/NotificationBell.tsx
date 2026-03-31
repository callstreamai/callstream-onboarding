"use client";

import { useState, useEffect, useRef } from "react";
import { Notification } from "@/types/project";
import { Bell, Check, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";

interface Props {
  userId: string;
}

export default function NotificationBell({ userId }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/notifications?userId=" + userId);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications);
      }
    }
    load();
    const interval = setInterval(load, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true, userId }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function markRead(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId: id }),
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  function formatTime(date: string) {
    const d = new Date(date);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diff < 1) return "just now";
    if (diff < 60) return diff + "m";
    if (diff < 1440) return Math.floor(diff / 60) + "h";
    return Math.floor(diff / 1440) + "d";
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-cs-text-muted hover:text-cs-text-secondary"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-cs-accent-red text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-cs-card border border-cs-border rounded-lg shadow-xl z-30 max-h-96 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-cs-border">
            <span className="text-xs font-medium text-cs-text-primary">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[10px] text-cs-accent-blue hover:underline flex items-center gap-1"
              >
                <Check size={10} /> Mark all read
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-cs-text-muted">
                No notifications
              </div>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    markRead(n.id);
                    if (n.link) router.push(n.link);
                    setOpen(false);
                  }}
                  className={
                    "w-full text-left px-4 py-3 border-b border-cs-border/50 hover:bg-cs-border/30 " +
                    (!n.read ? "bg-cs-accent-blue/5" : "")
                  }
                >
                  <div className="flex items-start gap-2">
                    {!n.read && (
                      <div className="w-1.5 h-1.5 rounded-full bg-cs-accent-blue mt-1.5 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="text-xs font-medium text-cs-text-primary">{n.title}</p>
                      {n.body && (
                        <p className="text-[11px] text-cs-text-muted mt-0.5 line-clamp-2">{n.body}</p>
                      )}
                      <p className="text-[10px] text-cs-text-muted mt-1">{formatTime(n.created_at)}</p>
                    </div>
                    {n.link && <ExternalLink size={10} className="text-cs-text-muted flex-shrink-0 mt-1" />}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
