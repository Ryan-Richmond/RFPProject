"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Sparkles, X } from "lucide-react";

export interface TagSuggestion {
  value: string; // What gets stored in the tag list (e.g. "541512" or "Cloud Migration")
  label?: string; // Display label if different from value (e.g. NAICS title)
  hint?: string; // Optional secondary text shown to the right (e.g. group name)
  rationale?: string; // Why this was suggested (shown under label)
}

interface SuggestingTagInputProps {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  placeholder: string;
  // Synchronous local suggestions filtered as user types (and on focus).
  getLocalSuggestions: (query: string, existing: string[]) => TagSuggestion[];
  // Optional asynchronous AI suggestions, fetched via the "Suggest with AI" button.
  fetchAiSuggestions?: (freeText: string, existing: string[]) => Promise<TagSuggestion[]>;
  // Optional callback for rendering the display label of a saved tag (e.g. "541512 — Computer Systems Design").
  renderTagLabel?: (tag: string) => string;
  // If true, the input field accepts only digits (used for NAICS).
  numericOnly?: boolean;
  aiButtonLabel?: string;
}

export function SuggestingTagInput({
  tags,
  onAdd,
  onRemove,
  placeholder,
  getLocalSuggestions,
  fetchAiSuggestions,
  renderTagLabel,
  numericOnly,
  aiButtonLabel = "Suggest with AI",
}: SuggestingTagInputProps) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<TagSuggestion[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const localSuggestions = getLocalSuggestions(input, tags);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function commit(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (tags.includes(trimmed)) {
      setInput("");
      return;
    }
    onAdd(trimmed);
    setInput("");
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (localSuggestions.length > 0) {
        commit(localSuggestions[0].value);
      } else if (input.trim()) {
        commit(input);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  async function handleAiSuggest() {
    if (!fetchAiSuggestions) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const results = await fetchAiSuggestions(input, tags);
      setAiSuggestions(results);
      if (results.length === 0) {
        setAiError("No suggestions returned. Try filling in the business description first.");
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI suggestion failed");
    } finally {
      setAiLoading(false);
    }
  }

  function dismissAiSuggestion(value: string) {
    setAiSuggestions((s) => s.filter((sg) => sg.value !== value));
  }

  return (
    <div className="space-y-2" ref={wrapperRef}>
      {/* Current tags */}
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 pr-1">
            <span>{renderTagLabel ? renderTagLabel(tag) : tag}</span>
            <button
              type="button"
              onClick={() => onRemove(tag)}
              className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>

      {/* Input row */}
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <Input
            value={input}
            onChange={(e) => {
              const next = numericOnly
                ? e.target.value.replace(/\D/g, "").slice(0, 6)
                : e.target.value;
              setInput(next);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="text-sm"
            inputMode={numericOnly ? "numeric" : "text"}
          />

          {open && localSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-md border bg-popover shadow-lg">
              {localSuggestions.map((s) => (
                <button
                  type="button"
                  key={s.value}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit(s.value);
                  }}
                  className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {s.label || s.value}
                    </p>
                    {s.label && s.label !== s.value && (
                      <p className="text-xs text-muted-foreground truncate">
                        {s.value}
                      </p>
                    )}
                  </div>
                  {s.hint && (
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {s.hint}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => commit(input)}
          disabled={!input.trim()}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>

        {fetchAiSuggestions && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAiSuggest}
            disabled={aiLoading}
            className="gap-1.5 shrink-0"
            title="Use uploaded docs and the business description to suggest entries"
          >
            {aiLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {aiButtonLabel}
          </Button>
        )}
      </div>

      {/* AI suggestions panel */}
      {(aiSuggestions.length > 0 || aiError) && (
        <div className="rounded-md border bg-primary/[0.03] p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              AI suggestions
            </p>
            <button
              type="button"
              onClick={() => {
                setAiSuggestions([]);
                setAiError(null);
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
          {aiError ? (
            <p className="text-xs text-muted-foreground italic">{aiError}</p>
          ) : (
            <div className="space-y-1.5">
              {aiSuggestions.map((s) => (
                <div
                  key={s.value}
                  className="flex items-start justify-between gap-3 rounded border bg-background px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {s.label ? `${s.value} — ${s.label}` : s.value}
                    </p>
                    {s.rationale && (
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        {s.rationale}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        commit(s.value);
                        dismissAiSuggestion(s.value);
                      }}
                    >
                      Add
                    </Button>
                    <button
                      type="button"
                      onClick={() => dismissAiSuggestion(s.value)}
                      className="rounded-full p-1 hover:bg-muted"
                      aria-label="Dismiss"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
