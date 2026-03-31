import Link from "next/link";
import { StatCard } from "@/components/ui/StatCard";
import { FileInput, ClipboardCheck, Globe } from "lucide-react";

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>

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
          <Link href="/review" className="cs-btn-secondary text-sm">
            <ClipboardCheck size={16} />
            Review Queue
          </Link>
        </div>
      </div>
    </div>
  );
}
