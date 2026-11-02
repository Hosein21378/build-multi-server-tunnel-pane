import type { ReactNode } from "react";
import Link from "next/link";

import { CodeBlock } from "@/components/CodeBlock";
import { CopyButton } from "@/components/CopyButton";
import { CurlCommand } from "@/components/CurlCommand";
import { FindingsExplorer } from "@/components/FindingsExplorer";
import { PreflightPanel, type ClientCheck } from "@/components/PreflightPanel";
import { getDashboardData } from "@/lib/data";
import { faBytes, faDate, faNum, shortSha } from "@/lib/format";
import { BROKEN_RAW, REAL_RAW, FIXED_VERSION, REAL_REPO } from "@/lib/site";

export const dynamic = "force-dynamic";

function SectionHeading({
  eyebrow,
  title,
  description,
  id,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  id?: string;
}) {
  return (
    <div id={id} className="mb-6 scroll-mt-24">
      <p className="section-eyebrow">{eyebrow}</p>
      <h2 className="mt-2 text-xl font-extrabold leading-9 text-slate-100 sm:text-2xl">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-3xl text-[13px] leading-7 text-slate-400">{description}</p>
      ) : null}
    </div>
  );
}

function Step({ index, title, children }: { index: number; title: string; children: ReactNode }) {
  return (
    <div className="panel-soft flex h-full flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <span className="mono grid size-7 place-items-center rounded-lg border border-mint/40 bg-mint/10 text-xs font-bold text-mint">
          {index}
        </span>
        <h3 className="text-sm font-bold text-slate-100">{title}</h3>
      </div>
      <div className="space-y-2 text-xs leading-6 text-slate-400">{children}</div>
    </div>
  );
}

