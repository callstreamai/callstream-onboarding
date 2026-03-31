"use client";

import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { StatCard } from "@/components/ui/StatCard";
import { FileInput, ClipboardCheck } from "lucide-react";

export default function DashboardPage() {
  const { profile, isAdmin } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Dashboard</h1>
      <p className="text-sm text-cs-text-secondary mb-6">
        Welcome back{profile?.full_name ? `, ${profile.full_name}` : ""}
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="TOTAL PROPERTIES" value={0} />
        <StatCard label="ONBOARDING ACTIVE" value={0} color="blue" />
        <StatCard label="PENDING REVIEW" value={0} color="orange" />
        <StatCard label="COMPLETED" value={0} color="green" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <StatCard label="PAGES CRAWLED" value={0} />
        <StatCard label="FILES PROCESSED" value={0} />
        <StatCard label="FIELDS EXTRACTED" value={0} color="purple" />
        <StatCard label="AVG CONFIDENCE" value="0%" color="cyan" />
      </div>

      <div className="cs-card p-5">
        <p className="cs-label mb-3">QUICK ACTIONS</p>
        <div className="flex gap-3">
          <Link href="/onboarding" className="cs-btn-primary text-sm">
            <FileInput size={16} />
            New Onboarding
          </Link>
          <Link href={isAdmin ? "/admin/submissions" : "/submissions"} className="cs-btn-secondary text-sm">
            <ClipboardCheck size={16} />
            View Submissions
          </Link>
        </div>
      </div>
    </div>
  );
}
