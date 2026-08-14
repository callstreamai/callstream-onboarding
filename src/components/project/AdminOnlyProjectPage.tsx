"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { Spinner } from "@/components/ui/Spinner";

export default function AdminOnlyProjectPage({
  jobId,
  children,
}: {
  jobId: string;
  children: React.ReactNode;
}) {
  const { isAdmin, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.replace("/onboarding/" + jobId + "/status");
    }
  }, [isAdmin, isLoading, jobId, router]);

  if (isLoading || !isAdmin) {
    return <div className="flex justify-center py-20"><Spinner /></div>;
  }

  return <>{children}</>;
}
