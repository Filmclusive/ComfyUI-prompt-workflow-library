import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import {
  comfyUiDictionaryItems,
  comfyUiPipelineOverview,
  comfyUiSuggestedLabels,
  type ComfyUiDictionaryCategory,
} from "../data/comfyUiDictionary";

function groupByCategory() {
  const cats = new Map<ComfyUiDictionaryCategory, typeof comfyUiDictionaryItems>();
  for (const item of comfyUiDictionaryItems) {
    const list = cats.get(item.category) ?? [];
    list.push(item);
    cats.set(item.category, list);
  }
  return Array.from(cats.entries());
}

export function DictionaryPage() {
  const [params, setParams] = useSearchParams();
  const selectedTermId = params.get("term");
  const [query, setQuery] = useState("");

  const itemsById = useMemo(() => {
    const map = new Map<string, (typeof comfyUiDictionaryItems)[number]>();
    for (const i of comfyUiDictionaryItems) map.set(i.id, i);
    return map;
  }, []);

  const selected = selectedTermId ? itemsById.get(selectedTermId) : null;

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = groupByCategory();
    if (!q) return all;
    return all
      .map(([cat, list]) => {
        const filtered = list.filter((t) => {
          const hay = [
            t.term,
            t.analogyTerm ?? "",
            t.category,
            t.plainDefinition,
            t.technicalDefinition,
          ]
            .join(" ")
            .toLowerCase();
          return hay.includes(q);
        });
        return [cat, filtered] as const;
      })
      .filter(([, list]) => list.length > 0);
  }, [query]);

  function selectTerm(termId: string) {
    const next = new URLSearchParams(params);
    next.set("term", termId);
    setParams(next, { replace: true });
  }

  function clearSelection() {
    const next = new URLSearchParams(params);
    next.delete("term");
    setParams(next, { replace: true });
  }

  return (
    <div className="h-[calc(100vh-0px)] overflow-hidden p-4 max-w-6xl flex flex-col">
      <div className="text-lg font-semibold text-fg">ComfyUI dictionary</div>
      <div className="mt-2 text-sm text-muted">
        Plain-language definitions for common ComfyUI and diffusion terms.
      </div>

      <div className="mt-5 flex-1 min-h-0 grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <div className="rounded-lg border border-border bg-surface p-4 flex flex-col min-h-0">
          <div className="text-sm font-semibold text-fg">Terms</div>
          <div className="mt-3">
            <Input value={query} onChange={setQuery} placeholder="Search terms" />
          </div>

          <div className="mt-4 flex-1 min-h-0 overflow-auto pr-1 space-y-4">
            {grouped.map(([cat, list]) => (
              <div key={cat}>
                <div className="text-xs font-medium text-muted-2">{cat}</div>
                <div className="mt-1 space-y-1">
                  {list.map((t) => {
                    const isSelected = selected?.id === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => selectTerm(t.id)}
                        className={
                          isSelected
                            ? "w-full text-left rounded-md bg-surface-2 px-2.5 py-2 text-sm font-medium text-fg"
                            : "w-full text-left rounded-md px-2.5 py-2 text-sm text-muted hover:bg-surface-hover hover:text-fg"
                        }
                      >
                        {t.term}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {grouped.length === 0 && (
              <div className="text-sm text-muted">No matches.</div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 min-h-0 overflow-auto">
          {selected ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-fg">{selected.term}</div>
                  <div className="mt-1 text-xs text-muted-2">{selected.category}</div>
                </div>
                <Button variant="secondary" onClick={clearSelection}>
                  Overview
                </Button>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <div className="text-xs font-medium text-muted-2">Technical definition</div>
                  <div className="mt-1 text-sm text-muted">{selected.technicalDefinition}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-2">Plain definition</div>
                  <div className="mt-1 text-sm text-muted">{selected.plainDefinition}</div>
                </div>
                {(selected.analogyTerm || selected.analogyExplanation) && (
                  <div>
                    <div className="text-xs font-medium text-muted-2">Analogy</div>
                    {selected.analogyTerm && (
                      <div className="mt-1 text-sm font-medium text-fg">{selected.analogyTerm}</div>
                    )}
                    {selected.analogyExplanation && (
                      <div className="mt-1 text-sm text-muted">{selected.analogyExplanation}</div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-semibold text-fg">Complete generation pipeline</div>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
                {comfyUiPipelineOverview.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>

              <div className="mt-6 text-sm font-semibold text-fg">Suggested UI naming</div>
              <div className="mt-2 overflow-hidden rounded-md border border-border">
                <div className="grid grid-cols-2 gap-3 bg-surface-2 px-3 py-2 text-xs font-medium text-muted-2">
                  <div>Technical term</div>
                  <div>User label</div>
                </div>
                <div className="divide-y divide-border">
                  {comfyUiSuggestedLabels.map((row) => (
                    <div key={row.technical} className="grid grid-cols-2 gap-3 px-3 py-2 text-sm">
                      <div className="text-fg">{row.technical}</div>
                      <div className="text-muted">{row.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
