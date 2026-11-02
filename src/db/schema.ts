import { integer, pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const fixedScripts = pgTable("fixed_scripts", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  fileName: text("file_name").notNull(),
  version: text("version").notNull(),
  upstreamUrl: text("upstream_url").notNull(),
  brokenUrl: text("broken_url").notNull(),
  repoUrl: text("repo_url").notNull(),
  sha256: text("sha256").notNull(),
  byteSize: integer("byte_size").notNull(),
  lineCount: integer("line_count").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const findings = pgTable("findings", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  severity: text("severity").notNull(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  target: text("target").notNull(),
  line: integer("line"),
  impact: text("impact").notNull(),
  detail: text("detail").notNull(),
  fix: text("fix").notNull(),
  beforeCode: text("before_code"),
  afterCode: text("after_code"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const preflightChecks = pgTable("preflight_checks", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull(),
  label: text("label").notNull(),
  url: text("url").notNull(),
  expectOk: boolean("expect_ok").notNull(),
  ok: boolean("ok").notNull(),
  statusCode: integer("status_code"),
  latencyMs: integer("latency_ms"),
  message: text("message").notNull(),
  source: text("source").notNull().default("live"),
  checkedAt: timestamp("checked_at", { withTimezone: true }).defaultNow().notNull(),
});

export const downloadEvents = pgTable("download_events", {
  id: serial("id").primaryKey(),
  scriptSlug: text("script_slug").notNull(),
  fileName: text("file_name").notNull(),
  ipHash: text("ip_hash"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
