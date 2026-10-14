"use client";
import { useParams } from "next/navigation";
import JobTabs from "@/components/project/JobTabs";
import ProjectAccessPage from "@/components/project/ProjectAccessPage";
import VoiceStudio from "@/components/voice/VoiceStudio";
export default function VoicePreviewPage() {
  const { jobId } = useParams<{ jobId: string }>();
  return <ProjectAccessPage jobId={jobId}><JobTabs jobId={jobId} /><VoiceStudio /></ProjectAccessPage>;
}
