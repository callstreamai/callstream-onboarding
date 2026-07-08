"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

// /review has been renamed to /voice-preview
export default function ReviewRedirect() {
  const params = useParams();
  const router = useRouter();
  useEffect(() => {
    router.replace("/onboarding/" + params.jobId + "/voice-preview");
  }, [params.jobId, router]);
  return null;
}
