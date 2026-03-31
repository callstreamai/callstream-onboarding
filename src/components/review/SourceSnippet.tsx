import type { SourceSnippet } from "@/types";
import { Globe, FileText } from "lucide-react";

interface Props {
  snippet: SourceSnippet;
}

export function SourceSnippetView({ snippet }: Props) {
  return (
    <div className="bg-cs-surface border border-cs-border rounded-md p-3">
      <div className="flex items-center gap-2 mb-1.5">
        {snippet.source_type === "web" ? (
          <Globe size={12} className="text-cs-accent-blue" />
        ) : (
          <FileText size={12} className="text-cs-accent-purple" />
        )}
        <span className="text-[10px] text-cs-text-muted uppercase">
          {snippet.source_name}
        </span>
        {snippet.page_url && (
          <a
            href={snippet.page_url}
            target="_blank"
            className="text-[10px] text-cs-accent-blue hover:underline ml-auto"
          >
            View
          </a>
        )}
      </div>
      <p className="text-xs text-cs-text-secondary leading-relaxed">
        &ldquo;{snippet.text}&rdquo;
      </p>
    </div>
  );
}
