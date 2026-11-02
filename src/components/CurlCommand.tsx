"use client";

import { useEffect, useState } from "react";

import { CopyButton } from "@/components/CopyButton";

type Mode = "install" | "check" | "verify";

const tabs: { id: Mode; label: string }[] = [
  { id: "install", label: "نصب کامل" },
  { id: "check", label: "فقط بررسی (dry-run)" },
  { id: "verify", label: "دانلود + تأیید sha256" },
];

export function CurlCommand({ sha256 }: { sha256: string }) {
  const [origin, setOrigin] = useState("");
  const [mode, setMode] = useState<Mode>("install");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const url = `${origin || "https://your-host"}/api/download/install.sh`;

  const command =
    mode === "install"
      ? [
          `curl -fsSL "${url}" -o install.sh \\`,
          "  && test -s install.sh \\",
          "  && sudo bash install.sh --dry-run \\",
          "  && sudo bash install.sh",
        ].join("\n")
      : mode === "check"
        ? [`curl -fsSL "${url}" -o install.sh \\`, "  && test -s install.sh \\", "  && sudo bash install.sh --dry-run"].join(
            "\n",
          )
        : [
            `curl -fsSL "${url}" -o install.sh \\`,
            `  && echo "${sha256}  install.sh" | sha256sum -c -`,
          ].join("\n");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="نوع دستور">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={mode === tab.id}
            onClick={() => setMode(tab.id)}
            className={`chip transition ${
              mode === tab.id
                ? "border-mint/60 bg-mint/10 text-mint"
                : "hover:border-slate-500 hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="code-shell">
        <div
          dir="rtl"
          className="flex items-center justify-between gap-2 border-b border-white/[0.07] px-3 py-1.5"
        >
          <span className="text-[11px] text-slate-400">در ترمینال سرور اجرا کنید</span>
          <CopyButton
            value={command}
            label="کپی دستور"
            className="rounded-md border border-white/10 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-white/10"
          />
        </div>
        <pre>{command}</pre>
      </div>
      <p className="text-xs leading-6 text-slate-400">
        مرحلهٔ <span className="mono text-mint">--dry-run</span> هیچ چیزی را روی سرور تغییر نمی‌دهد؛ فقط گزینه‌ها و
        دسترسی به مخزن را بررسی می‌کند. اگر سبز بود، نصب اصلی را اجرا کنید.
      </p>
    </div>
  );
}
