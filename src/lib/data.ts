import { createHash } from "node:crypto";
import { count, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { downloadEvents, findings as findingsTable, fixedScripts, preflightChecks } from "@/db/schema";
import { FINDINGS, type Finding } from "@/lib/findings";
import {
  BROKEN_RAW,
  BROKEN_REPO_API,
  FIXED_FILE_NAME,
  FIXED_INSTALL_BYTES,
  FIXED_INSTALL_LINES,
  FIXED_INSTALL_SCRIPT,
  FIXED_INSTALL_SHA256,
  FIXED_VERSION,
  REAL_RAW,
  REAL_REPO_API,
  SCRIPT_SLUG,
} from "@/lib/generated-bridge";
import type { Severity } from "@/lib/site";

export type ScriptRecord = {
  slug: string;
  title: string;
  fileName: string;
  version: string;
  sha256: string;
  byteSize: number;
  lineCount: number;
  content: string;
};

export type CheckRecord = {
  slug: string;
  label: string;
  url: string;
  expectOk: boolean;
  ok: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  message: string;
  source: string;
  checkedAt: Date;
};

export type DashboardData = {
  script: ScriptRecord;
  findings: Finding[];
  checks: CheckRecord[];
  downloads: number;
  degraded: boolean;
};

export const BASELINE_CHECKS: CheckRecord[] = [
  {
    slug: "broken-raw",
    label: "دانلود نصب‌کننده (آدرس قبلی)",
    url: BROKEN_RAW,
    expectOk: false,
    ok: false,
    statusCode: 404,
    latencyMs: null,
    message: "HTTP 404 — فایل وجود ندارد؛ curl با کد ۲۲ خارج و install.sh خالی می‌شود.",
    source: "baseline",
    checkedAt: new Date("2026-02-18T09:12:00Z"),
  },
  {
    slug: "broken-repo",
    label: "مخزن گیت (آدرس قبلی)",
    url: BROKEN_REPO_API,
    expectOk: false,
    ok: false,
    statusCode: 404,
    latencyMs: null,
    message: "HTTP 404 — «Repository not found»؛ git clone داخل اسکریپت هم همین‌جا می‌شکست.",
    source: "baseline",
    checkedAt: new Date("2026-02-18T09:12:00Z"),
  },
  {
    slug: "real-raw",
    label: "دانلود از مخزن واقعی (‎-pane‎)",
    url: REAL_RAW,
    expectOk: true,
    ok: true,
    statusCode: 200,
    latencyMs: null,
    message: "HTTP 200 — نصب‌کننده اصلی در مخزن واقعی موجود است.",
    source: "baseline",
    checkedAt: new Date("2026-02-18T09:12:00Z"),
  },
  {
    slug: "real-repo",
    label: "مخزن گیت واقعی (‎-pane‎)",
    url: REAL_REPO_API,
    expectOk: true,
    ok: true,
    statusCode: 200,
    latencyMs: null,
    message: "HTTP 200 — مخزن در دسترس است و git clone کار می‌کند.",
    source: "baseline",
    checkedAt: new Date("2026-02-18T09:12:00Z"),
  },
];

const fallbackScript: ScriptRecord = {
  slug: SCRIPT_SLUG,
  title: "TunnelHub installer (patched)",
  fileName: FIXED_FILE_NAME,
  version: FIXED_VERSION,
  sha256: FIXED_INSTALL_SHA256,
  byteSize: FIXED_INSTALL_BYTES,
  lineCount: FIXED_INSTALL_LINES,
  content: FIXED_INSTALL_SCRIPT,
};

export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const salt = process.env.DOWNLOAD_HASH_SALT ?? "tunnelhub-install-doctor";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

let seeded = false;

export async function ensureSeed(): Promise<void> {
  if (seeded) return;

  await db
    .insert(fixedScripts)
    .values({
      slug: SCRIPT_SLUG,
      title: "TunnelHub installer (patched build)",
      fileName: FIXED_FILE_NAME,
      version: FIXED_VERSION,
      upstreamUrl: REAL_RAW,
      brokenUrl: BROKEN_RAW,
      repoUrl: REAL_REPO_API,
      sha256: FIXED_INSTALL_SHA256,
      byteSize: FIXED_INSTALL_BYTES,
      lineCount: FIXED_INSTALL_LINES,
      content: FIXED_INSTALL_SCRIPT,
    })
    .onConflictDoUpdate({
      target: fixedScripts.slug,
      set: {
        sha256: FIXED_INSTALL_SHA256,
        byteSize: FIXED_INSTALL_BYTES,
        lineCount: FIXED_INSTALL_LINES,
        content: FIXED_INSTALL_SCRIPT,
        version: FIXED_VERSION,
      },
    });

  for (const finding of FINDINGS) {
    await db
      .insert(findingsTable)
      .values({
        slug: finding.slug,
        severity: finding.severity,
        category: finding.category,
        title: finding.title,
        target: finding.target,
        line: finding.line,
        impact: finding.impact,
        detail: finding.detail,
        fix: finding.fix,
        beforeCode: finding.beforeCode,
        afterCode: finding.afterCode,
        sortOrder: finding.sortOrder,
      })
      .onConflictDoUpdate({
        target: findingsTable.slug,
        set: {
          severity: finding.severity,
          category: finding.category,
          title: finding.title,
          target: finding.target,
          line: finding.line,
          impact: finding.impact,
          detail: finding.detail,
          fix: finding.fix,
          beforeCode: finding.beforeCode,
          afterCode: finding.afterCode,
          sortOrder: finding.sortOrder,
        },
      });
  }

  const [{ value: checkCount }] = await db.select({ value: count() }).from(preflightChecks);
  if (Number(checkCount) === 0) {
    await db.insert(preflightChecks).values(
      BASELINE_CHECKS.map((check) => ({
        slug: check.slug,
        label: check.label,
        url: check.url,
        expectOk: check.expectOk,
        ok: check.ok,
        statusCode: check.statusCode,
        latencyMs: check.latencyMs,
        message: check.message,
        source: check.source,
      })),
    );
  }

  seeded = true;
}

export async function getScript(): Promise<ScriptRecord> {
  await ensureSeed();
  const [row] = await db.select().from(fixedScripts).where(eq(fixedScripts.slug, SCRIPT_SLUG)).limit(1);
  if (!row) return fallbackScript;
  return {
    slug: row.slug,
    title: row.title,
    fileName: row.fileName,
    version: row.version,
    sha256: row.sha256,
    byteSize: row.byteSize,
    lineCount: row.lineCount,
    content: row.content,
  };
}

export async function getLatestChecks(limit = 6): Promise<CheckRecord[]> {
  const rows = await db.select().from(preflightChecks).orderBy(desc(preflightChecks.checkedAt)).limit(60);
  const seen = new Set<string>();
  const latest: CheckRecord[] = [];
  for (const row of rows) {
    if (seen.has(row.slug)) continue;
    seen.add(row.slug);
    latest.push({
      slug: row.slug,
      label: row.label,
      url: row.url,
      expectOk: row.expectOk,
      ok: row.ok,
      statusCode: row.statusCode,
      latencyMs: row.latencyMs,
      message: row.message,
      source: row.source,
      checkedAt: row.checkedAt,
    });
    if (latest.length >= limit) break;
  }
  return latest;
}

export async function getDashboardData(): Promise<DashboardData> {
  try {
    await ensureSeed();
    const [script, dbFindings, checks, [{ value: downloadCount }]] = await Promise.all([
      getScript(),
      db.select().from(findingsTable).orderBy(findingsTable.sortOrder),
      getLatestChecks(),
      db.select({ value: count() }).from(downloadEvents),
    ]);

    const parsedFindings: Finding[] = dbFindings.map((row) => ({
      slug: row.slug,
      severity: row.severity as Severity,
      category: row.category,
      title: row.title,
      target: row.target,
      line: row.line,
      impact: row.impact,
      detail: row.detail,
      fix: row.fix,
      beforeCode: row.beforeCode,
      afterCode: row.afterCode,
      sortOrder: row.sortOrder,
    }));

    return {
      script,
      findings: parsedFindings.length > 0 ? parsedFindings : FINDINGS,
      checks: checks.length > 0 ? checks : BASELINE_CHECKS,
      downloads: Number(downloadCount),
      degraded: false,
    };
  } catch (error) {
    console.error("dashboard data unavailable, using bundled fallback", error);
    return {
      script: fallbackScript,
      findings: FINDINGS,
      checks: BASELINE_CHECKS,
      downloads: 0,
      degraded: true,
    };
  }
}

export async function recordDownload(input: {
  scriptSlug: string;
  fileName: string;
  ip: string | null;
  userAgent: string | null;
}): Promise<number> {
  await db.insert(downloadEvents).values({
    scriptSlug: input.scriptSlug,
    fileName: input.fileName,
    ipHash: hashIp(input.ip),
    userAgent: input.userAgent?.slice(0, 300) ?? null,
  });
  const [{ value }] = await db.select({ value: count() }).from(downloadEvents);
  return Number(value);
}

export async function getDownloadCount(): Promise<number> {
  const [{ value }] = await db.select({ value: count() }).from(downloadEvents);
  return Number(value);
}
