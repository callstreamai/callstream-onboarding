"use client";

import { useState, useRef, useEffect } from "react";
import { Comment } from "@/types/project";
import { Send, AtSign } from "lucide-react";

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

interface Props {
  comments: Comment[];
  users: UserProfile[];
  currentUser: UserProfile | null;
  jobId: string;
  onUpdate: () => void;
}

export default function CommentFeed({ comments, users, currentUser, jobId, onUpdate }: Props) {
  const [body, setBody] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [cursorPos, setCursorPos] = useState(0);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Mention list: always include @CallStreamAI, plus all users
  const mentionOptions = [
    { id: "callstreamai", label: "CallStreamAI", sub: "All admins" },
    ...users.map((u) => ({
      id: u.email,
      label: u.full_name || u.email,
      sub: u.role,
    })),
  ];

  const filteredMentions = mentionOptions.filter(
    (m) =>
      m.label.toLowerCase().includes(mentionQuery.toLowerCase()) ||
      m.id.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  function handleInput(val: string) {
    setBody(val);

    // Detect @ mention
    const pos = inputRef.current?.selectionStart || 0;
    setCursorPos(pos);
    const textBefore = val.slice(0, pos);
    const atMatch = textBefore.match(/@(\w*)$/);
    if (atMatch) {
      setShowMentions(true);
      setMentionQuery(atMatch[1]);
    } else {
      setShowMentions(false);
    }
  }

  function insertMention(option: { id: string; label: string }) {
    const textBefore = body.slice(0, cursorPos);
    const textAfter = body.slice(cursorPos);
    const atIdx = textBefore.lastIndexOf("@");
    const newText = textBefore.slice(0, atIdx) + "@" + option.label + " " + textAfter;
    setBody(newText);
    setShowMentions(false);
    inputRef.current?.focus();
  }

  function extractMentions(text: string): string[] {
    const mentions: string[] = [];
    const regex = /@(\S+)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const name = match[1];
      if (name.toLowerCase() === "callstreamai") {
        mentions.push("callstreamai");
      } else {
        const user = users.find(
          (u) =>
            (u.full_name && u.full_name.toLowerCase() === name.toLowerCase()) ||
            u.email.toLowerCase() === name.toLowerCase()
        );
        if (user) mentions.push(user.email);
      }
    }
    return mentions;
  }

  async function sendComment() {
    if (!body.trim() || !currentUser) return;
    setSending(true);

    const mentions = extractMentions(body);

    await fetch("/api/jobs/" + jobId + "/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body,
        authorId: currentUser.id,
        mentions,
      }),
    });

    setBody("");
    setSending(false);
    onUpdate();
  }

  function renderBody(text: string) {
    // Highlight @mentions
    return text.replace(/@(\S+)/g, function (match) {
      return match;
    });
  }

  function formatTime(date: string) {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return diffMins + "m ago";
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return diffHrs + "h ago";
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return diffDays + "d ago";
    return d.toLocaleDateString();
  }

  return (
    <div className="space-y-4">
      {/* Compose */}
      <div className="cs-card p-4 space-y-3 relative">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={body}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !showMentions) {
                e.preventDefault();
                sendComment();
              }
            }}
            placeholder={"Write a comment... Use @ to mention someone"}
            className="cs-input h-20 resize-none pr-10"
          />

          {/* Mention dropdown */}
          {showMentions && filteredMentions.length > 0 && (
            <div className="absolute left-0 bottom-full mb-1 w-64 bg-cs-card border border-cs-border rounded-lg shadow-lg max-h-48 overflow-y-auto z-20">
              {filteredMentions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => insertMention(opt)}
                  className="w-full text-left px-3 py-2 hover:bg-cs-border/50 flex items-center gap-2"
                >
                  <AtSign size={12} className="text-cs-accent-blue flex-shrink-0" />
                  <div>
                    <p className="text-xs text-cs-text-primary">{opt.label}</p>
                    <p className="text-[10px] text-cs-text-muted">{opt.sub}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            onClick={sendComment}
            disabled={!body.trim() || sending}
            className="cs-btn-primary text-xs px-3 py-1.5"
          >
            <Send size={12} />
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>

      {/* Comments */}
      {comments.length === 0 ? (
        <div className="text-center py-12 text-cs-text-muted text-sm">
          No comments yet. Start the conversation.
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="cs-card p-4">
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-7 h-7 rounded-full bg-cs-accent-blue/20 flex items-center justify-center text-xs text-cs-accent-blue font-medium flex-shrink-0">
                  {(c.author_name || c.author_email || "?")[0].toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-cs-text-primary">
                      {c.author_name || c.author_email}
                    </span>
                    <span className="text-[10px] text-cs-text-muted">
                      {formatTime(c.created_at)}
                    </span>
                  </div>
                  <div className="text-sm text-cs-text-secondary mt-1 whitespace-pre-wrap break-words">
                    {c.body.split(/(@\S+)/g).map((part, i) =>
                      part.startsWith("@") ? (
                        <span key={i} className="text-cs-accent-blue font-medium">{part}</span>
                      ) : (
                        <span key={i}>{part}</span>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
