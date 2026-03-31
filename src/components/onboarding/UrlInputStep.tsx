"use client";

import { useState } from "react";
import { useOnboardingStore } from "@/lib/store";
import { VERTICALS, type Vertical } from "@/types";
import { Globe, ArrowRight, ArrowLeft } from "lucide-react";

export function UrlInputStep() {
  const { propertyUrl, setPropertyUrl, vertical, setVertical, setStep } =
    useOnboardingStore();
  const [urlError, setUrlError] = useState("");

  const validateUrl = (url: string) => {
    try {
      const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
      if (!parsed.hostname.includes(".")) throw new Error();
      setUrlError("");
      return true;
    } catch {
      setUrlError("Please enter a valid URL");
      return false;
    }
  };

  const handleContinue = () => {
    const url = propertyUrl.startsWith("http")
      ? propertyUrl
      : `https://${propertyUrl}`;
    if (validateUrl(url)) {
      setPropertyUrl(url);
      setStep("file_upload");
    }
  };

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-cs-card border border-cs-border rounded-lg">
          <Globe size={20} className="text-cs-accent-blue" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-cs-text-primary">
            Property Website
          </h2>
          <p className="text-sm text-cs-text-secondary">
            Enter your property URL so we can extract information
          </p>
        </div>
      </div>

      {/* URL Input */}
      <div className="space-y-4">
        <div>
          <label className="cs-label block mb-2">PROPERTY URL</label>
          <input
            type="url"
            value={propertyUrl}
            onChange={(e) => {
              setPropertyUrl(e.target.value);
              if (urlError) setUrlError("");
            }}
            placeholder="https://yourproperty.com"
            className={`cs-input ${urlError ? "border-cs-accent-red" : ""}`}
          />
          {urlError && (
            <p className="text-xs text-cs-accent-red mt-1">{urlError}</p>
          )}
        </div>

        {/* Vertical selector */}
        <div>
          <label className="cs-label block mb-2">PROPERTY TYPE</label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.entries(VERTICALS) as [Vertical, typeof VERTICALS[Vertical]][]).map(
              ([key, meta]) => (
                <button
                  key={key}
                  onClick={() => setVertical(key)}
                  className={`
                    p-2.5 rounded-md text-left text-xs transition-colors border
                    ${vertical === key
                      ? "bg-cs-card border-cs-accent-blue text-cs-text-primary"
                      : "border-cs-border text-cs-text-secondary hover:border-cs-border-hover"
                    }
                  `}
                >
                  <span className="mr-1.5">{meta.icon}</span>
                  {meta.label}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={() => setStep("consent")} className="cs-btn-ghost">
          <ArrowLeft size={16} />
          Back
        </button>
        <button
          onClick={handleContinue}
          disabled={!propertyUrl}
          className="cs-btn-primary"
        >
          Continue
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
