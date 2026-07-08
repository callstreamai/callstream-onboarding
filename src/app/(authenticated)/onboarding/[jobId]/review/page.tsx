"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ReviewRedirect() {
  const params = useParams();
  const router = useRouter();
  const jobId = Array.isArray(params.jobId) ? params.jobId[0] : (params.jobId as string);
  useEffect(() => {
    if (jobId) router.replace("/onboarding/" + jobId + "/voice-preview");
  }, [jobId, router]);
  return null;
}
