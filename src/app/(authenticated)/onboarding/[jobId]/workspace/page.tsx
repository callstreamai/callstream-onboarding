"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { Spinner } from "@/components/ui/Spinner";
import JobTabs from "@/components/project/JobTabs";
import SubmissionBar from "@/components/project/SubmissionBar";
import CommentFeed from "@/components/project/CommentFeed";
import {
  Folder, FileText, Upload, Plus,
  CheckCircle2, Clock, X, Check,
  Video, Globe, Trash2, ExternalLink, Pencil, Calendar, Download, ArrowLeft, ArrowRight, MoreHorizontal,
} from "lucide-react";
import { ICON_MAP, ICON_LABELS } from "@/lib/spaceIcons";

interface SpaceDoc {
  id: string;
  name: string;
  file_name: string;
  file_type: string;
  file_size: number;
  processing_status: string;
  created_at: string;
}

interface Space {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  space_documents: SpaceDoc[];
}

interface SpaceLink {
  id: string;
  title: string;
  url: string;
  description: string | null;
  created_at: string;
}

function formatSize(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// ─── Icon Picker Component ───────────────────────────────────────────────────
function IconPicker({
  value,
  onChange,
  onClose,
}: {
  value: string;
  onChange: (icon: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const icons = Object.entries(ICON_MAP);

  return (
    <div
      ref={ref}
      className="absolute left-0 top-10 z-50 bg-cs-card border border-cs-border rounded-xl shadow-xl p-3 w-72"
    >
      <p className="text-[10px] text-cs-text-muted uppercase tracking-wide mb-2 px-1">Choose icon</p>
      <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
        {icons.map(([key, Icon]) => (
          <button
            key={key}
            title={ICON_LABELS[key] || key}
            onClick={() => { onChange(key); onClose(); }}
            className={
              "w-8 h-8 rounded-md flex items-center justify-center transition " +
              (value === key
                ? "bg-cs-accent-brand text-white"
                : "hover:bg-cs-border/60 text-cs-text-muted hover:text-cs-text-primary")
            }
          >
            <Icon size={15} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function WorkspacePage() {
  const params = useParams();
  const jobId = params.jobId as string;
  return <PropertyFiles key={jobId} jobId={jobId} />;
}

function PropertyFiles({ jobId }: { jobId: string }) {
  const { user, profile, isAdmin } = useAuth();

  const filesHeadingRef = useRef<HTMLHeadingElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [commentUsers, setCommentUsers] = useState<any[]>([]);
  const [activeSpace, setActiveSpace] = useState<string | null>(null);
  const [showNewSpace, setShowNewSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [newSpaceDesc, setNewSpaceDesc] = useState("");
  const [newSpaceIcon, setNewSpaceIcon] = useState("folder");
  const [showNewIconPicker, setShowNewIconPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingSpace, setSavingSpace] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [spaceLinks, setSpaceLinks] = useState<Record<string, SpaceLink[]>>({});
  const [showAddLink, setShowAddLink] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [addingLink, setAddingLink] = useState(false);
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [editSpaceName, setEditSpaceName] = useState("");
  const [editSpaceDesc, setEditSpaceDesc] = useState("");
  const [deletingSpaceId, setDeletingSpaceId] = useState<string | null>(null);
  // Icon editing per card
  const [iconPickerFor, setIconPickerFor] = useState<string | null>(null);

  useEffect(() => {
    if (!activeSpace) return;
    filesHeadingRef.current?.focus({ preventScroll: true });
    workspaceRef.current?.scrollIntoView({ block: "start" });
  }, [activeSpace]);

  function openFolder(spaceId: string) {
    setActiveSpace(spaceId);
    loadLinks(spaceId);
    setShowAddLink(false);
    setEditingSpaceId(null);
    setIconPickerFor(null);
    setUploadError(null);
  }

  const loadWorkspace = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs/" + jobId + "/spaces");
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Could not load folders. Please refresh and try again.");
      }
      const data = await res.json();
      if (data.spaces.length === 0 && isAdmin) {
        const initRes = await fetch("/api/jobs/" + jobId + "/spaces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initDefaults: true }),
        });
        if (!initRes.ok) throw new Error("Could not load default folders. Please try again.");
        const initData = await initRes.json();
        setSpaces((initData.spaces || []).map((s: any) => ({ ...s, space_documents: [] })));
      } else setSpaces(data.spaces);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Could not load folders. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [jobId, isAdmin]);

  const loadLinks = useCallback(async (spaceId: string) => {
    const res = await fetch("/api/jobs/" + jobId + "/spaces/" + spaceId + "/links");
    if (res.ok) {
      const data = await res.json();
      setSpaceLinks((prev: Record<string, SpaceLink[]>) => ({ ...prev, [spaceId]: data.links || [] }));
    }
  }, [jobId]);

  const loadComments = useCallback(async () => {
    const res = await fetch("/api/jobs/" + jobId + "/comments");
    if (res.ok) {
      const data = await res.json();
      setComments(data.comments || []);
      setCommentUsers(data.users || []);
    }
  }, [jobId]);

  useEffect(() => {
    loadWorkspace();
    loadComments();
  }, [loadWorkspace, loadComments]);

  async function saveFolder(method: "POST" | "PATCH", details: Record<string, unknown>) {
    setSavingSpace(true);
    setUploadError(null);
    try {
      const res = await fetch("/api/jobs/" + jobId + "/spaces", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(details),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Could not save folder. Please try again.");
      }
      const { space } = await res.json();
      setSpaces((prev) => method === "POST"
        ? [...prev, { ...space, space_documents: [] }]
        : prev.map((s) => s.id === space.id ? { ...s, ...space } : s));
      return true;
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not save folder. Please try again.");
      return false;
    } finally {
      setSavingSpace(false);
    }
  }

  async function handleAddSpace() {
    if (!newSpaceName.trim() || savingSpace) return;
    if (!await saveFolder("POST", { name: newSpaceName.trim(), description: newSpaceDesc.trim(), icon: newSpaceIcon })) return;
    setNewSpaceName("");
    setNewSpaceDesc("");
    setNewSpaceIcon("folder");
    setShowNewSpace(false);
  }

  async function handleChangeIcon(spaceId: string, icon: string) {
    if (savingSpace) return;
    setIconPickerFor(null);
    await saveFolder("PATCH", { spaceId, icon });
  }

  function beginEditSpace(space: Space) {
    setEditingSpaceId(space.id);
    setEditSpaceName(space.name);
    setEditSpaceDesc(space.description || "");
    setIconPickerFor(null);
  }

  async function handleUpdateSpace() {
    if (!editingSpaceId || !editSpaceName.trim() || savingSpace) return;
    if (!await saveFolder("PATCH", { spaceId: editingSpaceId, name: editSpaceName.trim(), description: editSpaceDesc.trim() || null })) return;
    setEditingSpaceId(null);
    setEditSpaceName("");
    setEditSpaceDesc("");
  }

  async function handleDeleteSpace(space: Space) {
    const docCount = space.space_documents?.length || 0;
    const message = "Delete folder \"" + space.name + "\"?" +
      (docCount > 0 ? " This will permanently delete " + docCount + " file" + (docCount === 1 ? "" : "s") + " in this space." : "") +
      " This cannot be undone.";

    if (!window.confirm(message)) return;

    setDeletingSpaceId(space.id);
    const res = await fetch("/api/jobs/" + jobId + "/spaces?spaceId=" + space.id, {
      method: "DELETE",
    });
    setDeletingSpaceId(null);

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Delete failed" }));
      setUploadError(err.error || "Delete failed");
      return;
    }

    if (activeSpace === space.id) setActiveSpace(null);
    setEditingSpaceId(null);
    setSpaceLinks((prev) => {
      const next = { ...prev };
      delete next[space.id];
      return next;
    });
    loadWorkspace();
  }

  async function handleFileUpload(spaceId: string, files: FileList) {
    setUploading(true);
    setUploadError(null);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append("file", file);
      if (user?.id) formData.append("userId", user.id);

      const res = await fetch("/api/jobs/" + jobId + "/spaces/" + spaceId + "/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Upload failed" }));
        setUploadError(errData.error || "Upload failed for " + file.name);
      }
    }

    setUploading(false);
    loadWorkspace();
  }

  async function handleAddLink(spaceId: string) {
    if (!newLinkUrl.trim() || !newLinkTitle.trim()) return;
    setAddingLink(true);
    let url = newLinkUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    const res = await fetch("/api/jobs/" + jobId + "/spaces/" + spaceId + "/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newLinkTitle, url, userId: user?.id }),
    });
    if (res.ok) {
      setNewLinkUrl("");
      setNewLinkTitle("");
      setShowAddLink(false);
      loadLinks(spaceId);
    }
    setAddingLink(false);
  }

  async function handleDeleteLink(spaceId: string, linkId: string) {
    await fetch("/api/jobs/" + jobId + "/spaces/" + spaceId + "/links?id=" + linkId, {
      method: "DELETE",
    });
    loadLinks(spaceId);
  }

  async function handleDeleteDocument(spaceId: string, documentId: string) {
    const doc = spaces
      .find((space) => space.id === spaceId)
      ?.space_documents?.find((document) => document.id === documentId);

    if (!doc) return;
    if (!window.confirm("Delete " + doc.name + "? This cannot be undone.")) return;

    const res = await fetch("/api/jobs/" + jobId + "/spaces/" + spaceId + "/documents?id=" + documentId, {
      method: "DELETE",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Delete failed" }));
      setUploadError(err.error || "Delete failed for " + doc.name);
      return;
    }

    setSpaces((prev) => prev.map((space) =>
      space.id === spaceId
        ? { ...space, space_documents: (space.space_documents || []).filter((document) => document.id !== documentId) }
        : space
    ));
  }

  function copyText(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;

  const active = spaces.find((s) => s.id === activeSpace);
  const NewIconComp = ICON_MAP[newSpaceIcon] || Folder;

  return (
    <div ref={workspaceRef}>
      <JobTabs jobId={jobId} />

      <div className="space-y-6">
        {/* File navigation and actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {active && <button className="inline-flex min-h-11 items-center gap-2 text-sm text-cs-accent-brand mb-2" onClick={() => { setActiveSpace(null); setShowAddLink(false); }}>
              <ArrowLeft size={16} /> All folders
            </button>}
            <h1 ref={filesHeadingRef} tabIndex={-1} className="text-2xl font-semibold text-cs-text-primary break-words scroll-mt-6">{active ? active.name : "Files"}</h1>
            <p className="text-sm text-cs-text-secondary mt-2">{active ? active.description || "Upload and manage the files in this folder." : "Open a folder to upload documents, or create one for your team."}</p>
          </div>
          {!active && <div className="grid grid-cols-2 gap-2 sm:flex shrink-0">
            <a href={`/api/jobs/${jobId}/workspace/export`} download className="cs-btn-secondary">
              <Download size={16} /> Download files
            </a>
            <button disabled={savingSpace} onClick={() => setShowNewSpace(!showNewSpace)} className="cs-btn-primary">
              <Plus size={16} /> Add folder
            </button>
          </div>}
        </div>

        {!active && <SubmissionBar jobId={jobId} revision={spaces.reduce((total,s)=>total+(s.space_documents?.length||0),0)}/>}

        {/* New space form */}
        {showNewSpace && !active && (
          <div className="cs-card p-4 space-y-3">
            <p className="text-xs font-medium text-cs-text-primary">New folder</p>
            <div className="flex gap-3 items-start">
              {/* Icon selector */}
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setShowNewIconPicker(!showNewIconPicker)}
                  className="w-10 h-10 rounded-lg bg-cs-accent-brand/10 border border-cs-border hover:border-cs-accent-brand flex items-center justify-center transition"
                  title="Choose icon"
                >
                  <NewIconComp size={18} className="text-cs-accent-brand" />
                </button>
                {showNewIconPicker && (
                  <IconPicker
                    value={newSpaceIcon}
                    onChange={(icon) => setNewSpaceIcon(icon)}
                    onClose={() => setShowNewIconPicker(false)}
                  />
                )}
              </div>

              {/* Name + desc */}
              <div className="flex-1 space-y-2">
                <input
                  maxLength={120}
                  aria-label="Folder name"
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  placeholder="Folder name (e.g., Spa & Wellness)"
                  className="cs-input"
                  autoFocus
                />
                <input
                  maxLength={2000}
                  aria-label="Folder description"
                  value={newSpaceDesc}
                  onChange={(e) => setNewSpaceDesc(e.target.value)}
                  placeholder="Description (optional)"
                  className="cs-input"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button disabled={savingSpace || !newSpaceName.trim()} onClick={handleAddSpace} className="cs-btn-primary text-xs px-3 py-1.5">{savingSpace ? "Creating..." : "Create folder"}</button>
              <button disabled={savingSpace} onClick={() => { setShowNewSpace(false); setNewSpaceIcon("folder"); }} className="text-xs text-cs-text-muted">Cancel</button>
            </div>
          </div>
        )}

        {/* Upload error */}
        {uploadError && (
          <div role="alert" className="bg-cs-accent-red/10 border border-cs-accent-red/30 rounded-md p-3 flex items-center justify-between">
            <p className="text-xs text-cs-accent-red">{uploadError}</p>
            <button aria-label="Dismiss error" className="min-h-11 min-w-11 flex items-center justify-center" onClick={() => setUploadError(null)}><X size={14} className="text-cs-accent-red" /></button>
          </div>
        )}

        {/* A folder opens its own file view instead of appending below the grid. */}
        {!active && spaces.length === 0 && <div className="cs-card p-8 text-center space-y-3">
          <Folder size={28} className="mx-auto text-cs-accent-brand" />
          <h2 className="font-semibold">Create your first folder</h2>
          <p className="text-sm text-cs-text-secondary">Organize documents by department or topic, then upload your files.</p>
          <button className="cs-btn-primary" onClick={() => setShowNewSpace(true)}><Plus size={16} />Add folder</button>
        </div>}
        {!active && <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {spaces.map((space) => {
            const IconComp = ICON_MAP[space.icon] || Folder;
            const docCount = space.space_documents?.length || 0;
            const isPickerOpen = iconPickerFor === space.id;
            return (
              <div key={space.id} className="relative">
                <div className="cs-card hover:border-cs-accent-brand/50 transition-colors">
                  <div className="flex items-center justify-between px-4 pt-3">
                    <span className="text-sm text-cs-text-secondary">{docCount} {docCount === 1 ? "file" : "files"}</span>
                    <details className="relative group" onKeyDown={e => { if (e.key === "Escape") e.currentTarget.removeAttribute("open"); }}>
                      <summary aria-label={`Actions for ${space.name}`} className="list-none min-h-11 min-w-11 flex items-center justify-center rounded-lg cursor-pointer hover:bg-cs-border/40 [&::-webkit-details-marker]:hidden">
                        <MoreHorizontal size={20} />
                      </summary>
                      <div className="absolute right-0 top-12 z-20 w-48 p-2 rounded-xl border border-cs-border bg-cs-card shadow-xl">
                        <button disabled={savingSpace} className="flex items-center gap-2 min-h-11 w-full text-left px-3 rounded-md hover:bg-cs-border/40 text-sm" onClick={e => { beginEditSpace(space); e.currentTarget.closest("details")?.removeAttribute("open"); }}>
                          <Pencil size={16} />Edit folder
                        </button>
                        <button disabled={savingSpace} className="flex items-center gap-2 min-h-11 w-full text-left px-3 rounded-md hover:bg-cs-border/40 text-sm" onClick={e => { setIconPickerFor(space.id); e.currentTarget.closest("details")?.removeAttribute("open"); }}>
                          <Folder size={16} />Change icon
                        </button>
                        {isAdmin && <button disabled={deletingSpaceId === space.id} className="flex items-center gap-2 min-h-11 w-full text-left px-3 rounded-md hover:bg-cs-accent-red/10 text-cs-accent-red text-sm" onClick={e => { e.currentTarget.closest("details")?.removeAttribute("open"); handleDeleteSpace(space); }}>
                          <Trash2 size={16} />Delete folder
                        </button>}
                      </div>
                    </details>
                  </div>
                  <button className="block w-full p-4 pt-1 text-left rounded-b-2xl" aria-label={`Open ${space.name} folder`} onClick={() => openFolder(space.id)}>
                    <IconComp size={24} className="text-cs-accent-brand mb-3" />
                    <h2 className="text-base font-semibold break-words">{space.name}</h2>
                    {space.description && <p className="text-sm text-cs-text-secondary mt-2 line-clamp-2">{space.description}</p>}
                    <span className="inline-flex items-center gap-2 text-sm text-cs-accent-brand mt-4">Open folder<ArrowRight size={16} /></span>
                  </button>
                </div>

                {/* Icon picker for this card */}
                {isPickerOpen && (
                  <div className="absolute top-12 left-0 z-50">
                    <IconPicker
                      value={space.icon}
                      onChange={(icon) => handleChangeIcon(space.id, icon)}
                      onClose={() => setIconPickerFor(null)}
                    />
                  </div>
                )}

                {editingSpaceId === space.id && (
                  <div className="mt-2 cs-card p-3 space-y-2 border-cs-accent-brand/40">
                    <p className="text-[10px] text-cs-text-muted uppercase tracking-wide">Edit folder</p>
                    <input
                      autoFocus
                      maxLength={120}
                      aria-label="Folder name"
                      value={editSpaceName}
                      onChange={(e) => setEditSpaceName(e.target.value)}
                      className="cs-input text-xs"
                      placeholder="Folder name"
                    />
                    <input
                      maxLength={2000}
                      aria-label="Folder description"
                      value={editSpaceDesc}
                      onChange={(e) => setEditSpaceDesc(e.target.value)}
                      className="cs-input text-xs"
                      placeholder="Description"
                    />
                    <div className="flex gap-2">
                      <button disabled={savingSpace || !editSpaceName.trim()} onClick={handleUpdateSpace} className="cs-btn-primary text-xs px-3 py-1.5">{savingSpace ? "Saving..." : "Save"}</button>
                      <button disabled={savingSpace} onClick={() => setEditingSpaceId(null)} className="text-xs text-cs-text-muted hover:text-cs-text-secondary">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>}

        {/* Active space detail */}
        {active && (
          <div className="cs-card p-5 space-y-4">
            {/* Upload area */}
            <label className="block border-2 border-dashed border-cs-border rounded-xl p-6 sm:p-8 text-center cursor-pointer hover:border-cs-accent-brand focus-within:ring-2 focus-within:ring-cs-accent-brand transition">
              <input
                type="file"
                multiple
                className="sr-only"
                aria-label={`Upload files to ${active.name}`}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.gif,.webp,.mp4,.mov,.avi,.webm,.mkv,.m4v"
                onChange={(e) => { if (e.target.files && e.target.files.length > 0) handleFileUpload(active.id, e.target.files); }}
              />
              <Upload size={20} className="mx-auto text-cs-text-muted mb-2" />
              <p className="text-base font-medium text-cs-text-primary">
                {uploading ? "Uploading..." : "Upload files"}
              </p>
              <p className="text-sm text-cs-text-secondary mt-2">
                25 MB per file. Searchable PDF, DOCX, CSV, and text support automatic processing. Other files are stored for manual review.
              </p>
            </label>

            {/* Documents list */}
            {active.space_documents && active.space_documents.length > 0 ? (
              <div className="space-y-2">
                {active.space_documents.map((doc) => (
                  <div key={doc.id} className="flex flex-wrap sm:flex-nowrap items-center gap-3 py-3 px-3 bg-cs-bg rounded-md group">
                    {doc.file_type.startsWith("video/") ? <Video size={14} className="text-cs-text-muted flex-shrink-0" /> : <FileText size={14} className="text-cs-text-muted flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-cs-text-primary truncate">{doc.name}</p>
                      <p className="text-[10px] text-cs-text-muted">
                        {doc.file_type} · {formatSize(doc.file_size || 0)} · {new Date(doc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-xs text-cs-text-secondary shrink-0">{doc.processing_status === "complete" ? "Text ready" : doc.processing_status === "failed" ? "Needs review" : "Uploaded"}</span>
                    <button
                      onClick={() => handleDeleteDocument(active.id, doc.id)}
                      className="opacity-70 hover:opacity-100 text-cs-text-muted hover:text-cs-accent-red min-h-11 min-w-11 flex items-center justify-center p-2 rounded transition flex-shrink-0"
                      aria-label={`Delete ${doc.name}`}
                      title="Delete file"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-cs-text-muted text-center py-4">No documents yet. Upload files to get started.</p>
            )}

            {/* Links section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Globe size={14} className="text-cs-accent-brand" />
                <h4 className="text-xs font-medium text-cs-text-primary">Links</h4>
                {(spaceLinks[active.id] || []).length > 0 && (
                  <span className="text-[10px] text-cs-text-muted">
                    {(spaceLinks[active.id] || []).length}
                  </span>
                )}
              </div>

              {(spaceLinks[active.id] || []).length > 0 ? (
                <div className="space-y-1.5 mb-3">
                  {(spaceLinks[active.id] || []).map((link) => (
                    <div key={link.id} className="flex items-center gap-3 py-2 px-3 bg-cs-bg rounded-md group">
                      <div className="w-7 h-7 rounded-md bg-cs-card border border-cs-border flex items-center justify-center flex-shrink-0">
                        <Globe size={13} className="text-cs-text-muted" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-cs-text-primary font-medium truncate">{link.title}</p>
                        <p className="text-[10px] text-cs-text-muted truncate">{link.url}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-70 hover:opacity-100 transition">
                        <a href={link.url} target="_blank" rel="noreferrer" aria-label={`Open ${link.title}`}
                          className="text-cs-text-muted hover:text-cs-accent-brand p-1 rounded">
                          <ExternalLink size={12} />
                        </a>
                        <button
                          aria-label={`Delete ${link.title} link`}
                          onClick={() => handleDeleteLink(active.id, link.id)}
                          className="text-cs-text-muted hover:text-cs-accent-red min-h-11 min-w-11 flex items-center justify-center p-2 rounded"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-cs-text-muted text-center py-3 mb-3">
                  No links added yet. Add URLs important to this property.
                </p>
              )}

              {showAddLink && (
                <div className="bg-cs-bg border border-cs-border rounded-lg p-3 mb-3 space-y-2">
                  <input
                    type="text"
                    value={newLinkTitle}
                    onChange={(e) => setNewLinkTitle(e.target.value)}
                    placeholder="Link title (e.g. Booking Engine)"
                    className="cs-input text-xs w-full"
                    autoFocus
                  />
                  <input
                    type="url"
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                    placeholder="https://..."
                    className="cs-input text-xs w-full"
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddLink(active.id); }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAddLink(active.id)}
                      disabled={addingLink || !newLinkTitle.trim() || !newLinkUrl.trim()}
                      className="cs-btn-primary text-xs px-3 py-1.5"
                    >
                      {addingLink ? "Adding..." : "Add"}
                    </button>
                    <button
                      onClick={() => { setShowAddLink(false); setNewLinkUrl(""); setNewLinkTitle(""); }}
                      className="text-xs text-cs-text-muted"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {!showAddLink && (
                <button
                  onClick={() => setShowAddLink(true)}
                  className="flex items-center gap-1.5 text-xs text-cs-text-muted hover:text-cs-accent-brand transition w-full py-1.5 border border-dashed border-cs-border rounded-md justify-center hover:border-cs-accent-brand/50"
                >
                  <Plus size={12} /> Add link
                </button>
              )}
            </div>
          </div>
        )}
        {active && <SubmissionBar jobId={jobId} revision={spaces.reduce((total,s)=>total+(s.space_documents?.length||0),0)}/>}
      </div>

      {/* Comments */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold text-cs-text-primary mb-4">Team Comments</h3>
        <CommentFeed
          comments={comments}
          users={commentUsers}
          currentUser={user ? {
            id: user.id,
            email: user.email || profile?.email || "",
            full_name: profile?.full_name || user.email || "",
            role: profile?.role || (isAdmin ? "admin" : "member"),
          } : null}
          jobId={jobId}
          onUpdate={loadComments}
        />
      </div>
    </div>
  );
}
