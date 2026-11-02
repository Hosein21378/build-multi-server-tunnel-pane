"use client";

import { useMemo, useState } from "react";

import { CodeBlock } from "@/components/CodeBlock";
import type { Finding } from "@/lib/findings";
import { severityMeta, type Severity } from "@/lib/site";
import { faNum } from "@/lib/format";

const severityStyles: Record<Severity, string> = {
  critical: "border-danger/45 bg-danger/10 text-danger",
  high: "border-flare/45 bg-flare/10 text-flare",
  medium: "border-sky/45 bg-sky/10 text-sky",
  low: "border-slate-500/40 bg-white/5 text-slate-300",
};

type Filter = "all" | Severity;

export function FindingsExplorer({ findings }: { findings: Finding[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(findings[0]?.slug ?? null);

  const counts = useMemo(() => {
    const base: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const finding of findings) base[finding.severity] += 1;
    return base;
  }, [findings]);

  const visible = useMemo(
    () => (filter === "all" ? findings : findings.filter((finding) => finding.severity === filter)),
    [filter, findings],
  );

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "همه", count: findings.length },
    ...(Object.keys(severityMeta) as Severity[]).map((severity) => ({
      id: severity as Filter,
      label: severityMeta[severity].fa,
      count: counts[severity],
    })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            aria-pressed={filter === item.id}
            className={`chip transition ${
              filter === item.id ? "border-mint/60 bg-mint/10 text-mint" : "hover:border-slate-500 hover:text-slate-200"
            }`}
          >
            {item.label}
            <span className="mono text-[10px] text-current/70">{faNum(item.count)}</span>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {visible.map((finding, index) => {
          const isOpen = open === finding.slug;
          return (
            <article key={finding.slug} className="panel-soft overflow-hidden">
              <div className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${severityStyles[finding.severity]}`}
                  >
                    {severityMeta[finding.severity].fa}
                  </span>
                  <span className="chip">{finding.category}</span>
                  <span className="mono rounded-md bg-black/30 px-1.5 py-0.5 text-[10px] text-slate-400">
                    {finding.target}
                    {finding.line ? `:${finding.line}` : ""}
                  </span>
                  <span className="mono ms-auto text-[10px] text-slate-600">
                    #{String(index + 1).padStart(2, "0")}
                  </span>
                </div>

                <h3 className="mt-2.5 text-[15px] font-bold leading-7 text-slate-100">{finding.title}</h3>
                <p className="mt-1.5 text-[13px] leading-6 text-slate-400">
                  <span className="text-slate-300">اثر روی نصب: </span>
                  {finding.impact}
                </p>

                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : finding.slug)}
                  aria-expanded={isOpen}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-sky transition hover:text-mint"
                >
                  {isOpen ? "بستن جزئیات" : "دیدن علت و کد اصلاح"}
                  <span className={`inline-block transition ${isOpen ? "rotate-180" : ""}`} aria-hidden="true">
                    ▾
                  </span>
                </button>
              </div>

              {isOpen ? (
                <div className="space-y-3 border-t border-line/70 bg-black/20 p-4 sm:p-5">
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-300">علت دقیق</h4>
                    <p className="text-[13px] leading-7 text-slate-400">{finding.detail}</p>
                  </div>
                  <div className="rounded-xl border border-mint/25 bg-mint/[0.06] p-3">
                    <h4 className="text-xs font-bold text-mint">چه چیزی اصلاح شد</h4>
                    <p className="mt-1 text-[13px] leading-7 text-slate-300">{finding.fix}</p>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {finding.beforeCode ? (
                      <CodeBlock code={finding.beforeCode} label="قبل — کد مشکل‌دار" tone="before" />
                    ) : null}
                    {finding.afterCode ? (
                      <CodeBlock code={finding.afterCode} label="بعد — کد اصلاح‌شده" tone="after" />
                    ) : null}
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
