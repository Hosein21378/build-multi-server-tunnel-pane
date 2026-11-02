export const BROKEN_REPO = "https://github.com/Hosein21378/build-multi-server-tunnel-panel.git";
export const BROKEN_RAW =
  "https://raw.githubusercontent.com/Hosein21378/build-multi-server-tunnel-panel/main/install.sh";
export const BROKEN_REPO_API = "https://api.github.com/repos/Hosein21378/build-multi-server-tunnel-panel";
export const REAL_REPO = "https://github.com/Hosein21378/build-multi-server-tunnel-pane.git";
export const REAL_RAW =
  "https://raw.githubusercontent.com/Hosein21378/build-multi-server-tunnel-pane/main/install.sh";
export const REAL_REPO_API = "https://api.github.com/repos/Hosein21378/build-multi-server-tunnel-pane";

export const FIXED_FILE_NAME = "install.sh";
export const FIXED_VERSION = "1.1.0";
export const SCRIPT_SLUG = "tunnelhub-install-fixed";
export const PATCHED_FIX_COUNT = 14;

export const severityMeta = {
  critical: { fa: "بحرانی", order: 0 },
  high: { fa: "بالا", order: 1 },
  medium: { fa: "متوسط", order: 2 },
  low: { fa: "پایین", order: 3 },
} as const;

export type Severity = keyof typeof severityMeta;
