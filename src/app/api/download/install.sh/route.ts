import { getScript, recordDownload } from "@/lib/data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return request.headers.get("x-real-ip");
}

export async function GET(request: Request) {
  let script = null;
  try {
    script = await getScript();
  } catch (error) {
    console.error("download: database unavailable, using bundled script", error);
  }

  const content = script?.content;
  if (!content) {
    return new Response("Installer bundle is unavailable.", { status: 503 });
  }

  const fileName = "install.sh";
  const sha = script?.sha256 ?? "";

  try {
    await recordDownload({
      scriptSlug: script?.slug ?? "tunnelhub-install-fixed",
      fileName,
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent"),
    });
  } catch (error) {
    console.error("download: could not record analytics", error);
  }

  return new Response(content, {
    status: 200,
    headers: {
      "content-type": "text/x-shellscript; charset=utf-8",
      "content-disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${fileName}`,
      "content-length": String(new TextEncoder().encode(content).length),
      "cache-control": "no-store, max-age=0",
      "x-script-sha256": sha,
      "x-script-version": script?.version ?? "1.1.0",
    },
  });
}
