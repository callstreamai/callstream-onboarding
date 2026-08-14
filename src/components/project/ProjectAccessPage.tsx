"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { Spinner } from "@/components/ui/Spinner";

export default function ProjectAccessPage({
  jobId,
  children,
}: {
  jobId: string;
  children: React.ReactNode;
}) {
  const { isAdmin, isLoading } = useAuth();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      if (isLoading) return;
      if (isAdmin) {
        setAllowed(true);
        setChecking(false);
        return;
      }

      const res = await fetch("/api/jobs");
      const data = res.ok ? await res.json() : { jobs: [] };
      const hasAccess = (data.jobs || []).some((job: any) => job.id === jobId);

      if (cancelled) return;
      if (!hasAccess) {
        router.replace("/");
        return;
      }

      setAllowed(true);
      setChecking(false);
    }

    checkAccess();
    return () => { cancelled = true; };
  }, [isAdmin, isLoading, jobId, router]);

  if (isLoading || checking || !allowed) {
    return <div className="flex justify-center py-20"><Spinner /></div>;
  }

  return <>{children}</>;
}