export default async function HomePage() {
  const data = await getDashboardData();
  const critical = data.findings.filter((finding) => finding.severity === "critical").length;
  const high = data.findings.filter((finding) => finding.severity === "high").length;

  const clientChecks: ClientCheck[] = data.checks.map((check) => ({
    slug: check.slug,
    label: check.label,
    url: check.url,
    expectOk: check.expectOk,
    ok: check.ok,
    statusCode: check.statusCode,
    latencyMs: check.latencyMs,
    message: check.message,
    source: check.source,
    checkedAt: check.checkedAt.toISOString(),
  }));

  const readmePatch = [
    "# README.md → خط ۳۸ (دستور نصب)",
    "curl -fsSL https://raw.githubusercontent.com/Hosein21378/build-multi-server-tunnel-pane/main/install.sh -o install.sh \\",
    "  && sudo bash install.sh",
    "",
    "# install.sh → خط ۱۴ (مخزن پیش‌فرض)",
    'REPO_URL="${TUNNELHUB_REPO:-https://github.com/Hosein21378/build-multi-server-tunnel-pane.git}"',
  ].join("\n");

  const quickPatch = [
    "cd build-multi-server-tunnel-pane",
    "sed -i 's/build-multi-server-tunnel-panel/build-multi-server-tunnel-pane/g' README.md install.sh",
    "grep -rn 'tunnel-pane' README.md install.sh",
  ].join("\n");

  const verifyCommand = `echo "${data.script.sha256}  install.sh" | sha256sum -c -`;

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[560px] grid-backdrop opacity-70" aria-hidden="true" />

      <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl border border-mint/30 bg-mint/10 text-base">
            🩺
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-slate-100">Install Doctor</p>
            <p className="truncate text-[10px] text-slate-500">تعمیرکار نصب TunnelHub · نسخهٔ {FIXED_VERSION}</p>
          </div>
          <nav className="mx-auto hidden items-center gap-1 text-xs text-slate-400 lg:flex">
            <a className="rounded-lg px-3 py-1.5 hover:bg-white/5 hover:text-slate-200" href="#diagnosis">
              تشخیص
            </a>
            <a className="rounded-lg px-3 py-1.5 hover:bg-white/5 hover:text-slate-200" href="#checks">
              بررسی زنده
            </a>
            <a className="rounded-lg px-3 py-1.5 hover:bg-white/5 hover:text-slate-200" href="#fixes">
              اصلاحات
            </a>
            <a className="rounded-lg px-3 py-1.5 hover:bg-white/5 hover:text-slate-200" href="#download">
              دانلود
            </a>
            <Link className="rounded-lg px-3 py-1.5 hover:bg-white/5 hover:text-slate-200" href="/script">
              کد کامل
            </Link>
          </nav>
          <a href="/api/download/install.sh" download className="btn btn-primary ms-auto px-3 py-1.5 text-xs sm:px-4">
            ⬇ دانلود install.sh
          </a>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
        {data.degraded ? (
          <div className="mb-6 rounded-xl border border-flare/40 bg-flare/10 px-4 py-2.5 text-xs leading-6 text-flare">
            اتصال دیتابیس برقرار نشد؛ این صفحه با داده‌های همراهِ بسته (bundled) نمایش داده می‌شود. دانلود فایل همچنان
            فعال است.
          </div>
        ) : null}

        <section className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip border-mint/40 bg-mint/10 text-mint">
                <span className="size-1.5 rounded-full bg-mint" /> علت پیدا شد — ۴۰۴ واقعی
              </span>
              <span className="chip">{faNum(data.findings.length)} اصلاح انجام‌شده</span>
              <span className="chip">{faNum(data.downloads)} دانلود ثبت‌شده</span>
            </div>

            <h1 className="mt-4 text-[clamp(1.7rem,4.6vw,2.9rem)] font-black leading-[1.35] text-slate-50">
              نصب TunnelHub روی سرور
              <span className="mx-2 bg-gradient-to-l from-mint to-sky bg-clip-text text-transparent">شکست می‌خورد</span>
              — نسخهٔ اصلاح‌شده آماده است.
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">
              دستور نصب شما به مخزنی اشاره می‌کند که وجود ندارد:{" "}
              <span className="mono text-danger">build-multi-server-tunnel-panel</span> (پایان با{" "}
              <span className="mono text-danger">panel</span>). مخزن واقعی{" "}
              <span className="mono text-mint">build-multi-server-tunnel-pane</span> است. همین اختلاف یک حرفی باعث
              می‌شود <span className="mono text-slate-200">curl</span> خطای ۴۰۴ بدهد و فایل{" "}
              <span className="mono text-slate-200">install.sh</span> خالی بماند؛ داخل خود اسکریپت هم همین آدرس غلط
              hardcode شده بود و <span className="mono text-slate-200">git clone</span> را می‌شکست.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a href="/api/download/install.sh" download className="btn btn-primary">
                ⬇ دانلود install.sh اصلاح‌شده
              </a>
              <a href="#checks" className="btn btn-ghost">
                دیدن مدرک ۴۰۴
              </a>
              <Link href="/script" className="text-xs font-semibold text-sky hover:text-mint">
                مشاهدهٔ کد کامل ←
              </Link>
            </div>

            <dl className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "خط اسکریپت", value: faNum(data.script.lineCount) },
                { label: "حجم", value: faBytes(data.script.byteSize) },
                { label: "اصلاح", value: faNum(data.findings.length) },
                { label: "بحرانی", value: faNum(critical) },
              ].map((item) => (
                <div key={item.label} className="panel-soft px-3 py-2">
                  <dt className="text-[10px] text-slate-500">{item.label}</dt>
                  <dd className="mt-0.5 text-sm font-bold text-slate-200">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="panel overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line/70 bg-black/30 px-4 py-2.5">
              <span className="size-2.5 rounded-full bg-danger/80" />
              <span className="size-2.5 rounded-full bg-flare/80" />
              <span className="size-2.5 rounded-full bg-mint/80" />
              <span className="mono ms-2 text-[11px] text-slate-500">root@server:~</span>
              <span className="chip ms-auto border-danger/40 bg-danger/10 text-danger">سناریوی شکست</span>
            </div>
            <div className="mono space-y-2 p-4 text-[11px] leading-6" dir="ltr">
              <div className="break-all text-slate-300">
                <span className="text-mint">$</span> curl -fsSL https://raw.githubusercontent.com/Hosein21378/
                <span className="rounded bg-danger/20 px-0.5 text-danger">build-multi-server-tunnel-panel</span>
                /main/install.sh -o install.sh
              </div>
              <div className="text-danger">curl: (22) The requested URL returned error: 404</div>
              <div className="text-slate-300">
                <span className="text-mint">$</span> ls -l install.sh
              </div>
              <div className="text-slate-500">-rw-r--r-- 1 root root 0 install.sh</div>
              <div className="text-slate-300">
                <span className="text-mint">$</span> sudo bash install.sh
              </div>
              <div className="text-flare"># خروجی‌ای وجود ندارد؛ نصب هیچ‌وقت شروع نمی‌شود.</div>
              <div className="text-slate-300">
                <span className="text-mint">$</span> git clone https://github.com/Hosein21378/
                <span className="rounded bg-danger/20 px-0.5 text-danger">...-panel</span>.git
              </div>
              <div className="text-danger">remote: Repository not found. fatal: ... exit code 128</div>
            </div>
            <div className="border-t border-line/70 bg-mint/[0.05] px-4 py-3">
              <p className="text-[11px] leading-6 text-slate-400">
                در نسخهٔ اصلاح‌شده، قبل از هر تغییری روی سرور، دسترسی به مخزن بررسی می‌شود؛ اگر آدرس اشتباه باشد،
                اسکریپت با پیام واضح متوقف می‌شود، نه با ۴۰۴ خاموش.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-16">
          <SectionHeading
            id="diagnosis"
            eyebrow="ROOT CAUSE"
            title="چرا نصب نمی‌شد؟ دو دلیل که به هم زنجیر شده‌اند"
            description="مشکل از سرور یا Node نبود. آدرس مخزن در دو جا اشتباه بود: یک‌بار در دستور curl شما (و README پروژه) و یک‌بار داخل install.sh در متغیر REPO_URL. نتیجه: دانلود ۴۰۴ و در ادامه clone ناموفق."
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="panel p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-danger">آدرسی که در دستور شما بود</h3>
                <span className="mono rounded-md border border-danger/40 bg-danger/10 px-1.5 py-0.5 text-[10px] text-danger">
                  404
                </span>
              </div>
              <p className="mt-2 text-xs leading-6 text-slate-400">
                مخزن با این نام ساخته نشده است. GitHub برای مخزن و فایل raw هر دو ۴۰۴ برمی‌گرداند.
              </p>
              <div className="mt-3">
                <CodeBlock code={BROKEN_RAW} label="فایل: README.md و install.sh" tone="before" />
              </div>
            </div>

            <div className="panel p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-mint">آدرس درست مخزن</h3>
                <span className="mono rounded-md border border-mint/40 bg-mint/10 px-1.5 py-0.5 text-[10px] text-mint">
                  200
                </span>
              </div>
              <p className="mt-2 text-xs leading-6 text-slate-400">
                نام واقعی پروژه <span className="mono text-slate-200">build-multi-server-tunnel-pane</span> است؛ حرف n
                آخر کلمهٔ panel اضافه بوده. این آدرس در نسخهٔ اصلاح‌شده استفاده می‌شود.
              </p>
              <div className="mt-3">
                <CodeBlock code={REAL_RAW} label="آدرس سالم نصب‌کننده" tone="after" />
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {[
              {
                title: "curl خالی می‌ماند",
                text: "با -fsSL، هر پاسخ ۴۰۴ باعث خطای ۲۲ و فایل صفر بایتی می‌شود. با -o، فایل ساخته می‌شود حتی اگر دانلود شکست بخورد.",
                icon: "⌁",
              },
              {
                title: "bash روی فایل خالی",
                text: "sudo bash install.sh یک اسکریپت بدون دستور اجرا می‌کند: هیچ نصب، هیچ خطا، هیچ لاگ. دقیقاً همان «نصب نمی‌شود» که دیدید.",
                icon: "▢",
              },
              {
                title: "clone با آدرس غلط",
                text: "حتی اگر فایل دستی درست می‌شد، REPO_URL غلط داخل اسکریپت باعث می‌شد git clone با Repository not found بشکند.",
                icon: "⚑",
              },
            ].map((item) => (
              <div key={item.title} className="panel-soft p-4">
                <div className="grid size-8 place-items-center rounded-lg border border-sky/30 bg-sky/10 text-sky">
                  {item.icon}
                </div>
                <h4 className="mt-2 text-sm font-bold text-slate-100">{item.title}</h4>
                <p className="mt-1 text-xs leading-6 text-slate-400">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <SectionHeading
            id="checks"
            eyebrow="LIVE EVIDENCE"
            title="مدرک زنده: آدرس قبلی ۴۰۴ است، آدرس واقعی ۲۰۰"
            description="دکمهٔ زیر را بزنید تا همین پنل، همین حالا از سرور خودش هر چهار آدرس را بررسی کند. نتیجه در PostgreSQL ذخیره می‌شود و آخرین وضعیت باقی می‌ماند."
          />
          <PreflightPanel initial={clientChecks} initialDownloads={data.downloads} />
        </section>

        <section className="mt-16">
          <SectionHeading
            id="fixes"
            eyebrow="PATCH NOTES"
            title={`${faNum(data.findings.length)} اصلاح؛ از علت اصلی تا خطاهایی که بعداً سرور را زمین می‌زنند`}
            description={`${faNum(critical)} مورد بحرانی، ${faNum(high)} مورد با اهمیت بالا و بقیه بهبودهای پایداری. هر مورد را باز کنید تا کد قبل/بعد را ببینید.`}
          />
          <FindingsExplorer findings={data.findings} />
        </section>

        <section className="mt-16">
          <SectionHeading
            id="download"
            eyebrow="DOWNLOAD"
            title="دانلود فایل اصلاح‌شده و نصب روی سرور"
            description="فایل زیر همان install.sh کامل و اجرایی است (نه patch). مخزن پیش‌فرض، بررسی دسترسی، HOME درست، devDependencies، swap، healthcheck و rollback همه در آن اصلاح شده‌اند."
          />

          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid size-11 place-items-center rounded-xl border border-mint/30 bg-mint/10 text-lg">
                    📜
                  </div>
                  <div>
                    <p className="mono text-sm font-bold text-slate-100">install.sh</p>
                    <p className="text-[11px] text-slate-500">
                      نسخهٔ {data.script.version} · {faBytes(data.script.byteSize)} · {faNum(data.script.lineCount)} خط
                    </p>
                  </div>
                </div>
                <span className="chip border-mint/40 bg-mint/10 text-mint">آمادهٔ اجرا</span>
              </div>

              <div className="mt-4 space-y-2 text-xs text-slate-400">
                <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-black/30 px-3 py-2">
                  <span className="text-slate-500">sha256</span>
                  <span className="mono truncate text-[10px] text-slate-300">{data.script.sha256}</span>
                  <CopyButton value={data.script.sha256} className="shrink-0 text-[10px] text-sky hover:text-mint" />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>مخزن پیش‌فرض</span>
                  <span className="mono truncate text-[10px] text-mint">Hosein21378/build-multi-server-tunnel-pane</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>آخرین دانلود ثبت‌شده</span>
                  <span className="mono text-[10px] text-slate-300">{faNum(data.downloads)}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <a href="/api/download/install.sh" download className="btn btn-primary w-full">
                  ⬇ دانلود install.sh
                </a>
                <a href="/downloads/install.sh" download className="btn btn-ghost w-full text-xs">
                  لینک استاتیک (بدون آمار)
                </a>
                <Link href="/script" className="btn btn-ghost w-full text-xs">
                  مشاهدهٔ کد کامل با شماره خط
                </Link>
                <a href="/downloads/README-fix.md" download className="btn btn-ghost w-full text-xs">
                  راهنمای سریع نصب و پچ مخزن (Markdown)
                </a>
              </div>

              <div className="mt-4 rounded-xl border border-sky/25 bg-sky/[0.06] p-3">
                <p className="text-[11px] font-bold text-sky">تأیید سلامت فایل</p>
                <p className="mt-1 text-[11px] leading-6 text-slate-400">
                  قبل از اجرا، checksum را با نسخهٔ اعلام‌شده مقایسه کنید:
                </p>
                <div className="mt-2">
                  <CodeBlock code={verifyCommand} tone="neutral" />
                </div>
              </div>
            </div>

            <div className="panel p-5">
              <CurlCommand sha256={data.script.sha256} />
              <div className="mt-4 grid gap-2 text-[11px] text-slate-400 sm:grid-cols-2">
                <div className="rounded-lg border border-line bg-black/30 p-2.5">
                  <p className="mono text-[10px] text-mint">--dry-run</p>
                  <p className="mt-1 leading-5">اعتبارسنجی بدون تغییر سرور</p>
                </div>
                <div className="rounded-lg border border-line bg-black/30 p-2.5">
                  <p className="mono text-[10px] text-mint">--diagnose</p>
                  <p className="mt-1 leading-5">گزارش وضعیت سرویس و health</p>
                </div>
                <div className="rounded-lg border border-line bg-black/30 p-2.5">
                  <p className="mono text-[10px] text-mint">--repo URL</p>
                  <p className="mt-1 leading-5">آینه یا مخزن خصوصی با توکن</p>
                </div>
                <div className="rounded-lg border border-line bg-black/30 p-2.5">
                  <p className="mono text-[10px] text-mint">--fast</p>
                  <p className="mt-1 leading-5">به‌روزرسانی سریع با node_modules موجود</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <SectionHeading
              eyebrow="RUNBOOK"
              title="چهار قدم تا بالا آمدن پنل"
              description="دستورها را به ترتیب روی سرور (ترجیحاً Ubuntu 22.04/24.04 یا Debian 12) اجرا کنید."
            />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Step index={1} title="دانلود و بررسی خشک">
                <p>فایل را از همین پنل بگیرید و فقط بررسی کنید؛ هیچ تغییری انجام نمی‌شود.</p>
                <CodeBlock code={`curl -fsSL "${REAL_RAW}" -o install.sh\nsudo bash install.sh --dry-run`} />
              </Step>
              <Step index={2} title="نصب واقعی">
                <p>اگر dry-run سبز بود، نصب کامل را اجرا کنید. اگر نسخهٔ قبلی باشد، ابتدا staged build گرفته می‌شود.</p>
                <CodeBlock code={"sudo bash install.sh"} />
              </Step>
              <Step index={3} title="خواندن اطلاعات ورود">
                <p>یوزر و پسورد تولیدشده در فایل محافظت‌شده ذخیره می‌شود (حالت 600).</p>
                <CodeBlock code={"cat /opt/tunnelhub/credentials.txt"} />
              </Step>
              <Step index={4} title="ورود به پنل">
                <p>پورت پیش‌فرض 3000 است. اگر فایروال فعال است، همان پورت را باز کنید.</p>
                <CodeBlock code={"http://SERVER_IP:3000\nufw allow 3000/tcp   # اگر ufw فعال است"} />
              </Step>
            </div>
          </div>
        </section>

        <section className="mt-16">
          <SectionHeading
            eyebrow="REPOSITORY PATCH"
            title="پچ مخزن خودتان را هم به‌روز کنید"
            description="اگر می‌خواهید نصب مستقیم از GitHub هم کار کند، این دو خط در مخزن باید اصلاح شوند. فایل دانلودی این صفحه مستقل کار می‌کند، حتی بدون تغییر مخزن."
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="panel p-5">
              <h3 className="text-sm font-bold text-slate-100">اصلاح README و REPO_URL</h3>
              <p className="mt-1 text-xs leading-6 text-slate-400">
                مخزن واقعی: <span className="mono text-mint">{REAL_REPO}</span>
              </p>
              <div className="mt-3">
                <CodeBlock code={readmePatch} label="two-line patch" tone="after" />
              </div>
            </div>
            <div className="panel p-5">
              <h3 className="text-sm font-bold text-slate-100">پچ سریع با sed</h3>
              <p className="mt-1 text-xs leading-6 text-slate-400">
                در ریشهٔ مخزن اجرا کنید؛ هر رخداد <span className="mono">-panel</span> به <span className="mono">-pane</span>{" "}
                تبدیل می‌شود.
              </p>
              <div className="mt-3">
                <CodeBlock code={quickPatch} label="run inside the repo" tone="neutral" />
              </div>
              <p className="mt-3 text-[11px] leading-6 text-flare">
                توجه: دستور بالا فقط در مخزن خودتان است؛ روی سرورِ نصب، همان install.sh دانلودی این صفحه را اجرا کنید.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-16">
          <SectionHeading eyebrow="FAQ" title="سؤال‌های باقی‌مانده" />
          <div className="grid gap-3 lg:grid-cols-2">
            {[
              {
                q: "آیا نصب نسخهٔ اصلاح‌شده داده‌های پنل قبلی را پاک می‌کند؟",
                a: "نه. اسکریپت ابتدا در یک پوشهٔ staging کامل build می‌گیرد، بعد پوشهٔ قبلی را با نام پشتیبان کنار می‌گذارد. اگر سرویس یا healthcheck بالا نیاید، نسخهٔ قبلی برمی‌گردد؛ در نصب اول هم unit خراب disable و حذف می‌شود.",
              },
              {
                q: "اگر GitHub روی سرور در دسترس نباشد چه؟",
                a: "می‌توانید از آینه یا توکن استفاده کنید: --repo https://<token>@github.com/owner/repo.git یا متغیر TUNNELHUB_REPO. اگر سورس را کنار اسکریپت گذاشته‌اید، --local هم موجود است. بررسی preflight قبل از هر تغییری انجام می‌شود.",
              },
              {
                q: "چرا قبل از نصب devDependencies هم نصب می‌شوند؟",
                a: "چون build و drizzle-kit و tailwind در devDependencies هستند. اسکریپت قبلی اگر NODE_ENV=production دیده می‌شد آن‌ها را رد می‌کرد و مرحلهٔ schema شکست می‌خورد. نسخهٔ جدید با --include=dev نصب می‌کند.",
              },
              {
                q: "روی VPS ۵۱۲ مگابایتی نصب می‌شود؟",
                a: "بله، ولی تنگ است. اسکریپت اصلاح‌شده در صورت کمبود RAM یک swap موقت ۲ گیگی می‌سازد، build را با NODE_OPTIONS اجرا می‌کند و بعد swap را برمی‌دارد. توصیه: ۱ گیگ RAM یا بالاتر.",
              },
              {
                q: "پسورد یا پورت دلخواه چطور تنظیم کنم؟",
                a: "با --admin-password و --port و --dir. مجموعهٔ کاراکترهای مجاز پسورد در نسخهٔ اصلاح‌شده بزرگ‌تر شده، اما فاصله، کوتیشن، بک‌اسلش، $ و # همچنان ممنوع است چون فایل .env و systemd را خراب می‌کنند.",
              },
              {
                q: "این صفحه به سرور من دسترسی دارد؟",
                a: "نه. فقط همین پنل میزبان است که آدرس‌های عمومی GitHub را بررسی می‌کند و آمار دانلودها را در دیتابیس خودش نگه می‌دارد. هیچ اطلاعات یا اعتبارنامه‌ای از سرور شما اینجا فرستاده نمی‌شود.",
              },
            ].map((item) => (
              <details key={item.q} className="panel-soft faq-item p-4">
                <summary className="flex items-center justify-between gap-3 text-sm font-bold text-slate-100">
                  {item.q}
                  <span className="faq-chevron shrink-0 text-slate-500 transition" aria-hidden="true">
                    ▾
                  </span>
                </summary>
                <p className="mt-2 text-xs leading-7 text-slate-400">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="panel mt-14 overflow-hidden">
          <div className="grid gap-4 p-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <h2 className="text-lg font-extrabold text-slate-100">فایل آماده است — همین حالا دانلود کنید</h2>
              <p className="mt-1 text-xs leading-6 text-slate-400">
                sha256: <span className="mono text-[10px] text-slate-300">{shortSha(data.script.sha256, 32)}</span>
                {" · "}
                آخرین بررسی: {data.checks[0] ? faDate(data.checks[0].checkedAt) : "—"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href="/api/download/install.sh" download className="btn btn-primary">
                ⬇ دانلود install.sh
              </a>
              <Link href="/script" className="btn btn-ghost">
                مرور کد
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line/70 bg-black/30">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            Install Doctor · بستهٔ تعمیر نصب TunnelHub · نسخهٔ {FIXED_VERSION} · مستقل از مخزن اصلی
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a href={REAL_REPO} target="_blank" rel="noreferrer" className="mono hover:text-sky">
              github.com/Hosein21378/build-multi-server-tunnel-pane
            </a>
            <span className="mono">sha256:{shortSha(data.script.sha256, 10)}</span>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-6 text-[10px] leading-5 text-slate-600 sm:px-6">
          هشدار: اسکریپت را فقط از همین صفحه یا مخزن خودتان بگیرید و قبل از اجرا checksum را بررسی کنید. نصب نیاز به
          دسترسی root دارد و سرویس systemd با محدودیت‌های امنیتی اجرا می‌شود.
        </div>
      </footer>
    </div>
  );
}
