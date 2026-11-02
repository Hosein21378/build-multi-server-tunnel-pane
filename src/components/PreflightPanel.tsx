"use client";

import { useState } from "react";

import { faDate } from "@/lib/format";

export type ClientCheck = {
  slug: string;
  label: string;
  url: string;
  expectOk: boolean;
  ok: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  message: string;
  source: string;
  checkedAt: string;
};

const order = ["broken-raw", "broken-repo", "real-raw", "real-repo", "self-delivery"];

function rank(slug: string) {
  const index = order.indexOf(slug);
  return index === -1 ? order.length : index;
}

function statusTone(check: ClientCheck) {
  if (!check.expectOk && !check.ok) return { dot: "bg-flare", text: "text-flare", label: "طبق انتظار خطا" };
  if (check.expectOk && check.ok) return { dot: "bg-mint", text: "text-mint", label: "سالم" };
  if (!check.expectOk && check.ok) return { dot: "bg-sky", text: "text-sky", label: "تغییر وضعیت" };
  return { dot: "bg-danger", text: "text-danger", label: "خطا" };
}

export function PreflightPanel({
  initial,
  initialDownloads,
}: {
  initial: ClientCheck[];
  initialDownloads: number;
}) {
  const [checks, setChecks] = useState<ClientCheck[]>(() => [...initial].sort((a, b) => rank(a.slug) - rank(b.slug)));
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState(0);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch("/api/preflight", { method: "POST" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as { ok: boolean; checks: ClientCheck[] };
      if (!data.ok || !Array.isArray(data.checks)) throw new Error("پاسخ نامعتبر از سرور");
      setChecks([...data.checks].sort((a, b) => rank(a.slug) - rank(b.slug)));
      setRuns((value) => value + 1);
      setLastChecked(new Date().toISOString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "بررسی زنده انجام نشد");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-line/70 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="pulse-dot" aria-hidden="true" />
            <h3 className="text-base font-bold text-slate-100">بررسی زندهٔ آدرس‌ها</h3>
          </div>
          <p className="mt-1.5 text-xs leading-6 text-slate-400">
            این پنل خودش آدرس‌های خراب و سالم را از سرور بررسی می‌کند؛ نتیجه در دیتابیس ذخیره می‌شود.
            {lastChecked ? ` آخرین اجرا: ${faDate(lastChecked)}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="btn btn-ghost shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {running ? (
            <>
              <span className="inline-block size-3.5 animate-spin rounded-full border-2 border-mint/40 border-t-mint" />
              در حال بررسی…
            </>
          ) : (
            <>↻ اجرای بررسی زنده</>
          )}
        </button>
      </div>

      {error ? (
        <div className="border-b border-danger/30 bg-danger/10 px-5 py-2.5 text-xs text-danger">
          بررسی انجام نشد: {error} — اتصال شبکهٔ سرور میزبان را ببینید.
        </div>
      ) : null}

      <ul className="divide-y divide-line/60">
        {checks.map((check) => {
          const tone = statusTone(check);
          return (
            <li key={check.slug} className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className={`size-2 rounded-full ${tone.dot}`} aria-hidden="true" />
                <span className="text-sm font-semibold text-slate-200">{check.label}</span>
                <span className={`mono rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] ${tone.text}`}>
                  {check.statusCode ?? "ERR"}
                </span>
                <span className="chip">{check.expectOk ? "باید ۲۰۰ باشد" : "باید ۴۰۴ باشد (باگ)"}</span>
                <span className={`chip ${tone.text}`}>{tone.label}</span>
                {check.latencyMs != null ? (
                  <span className="mono text-[10px] text-slate-500">{check.latencyMs}ms</span>
                ) : null}
                <span className="ms-auto text-[10px] text-slate-500">{faDate(check.checkedAt)}</span>
              </div>
              <div className="mono mt-2 truncate rounded-md bg-black/30 px-2 py-1 text-[11px] text-slate-400" dir="ltr">
                {check.url}
              </div>
              <p className="mt-2 text-xs leading-6 text-slate-400">{check.message}</p>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2 bg-black/20 px-5 py-3 text-[11px] text-slate-500">
        <span>
          {runs > 0 ? `این نشست: ${runs} بررسی زنده` : "آمادهٔ بررسی — دکمه را بزنید"}
          {" · "}
          دانلودهای ثبت‌شده: {new Intl.NumberFormat("fa-IR").format(initialDownloads)}
        </span>
        <span className="mono">POST /api/preflight</span>
      </div>
    </div>
  );
}
