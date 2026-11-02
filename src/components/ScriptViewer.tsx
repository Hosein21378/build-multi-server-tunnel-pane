"use client";

import { useMemo, useState } from "react";

import { CopyButton } from "@/components/CopyButton";
import { faNum } from "@/lib/format";

export function ScriptViewer({ content, fileName }: { content: string; fileName: string }) {
  const [query, setQuery] = useState("");
  const [onlyFixes, setOnlyFixes] = useState(false);

  const lines = useMemo(() => content.split("\n"), [content]);

  const fixLines = useMemo(
    () =>
      lines
        .map((line, index) => ({ line, index }))
        .filter((item) => /#\s*FIX\s*\d+/i.test(item.line))
        .map((item) => item.index),
    [lines],
  );

  const filterSet = useMemo(() => {
    if (!onlyFixes) return null;
    const set = new Set<number>();
    for (const index of fixLines) {
      for (let offset = -2; offset <= 3; offset += 1) {
        const target = index + offset;
        if (target >= 0 && target < lines.length) set.add(target);
      }
    }
    return set;
  }, [fixLines, lines.length, onlyFixes]);

  const needle = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      lines
        .map((line, index) => ({ line, index }))
        .filter((item) => (filterSet ? filterSet.has(item.index) : true))
        .filter((item) => (needle ? item.line.toLowerCase().includes(needle) : true)),
    [filterSet, lines, needle],
  );

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line/70 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mono text-xs text-mint">{fileName}</span>
          <span className="chip">{faNum(lines.length)} خط</span>
          <span className="chip">{faNum(fixLines.length)} نقطهٔ اصلاح</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 rounded-lg border border-line bg-black/30 px-2 py-1.5">
            <span className="text-[11px] text-slate-500">جستجو</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="RUNTIME, REPO_URL …"
              className="mono w-36 bg-transparent text-[11px] text-slate-200 outline-none placeholder:text-slate-600 sm:w-44"
              dir="ltr"
            />
          </label>
          <button
            type="button"
            onClick={() => setOnlyFixes((value) => !value)}
            aria-pressed={onlyFixes}
            className={`chip transition ${
              onlyFixes ? "border-mint/60 bg-mint/10 text-mint" : "hover:border-slate-500 hover:text-slate-200"
            }`}
          >
            فقط خطوط اصلاح‌شده
          </button>
          <CopyButton
            value={content}
            label="کپی کل اسکریپت"
            className="rounded-lg border border-line bg-white/5 px-2.5 py-1.5 text-[11px] text-slate-200 hover:bg-white/10"
          />
        </div>
      </div>

      <div className="max-h-[70vh] overflow-auto bg-[#050a12]">
        <table className="w-full border-collapse">
          <tbody>
            {visible.map((item) => {
              const isFix = /#\s*FIX\s*\d+/i.test(item.line);
              const isShebang = item.index === 0;
              return (
                <tr key={item.index} className={`line-row align-top ${isFix ? "bg-mint/[0.06]" : ""}`}>
                  <td className="mono w-12 select-none border-e border-white/[0.05] px-2 py-0.5 text-end text-[11px] text-slate-600">
                    {item.index + 1}
                  </td>
                  <td
                    dir="ltr"
                    className={`mono whitespace-pre px-3 py-0.5 text-[12px] leading-6 ${
                      isFix ? "text-mint" : isShebang ? "text-sky" : "text-slate-300"
                    }`}
                  >
                    {item.line || " "}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visible.length === 0 ? (
          <p className="p-6 text-center text-xs text-slate-500">خطی با این جستجو پیدا نشد.</p>
        ) : null}
      </div>
    </div>
  );
}
