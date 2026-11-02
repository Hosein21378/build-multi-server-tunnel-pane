import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { preflightChecks } from "@/db/schema";
import { getLatestChecks } from "@/lib/data";
import { FIXED_INSTALL_SCRIPT } from "@/lib/generated-bridge";
import { BROKEN_RAW, BROKEN_REPO_API, REAL_RAW, REAL_REPO_API } from "@/lib/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Probe = {
  slug: string;
  label: string;
  url: string;
  expectOk: boolean;
};

type ProbeResult = Probe & {
  ok: boolean;
  statusCode: number | null;
  latencyMs: number;
  message: string;
};

async function probe(target: Probe): Promise<ProbeResult> {
  const started = Date.now();
  try {
    const response = await fetch(target.url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      headers: {
        "user-agent": "tunnelhub-install-doctor/1.1 (+preflight)",
        accept: "*/*",
      },
      signal: AbortSignal.timeout(9000),
    });
    const latencyMs = Date.now() - started;
    await response.body?.cancel();

    const ok = response.ok;
    let message: string;
    if (target.expectOk && ok) {
      message = `HTTP ${response.status} — در دسترس و سالم.`;
    } else if (!target.expectOk && response.status === 404) {
      message = "HTTP 404 — همان خطای واقعی: این آدرس وجود ندارد.";
    } else if (target.expectOk && !ok) {
      message = `HTTP ${response.status} — آدرس در دسترس نیست؛ شبکه یا مخزن را بررسی کنید.`;
    } else if (!target.expectOk && ok) {
      message = `HTTP ${response.status} — آدرس قبلی حالا پاسخ می‌دهد (شاید مخزن بازسازی شده باشد).`;
    } else {
      message = `HTTP ${response.status} — پاسخ غیرمنتظره.`;
    }

    return { ...target, ok, statusCode: response.status, latencyMs, message };
  } catch (error) {
    const latencyMs = Date.now() - started;
    const reason = error instanceof Error ? error.message : "unknown network error";
    return {
      ...target,
      ok: false,
      statusCode: null,
      latencyMs,
      message: `بدون پاسخ — ${reason}`,
    };
  }
}

async function probeArtifact(): Promise<ProbeResult> {
  const started = Date.now();
  const target: Probe = {
    slug: "self-delivery",
    label: "فایل اصلاح‌شده روی همین پنل",
    url: "/downloads/install.sh",
    expectOk: true,
  };
  try {
    const file = await readFile(path.join(process.cwd(), "public", "downloads", "install.sh"), "utf8");
    const latencyMs = Date.now() - started;
    const sha = createHash("sha256").update(file).digest("hex").slice(0, 12);
    if (file === FIXED_INSTALL_SCRIPT) {
      return {
        ...target,
        ok: true,
        statusCode: 200,
        latencyMs,
        message: `فایل روی دیسک با نسخهٔ ثبت‌شده یکسان است (sha256: ${sha}…) و آمادهٔ دانلود است.`,
      };
    }
    return {
      ...target,
      ok: false,
      statusCode: 409,
      latencyMs,
      message: "فایل روی دیسک با نسخهٔ ثبت‌شده یکسان نیست؛ بسته را دوباره publish کنید.",
    };
  } catch (error) {
    return {
      ...target,
      ok: false,
      statusCode: null,
      latencyMs: Date.now() - started,
      message: `فایل بسته در دسترس نیست — ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}

export async function GET() {
  try {
    const checks = await getLatestChecks();
    return Response.json({ ok: true, checks });
  } catch (error) {
    console.error("preflight GET failed", error);
    return Response.json({ ok: false, checks: [] }, { status: 503 });
  }
}

export async function POST() {
  const targets: Probe[] = [
    { slug: "broken-raw", label: "دانلود نصب‌کننده (آدرس قبلی)", url: BROKEN_RAW, expectOk: false },
    { slug: "broken-repo", label: "مخزن گیت (آدرس قبلی)", url: BROKEN_REPO_API, expectOk: false },
    { slug: "real-raw", label: "دانلود از مخزن واقعی (‎-pane‎)", url: REAL_RAW, expectOk: true },
    { slug: "real-repo", label: "مخزن گیت واقعی (‎-pane‎)", url: REAL_REPO_API, expectOk: true },
  ];

  const results = await Promise.all([...targets.map(probe), probeArtifact()]);

  try {
    await db.delete(preflightChecks).where(eq(preflightChecks.source, "live"));
    await db.insert(preflightChecks).values(
      results.map((result) => ({
        slug: result.slug,
        label: result.label,
        url: result.url,
        expectOk: result.expectOk,
        ok: result.ok,
        statusCode: result.statusCode,
        latencyMs: result.latencyMs,
        message: result.message,
        source: "live",
      })),
    );
  } catch (error) {
    console.error("preflight: could not persist results", error);
  }

  return Response.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    checks: results.map((result) => ({
      slug: result.slug,
      label: result.label,
      url: result.url,
      expectOk: result.expectOk,
      ok: result.ok,
      statusCode: result.statusCode,
      latencyMs: result.latencyMs,
      message: result.message,
      source: "live",
      checkedAt: new Date().toISOString(),
    })),
  });
}
