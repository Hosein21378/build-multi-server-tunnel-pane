import type { Metadata } from "next";
import Link from "next/link";

import { CodeBlock } from "@/components/CodeBlock";
import { CopyButton } from "@/components/CopyButton";
import { ScriptViewer } from "@/components/ScriptViewer";
import { getDashboardData } from "@/lib/data";
import { faBytes, faNum } from "@/lib/format";
import { REAL_RAW } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "کد کامل install.sh اصلاح‌شده",
  description: "مرور کامل نصب‌کنندهٔ اصلاح‌شدهٔ TunnelHub با شماره خط و مشخص‌کردن نقاط اصلاح.",
};

export default async function ScriptPage() {
  const data = await getDashboardData();
  const verifyCommand = `echo "${data.script.sha256}  install.sh" | sha256sum -c -`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/" className="text-xs font-semibold text-sky hover:text-mint">
            ← بازگشت به داشبورد
          </Link>
          <h1 className="mt-2 text-xl font-extrabold text-slate-100 sm:text-2xl">کد کامل install.sh اصلاح‌شده</h1>
          <p className="mt-1 text-xs leading-6 text-slate-400">
            نسخهٔ {data.script.version} · {faBytes(data.script.byteSize)} · {faNum(data.script.lineCount)} خط ·{" "}
            {faNum(data.findings.length)} اصلاح. خطوط دارای نشانهٔ <span className="mono text-mint"># FIX</span> با
            رنگ سبز مشخص شده‌اند.
          </p>
        </div>
        <div className="flex gap-2">
          <a href="/api/download/install.sh" download className="btn btn-primary">
            ⬇ دانلود install.sh
          </a>
          <Link href="/#fixes" className="btn btn-ghost">
            فهرست اصلاحات
          </Link>
        </div>
      </div>

      <div className="panel mt-6 flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <span className="chip border-mint/40 bg-mint/10 text-mint">sha256</span>
          <span className="mono truncate text-[11px] text-slate-300">{data.script.sha256}</span>
          <CopyButton value={data.script.sha256} className="shrink-0 text-[11px] text-sky hover:text-mint" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip">
            منبع اصلی: <span className="mono ms-1 text-slate-300">-pane/install.sh</span>
          </span>
          <a href="/downloads/install.sh" download className="chip hover:border-mint/50 hover:text-mint">
            لینک استاتیک
          </a>
        </div>
      </div>

      <div className="mt-4">
        <ScriptViewer content={data.script.content} fileName={data.script.fileName} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <h2 className="text-sm font-bold text-slate-100">تأیید checksum قبل از اجرا</h2>
          <p className="mt-1 text-xs leading-6 text-slate-400">
            این خروجی باید با مقدار بالا یکسان باشد. اگر نبود، فایل را دوباره از همین صفحه دانلود کنید.
          </p>
          <div className="mt-3">
            <CodeBlock code={verifyCommand} />
          </div>
        </div>
        <div className="panel p-5">
          <h2 className="text-sm font-bold text-slate-100">دانلود مستقیم از مخزن واقعی</h2>
          <p className="mt-1 text-xs leading-6 text-slate-400">
            نسخهٔ خام و بدون اصلاح مخزن (برای مقایسه). توجه کنید که آدرس درست با{" "}
            <span className="mono text-mint">-pane</span> تمام می‌شود، نه <span className="mono text-danger">-panel</span>.
          </p>
          <div className="mt-3">
            <CodeBlock code={`curl -fsSL "${REAL_RAW}" -o upstream-install.sh\nbash upstream-install.sh --dry-run  # نیاز به root دارد`} />
          </div>
        </div>
      </div>
    </div>
  );
}
