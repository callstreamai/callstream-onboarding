"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { Spinner } from "@/components/ui/Spinner";
import {
  Folder, FileText, Upload, Plus, Users, Send, Copy,
  Building, Home, UtensilsCrossed, Calendar, Settings,
  BookOpen, Megaphone, CheckCircle2, Clock, X, ChevronRight,
} from "lucide-react";

interface Space {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  space_documents: { id: string; name: string; file_name: string; file_type: string; processing_status: string; created_at: string }[];
}

interface Invitation {
  id: string;
  email: string;
  accepted_at: string | null;
  created_at: string;
}

const ICON_MAP: Record<string, typeof Folder> = {
  building: Building,
  home: Home,
  utensils: UtensilsCrossed,
  calendar: Calendar,
  settings: Settings,
  "file-text": FileText,
  book: BookOpen,
  megaphone: Megaphone,
  folder: Folder,
};

export default function WorkspacePage() {
  const params = useParams();
  const jobId = params.jobId as string;
  const { user, isAdmin } = useAuth();

  const [spaces, setSpaces] = useState<Space[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [activeSpace, setActiveSpace] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [showNewSpace, setShowNewSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [newSpaceDesc, setNewSpaceDesc] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const loadWorkspace = useCallback(async () => {
    const res = await fetch("/api/jobs/" + jobId + "/spaces");
    if (res.ok) {
      const data = await res.json();
      if (data.spaces.length === 0) {
        // Initialize default spaces
        const initRes = await fetch("/api/jobs/" + jobId + "/spaces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initDefaults: true, userId: user?.id }),
        });
        if (initRes.ok) {
          const initData = await initRes.json();
          setSpaces(initData.spaces || []);
        }
      } else {
        setSpaces(data.spaces);
      }
    }

    if (isAdmin) {
      const invRes = await fetch("/api/jobs/" + jobId + "/invite");
      if (invRes.ok) {
        const invData = await invRes.json();
        setInvitations(invData.invitations || []);
      }
    }

    setLoading(false);
  }, [jobId, user?.id, isAdmin]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    const res = await fetch("/api/jobs/" + jobId + "/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, invitedBy: user?.id }),
    });
    if (res.ok) {
      const data = await res.json();
      setInviteUrl(data.inviteUrl);
      setInviteEmail("");
      loadWorkspace();
    }
  }

  async function handleAddSpace() {
    if (!newSpaceName.trim()) return;
    await fetch("/api/jobs/" + jobId + "/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newSpaceName, description: newSpaceDesc, userId: user?.id }),
    });
    setNewSpaceName("");
    setNewSpaceDesc("");
    setShowNewSpace(false);
    loadWorkspace();
  }

  async function handleFileUpload(spaceId: string, files: FileList) {
    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Upload to Supabase storage via existing upload API
      const formData = new FormData();
      formData.append("file", file);
      formData.append("jobId", jobId);

      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });

      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        // Create space document record
        await fetch("/api/jobs/" + jobId + "/spaces/" + spaceId + "/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            storagePath: uploadData.path || "",
            userId: user?.id,
          }),
        });
      }
    }
    setUploading(false);
    loadWorkspace();
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;

  const active = spaces.find((s) => s.id === activeSpace);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-cs-text-primary">Property Workspace</h1>
          <p className="text-sm text-cs-text-muted">Upload and organize property knowledge</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowInvite(!showInvite)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-cs-border text-cs-text-secondary hover:bg-cs-card"
            >
              <Users size={13} /> Invite user
            </button>
          )}
          <button
            onClick={() => setShowNewSpace(!showNewSpace)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-cs-accent-blue/10 text-cs-accent-blue hover:bg-cs-accent-blue/20"
          >
            <Plus size={13} /> Add space
          </button>
        </div>
      </div>

      {/* Invite panel */}
      {showInvite && (
        <div className="cs-card p-4 space-y-3">
          <p className="text-xs font-medium text-cs-text-primary">Invite a team member</p>
          <div className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="team@property.com"
              className="cs-input flex-1"
            />
            <button onClick={handleInvite} className="cs-btn-primary text-xs px-3 py-1.5">
              <Send size={12} /> Send
            </button>
          </div>
          {inviteUrl && (
            <div className="flex items-center gap-2 bg-cs-bg p-2 rounded text-xs">
              <span className="flex-1 text-cs-text-muted truncate">{inviteUrl}</span>
              <button
                onClick={() => { navigator.clipboard.writeText(inviteUrl); }}
                className="text-cs-accent-blue hover:underline flex items-center gap-1"
              >
                <Copy size={10} /> Copy
              </button>
            </div>
          )}
          {invitations.length > 0 && (
            <div className="space-y-1 mt-2">
              <p className="text-[10px] text-cs-text-muted uppercase tracking-wide">Sent invitations</p>
              {invitations.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between text-xs py-1">
                  <span className="text-cs-text-secondary">{inv.email}</span>
                  {inv.accepted_at ? (
                    <span className="text-cs-accent-green flex items-center gap-1"><CheckCircle2 size={10} /> Accepted</span>
                  ) : (
                    <span className="text-cs-text-muted flex items-center gap-1"><Clock size={10} /> Pending</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* New space form */}
      {showNewSpace && (
        <div className="cs-card p-4 space-y-3">
          <input value={newSpaceName} onChange={(e) => setNewSpaceName(e.target.value)} placeholder="Space name (e.g., Spa & Wellness)" className="cs-input" />
          <input value={newSpaceDesc} onChange={(e) => setNewSpaceDesc(e.target.value)} placeholder="Description (optional)" className="cs-input" />
          <div className="flex gap-2">
            <button onClick={handleAddSpace} className="cs-btn-primary text-xs px-3 py-1.5">Create space</button>
            <button onClick={() => setShowNewSpace(false)} className="text-xs text-cs-text-muted">Cancel</button>
          </div>
        </div>
      )}

      {/* Spaces grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {spaces.map((space) => {
          const IconComp = ICON_MAP[space.icon] || Folder;
          const docCount = space.space_documents?.length || 0;

          return (
            <button
              key={space.id}
              onClick={() => setActiveSpace(activeSpace === space.id ? null : space.id)}
              className={
                "cs-card p-4 text-left transition hover:border-cs-accent-blue/50 " +
                (activeSpace === space.id ? "border-cs-accent-blue" : "")
              }
            >
              <div className="flex items-start justify-between mb-2">
                <div className="w-8 h-8 rounded-md bg-cs-accent-blue/10 flex items-center justify-center">
                  <IconComp size={16} className="text-cs-accent-blue" />
                </div>
                {docCount > 0 && (
                  <span className="text-[10px] text-cs-text-muted bg-cs-bg px-1.5 py-0.5 rounded">
                    {docCount} file{docCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <h3 className="text-sm font-medium text-cs-text-primary">{space.name}</h3>
              {space.description && (
                <p className="text-[11px] text-cs-text-muted mt-0.5 line-clamp-2">{space.description}</p>
              )}
            </button>
          );
        })}
      </div>

      {/* Active space detail */}
      {active && (
        <div className="cs-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-cs-text-primary">{active.name}</h3>
            <button onClick={() => setActiveSpace(null)} className="text-cs-text-muted hover:text-cs-text-secondary">
              <X size={14} />
            </button>
          </div>

          {/* Upload area */}
          <label className="block border-2 border-dashed border-cs-border rounded-lg p-6 text-center cursor-pointer hover:border-cs-accent-blue/50 transition">
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files) handleFileUpload(active.id, e.target.files); }}
            />
            <Upload size={20} className="mx-auto text-cs-text-muted mb-2" />
            <p className="text-xs text-cs-text-secondary">
              {uploading ? "Uploading..." : "Drop files here or click to upload"}
            </p>
            <p className="text-[10px] text-cs-text-muted mt-1">
              PDFs, Word docs, images, spreadsheets — any property document
            </p>
          </label>

          {/* Documents list */}
          {active.space_documents && active.space_documents.length > 0 ? (
            <div className="space-y-2">
              {active.space_documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 py-2 px-3 bg-cs-bg rounded-md">
                  <FileText size={14} className="text-cs-text-muted flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-cs-text-primary truncate">{doc.name}</p>
                    <p className="text-[10px] text-cs-text-muted">
                      {doc.file_type} · {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {doc.processing_status === "complete" ? (
                    <CheckCircle2 size={12} className="text-cs-accent-green flex-shrink-0" />
                  ) : (
                    <Clock size={12} className="text-cs-text-muted flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-cs-text-muted text-center py-4">No documents yet. Upload files to get started.</p>
          )}
        </div>
      )}
    </div>
  );
}
