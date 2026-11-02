export function faNum(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(value);
}

export function faBytes(bytes: number): string {
  if (bytes < 1024) return `${faNum(bytes)} بایت`;
  const kb = bytes / 1024;
  return `${new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(kb)} کیلوبایت`;
}

export function faDate(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tehran",
  }).format(date);
}

export function shortSha(sha: string, size = 16): string {
  return sha.length > size ? `${sha.slice(0, size)}…` : sha;
}
