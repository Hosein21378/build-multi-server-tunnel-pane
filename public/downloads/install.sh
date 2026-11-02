#!/usr/bin/env bash
# ============================================================================
# TunnelHub installer / updater  —  patched build 1.1.0
#
# Changes vs. the upstream build (see README of this fix bundle):
#   1. REPO_URL now points at the real repository (...-pane, not ...-panel).
#   2. Repository reachability is verified BEFORE anything is changed.
#   3. Build steps run with a correct HOME/cache for the service user.
#   4. Dependencies are installed WITH devDependencies (drizzle-kit is needed).
#   5. Low-RAM servers get a temporary swap file + NODE_OPTIONS during build.
#   6. A failing systemctl restart no longer skips the healthcheck/diagnostics.
#   7. A failed first install is fully rolled back (unit is disabled/removed).
#   8. Wider (still safe) admin password charset.
#   9. apt lock/DNS retries, Node/npm path refresh, postgres unit check,
#      server-IP fallback and a brand new --dry-run mode.
#
# Usage: curl -fsSL <installer-url> -o install.sh && sudo bash install.sh
# ============================================================================
set -Eeuo pipefail
umask 077
ORIGINAL_ARGS=("$@")

APP_NAME="tunnelhub"
APP_DIR="/opt/tunnelhub"
APP_PORT="3000"
ADMIN_USER="admin"
ADMIN_PASSWORD=""
DB_URL=""
# FIX 1: the old value ended in "tunnel-panel", a repository that does not exist
# (raw.githubusercontent.com returns HTTP 404). The real slug is "tunnel-pane".
REPO_URL="${TUNNELHUB_REPO:-https://github.com/Hosein21378/build-multi-server-tunnel-pane.git}"
BRANCH="main"
LOCAL_MODE=0
FAST=0
DIAGNOSE=0
DRY_RUN=0
PORT_EXPLICIT=0
REPO_EXPLICIT=0
STAGE_ROOT=""
STAGE_DIR=""
BACKUP_DIR=""
SWAPPED=0
LOCAL_DATABASE=0
BUILD_SWAP_FILE=""
APT_OPTS=(-o DPkg::Lock::Timeout=120 -o Acquire::Retries=3)
NODE_MEMORY_MB="${TUNNELHUB_BUILD_MEMORY_MB:-1536}"

log() { printf '\033[1;32m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*" >&2; }
fail() { printf '\033[1;31m[ERROR]\033[0m %s\n' "$*" >&2; exit 1; }

release_build_swap() {
  if [[ -n "$BUILD_SWAP_FILE" && -f "$BUILD_SWAP_FILE" ]]; then
    swapoff "$BUILD_SWAP_FILE" >/dev/null 2>&1 || true
    rm -f "$BUILD_SWAP_FILE" >/dev/null 2>&1 || true
    BUILD_SWAP_FILE=""
  fi
}

cleanup() {
  local exit_code=$?
  trap - EXIT
  release_build_swap || true
  if [[ "$exit_code" -ne 0 && "$SWAPPED" -eq 1 ]]; then
    warn "Deployment failed after switching directories; restoring the previous installation when available."
    systemctl stop "$APP_NAME" >/dev/null 2>&1 || true
    rm -rf "$APP_DIR"
    if [[ -n "$BACKUP_DIR" && -d "$BACKUP_DIR" ]]; then
      mv "$BACKUP_DIR" "$APP_DIR"
      systemctl daemon-reload >/dev/null 2>&1 || true
      systemctl restart "$APP_NAME" >/dev/null 2>&1 || true
    else
      # FIX 7: a failed first install must not leave an enabled unit behind.
      systemctl disable "$APP_NAME" >/dev/null 2>&1 || true
      rm -f "/etc/systemd/system/${APP_NAME}.service"
      systemctl daemon-reload >/dev/null 2>&1 || true
    fi
  fi
  if [[ -n "$STAGE_ROOT" && -d "$STAGE_ROOT" ]]; then rm -rf "$STAGE_ROOT"; fi
  exit "$exit_code"
}
trap cleanup EXIT

usage() {
  cat <<'HELP'
TunnelHub installer / updater (patched build 1.1.0)

Usage:
  sudo bash install.sh [options]

Options:
  --dir PATH             installation directory (default: /opt/tunnelhub)
  --port PORT            public panel port (default: 3000)
  --admin-user NAME      initial administrator (default: admin)
  --admin-password PASS  initial password (generated if omitted)
  --db-url URL           PostgreSQL URL (local PostgreSQL is installed otherwise)
  --repo URL             HTTPS Git repository to install
  --branch NAME          Git branch (default: main)
  --local                install files next to this script instead of cloning
  --fast                 reuse matching node_modules and skip apt update when possible
  --diagnose             read-only service and health report; no root required
  --dry-run              validate options and repository access, change nothing
  --help                 show this help

The installer stages a complete build before switching the systemd service.
If startup or the healthcheck fails, the previous installation is restored.
HELP
}

need_value() {
  [[ $# -ge 2 && -n "$2" ]] || fail "Option $1 requires a value (use --help)."
}
while (($#)); do
  case "$1" in
    --dir) need_value "$@"; APP_DIR="$2"; shift 2 ;;
    --port) need_value "$@"; APP_PORT="$2"; PORT_EXPLICIT=1; shift 2 ;;
    --admin-user) need_value "$@"; ADMIN_USER="$2"; shift 2 ;;
    --admin-password) need_value "$@"; ADMIN_PASSWORD="$2"; shift 2 ;;
    --db-url) need_value "$@"; DB_URL="$2"; shift 2 ;;
    --repo) need_value "$@"; REPO_URL="$2"; REPO_EXPLICIT=1; shift 2 ;;
    --branch) need_value "$@"; BRANCH="$2"; shift 2 ;;
    --local) LOCAL_MODE=1; shift ;;
    --fast) FAST=1; shift ;;
    --diagnose) DIAGNOSE=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --help|-h) usage; exit 0 ;;
    *) fail "Unknown option: $1 (use --help)." ;;
  esac
done

read_env_value() {
  local key="$1" file="$2" line value
  [[ -f "$file" ]] || return 0
  line="$(grep -m1 "^${key}=" "$file" 2>/dev/null || true)"
  [[ -n "$line" ]] || return 0
  value="${line#*=}"
  value="${value%$'\r'}"
  if [[ "$value" == \"*\" ]]; then value="${value#\"}"; value="${value%\"}"; fi
  if [[ "$value" == \'*\' ]]; then value="${value#\'}"; value="${value%\'}"; fi
  printf '%s' "$value"
}

server_ip() {
  local ip=""
  if command -v hostname >/dev/null 2>&1; then
    ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi
  if [[ -z "$ip" ]] && command -v ip >/dev/null 2>&1; then
    ip="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1); exit}}')"
  fi
  printf '%s' "${ip:-127.0.0.1}"
}

# FIX 2: verify the repository (and branch) before touching the server.
repo_reachable() {
  local url="$1"
  git ls-remote --heads --exit-code "$url" "$BRANCH" >/dev/null 2>&1
}

preflight_repo() {
  if [[ "$LOCAL_MODE" -eq 1 ]]; then
    log "Local mode: skipping repository preflight."
    return 0
  fi
  command -v git >/dev/null 2>&1 || { warn "git is not installed yet; skipping repository preflight."; return 0; }
  log "Checking repository access: ${REPO_URL} (branch: ${BRANCH})"
  repo_reachable "$REPO_URL" && return 0

  if [[ "$REPO_EXPLICIT" -eq 0 ]]; then
    local candidate
  for candidate in \
      "https://github.com/Hosein21378/build-multi-server-tunnel-pane.git" \
      "https://github.com/Hosein21378/build-multi-server-tunnel-pane"; do
      [[ "$candidate" == "$REPO_URL" ]] && continue
      if repo_reachable "$candidate"; then
        warn "Configured repository is unreachable; falling back to: $candidate"
        REPO_URL="$candidate"
        return 0
      fi
    done
  fi

  fail "Repository is not reachable: ${REPO_URL} (branch: ${BRANCH}).
  * A 404 usually means the repository name or owner is misspelled.
  * The project lives at https://github.com/Hosein21378/build-multi-server-tunnel-pane (note: -pane).
  * Private repository? Use a token URL: --repo https://<token>@github.com/owner/repo.git
  * No internet / blocked GitHub? Retry with a mirror: --repo https://your-mirror/repo.git
  Nothing on this server has been changed."
}

if [[ "$DIAGNOSE" -eq 1 ]]; then
  echo "== TunnelHub diagnostics =="
  echo "install dir : $APP_DIR $([[ -d "$APP_DIR" ]] && echo '(exists)' || echo '(missing)')"
  echo "repo        : $REPO_URL (branch: $BRANCH)"
  echo "node        : $(command -v node || echo 'not found') $(node -v 2>/dev/null || true)"
  echo "npm         : $(command -v npm || echo 'not found') $(npm -v 2>/dev/null || true)"
  if command -v systemctl >/dev/null 2>&1; then
    echo "service     : $(systemctl is-active "$APP_NAME" 2>/dev/null || echo unknown) / $(systemctl is-enabled "$APP_NAME" 2>/dev/null || echo unknown)"
  else
    echo "service     : systemctl not available"
  fi
  if command -v curl >/dev/null 2>&1; then
    echo -n "health      : "
    curl -fsS --max-time 5 "http://127.0.0.1:${APP_PORT}/api/health" 2>/dev/null || echo "NO RESPONSE on port ${APP_PORT}"
  fi
  echo
  echo "Logs        : journalctl -u ${APP_NAME} -n 100 --no-pager"
  echo "Repair      : sudo bash install.sh --fast"
  exit 0
fi

# Do not let bash consume the remaining script through a pipe; use a real file.
if [[ ! -f "${BASH_SOURCE[0]:-}" ]]; then
  fail "Run the installer from a file: curl -fsSL <url> -o install.sh && test -s install.sh && sudo bash install.sh"
fi

[[ "$APP_DIR" == /* && "$APP_DIR" != "/" && "$APP_DIR" != *$'\n'* && "$APP_DIR" != *[[:space:]]* ]] || fail "--dir must be an absolute path without whitespace."
[[ "$APP_PORT" =~ ^[0-9]{1,5}$ ]] && ((APP_PORT >= 1 && APP_PORT <= 65535)) || fail "--port must be between 1 and 65535."
[[ "$ADMIN_USER" =~ ^[A-Za-z0-9_.-]{3,32}$ ]] || fail "--admin-user must be 3-32 safe ASCII characters."
[[ "$BRANCH" =~ ^[A-Za-z0-9._/-]{1,80}$ && "$BRANCH" != *..* ]] || fail "Invalid branch name."
if [[ "$LOCAL_MODE" -eq 0 ]]; then
  [[ "$REPO_URL" =~ ^https://[A-Za-z0-9.-]+/[A-Za-z0-9._/@:-]+(\.git)?$ ]] || fail "Only a valid HTTPS repository URL is accepted (a token URL is allowed)."
fi
if [[ -n "$DB_URL" ]]; then
  [[ "$DB_URL" == postgresql://* || "$DB_URL" == postgres://* ]] || fail "--db-url must be a PostgreSQL connection URL."
  [[ "$DB_URL" != *$'\n'* && "$DB_URL" != *[[:space:]]* && "$DB_URL" != *\"* && "$DB_URL" != *\'* && "$DB_URL" != *'#'* && "$DB_URL" != *'$'* && "$DB_URL" != *'`'* ]] || fail "URL contains characters unsafe for an environment file; percent-encode reserved credentials."
fi

if [[ -f "$APP_DIR/.env" ]]; then
  [[ -n "$DB_URL" ]] || DB_URL="$(read_env_value DATABASE_URL "$APP_DIR/.env")"
  [[ -n "$ADMIN_PASSWORD" ]] || ADMIN_PASSWORD="$(read_env_value ADMIN_PASSWORD "$APP_DIR/.env")"
  [[ "$ADMIN_USER" != "admin" ]] || ADMIN_USER="$(read_env_value ADMIN_USERNAME "$APP_DIR/.env")"
  [[ -n "$ADMIN_USER" ]] || ADMIN_USER="admin"
  [[ "$PORT_EXPLICIT" -eq 1 ]] || APP_PORT="$(read_env_value PORT "$APP_DIR/.env")"
  [[ -n "$APP_PORT" ]] || APP_PORT="3000"
fi
[[ "$APP_PORT" =~ ^[0-9]{1,5}$ ]] && ((APP_PORT >= 1 && APP_PORT <= 65535)) || fail "Configured PORT must be between 1 and 65535."
[[ "$ADMIN_USER" =~ ^[A-Za-z0-9_.-]{3,32}$ ]] || fail "Configured ADMIN_USERNAME must be 3-32 safe ASCII characters."
if [[ -n "$DB_URL" ]]; then
  [[ "$DB_URL" == postgresql://* || "$DB_URL" == postgres://* ]] || fail "Existing DATABASE_URL is not a PostgreSQL URL."
  [[ "$DB_URL" != *$'\n'* && "$DB_URL" != *[[:space:]]* && "$DB_URL" != *\"* && "$DB_URL" != *\'* && "$DB_URL" != *'#'* && "$DB_URL" != *'$'* && "$DB_URL" != *'`'* ]] || fail "DATABASE_URL contains characters unsafe for an environment file; percent-encode reserved credentials."
fi
[[ -n "$ADMIN_PASSWORD" ]] || ADMIN_PASSWORD="$(openssl rand -hex 18 2>/dev/null || true)"
# openssl may not be installed yet. Generate a temporary password with bash/urandom if needed.
if [[ -z "$ADMIN_PASSWORD" ]]; then ADMIN_PASSWORD="$(od -An -N18 -tx1 /dev/urandom | tr -d ' \n')"; fi
# FIX 8: keep the password shell/env-file safe but stop rejecting normal punctuation.
PASSWORD_RE='^[A-Za-z0-9._~@%+=:,!?*()<>|/;^&-]{8,128}$'
[[ "$ADMIN_PASSWORD" =~ $PASSWORD_RE ]] \
  || fail "--admin-password must be 8-128 characters; avoid spaces, quotes, backslash, dollar, backtick and # (they break .env/systemd)."
SESSION_SECRET="$(read_env_value SESSION_SECRET "$APP_DIR/.env")"
[[ "$SESSION_SECRET" =~ ^[A-Za-z0-9_-]{32,128}$ ]] || SESSION_SECRET="$(od -An -N48 -tx1 /dev/urandom | tr -d ' \n')"

if [[ "$DRY_RUN" -eq 1 ]]; then
  log "Dry run: validating configuration only (no changes will be made)."
  preflight_repo
  echo
  echo "== Plan =="
  echo "install dir : $APP_DIR"
  echo "panel port  : $APP_PORT"
  echo "admin user  : $ADMIN_USER"
  echo "repository  : $([[ "$LOCAL_MODE" -eq 1 ]] && echo '(local directory)' || echo "$REPO_URL")"
  echo "branch      : $BRANCH"
  echo "database    : $([[ -n "$DB_URL" ]] && echo 'external PostgreSQL URL' || echo 'local PostgreSQL (installed automatically)')"
  echo "mode        : $([[ "$FAST" -eq 1 ]] && echo 'fast' || echo 'full')"
  echo
  log "Dry run finished successfully; the server was not modified."
  exit 0
fi

if [[ "$(id -u)" -ne 0 ]]; then
  command -v sudo >/dev/null 2>&1 || fail "Root privileges are required; install sudo or run as root."
  exec sudo -E bash "${BASH_SOURCE[0]}" "${ORIGINAL_ARGS[@]}"
fi

command -v apt-get >/dev/null 2>&1 || fail "This installer supports Debian/Ubuntu (apt-get) only."
command -v systemctl >/dev/null 2>&1 || fail "systemd is required to manage the TunnelHub service."
command -v runuser >/dev/null 2>&1 || fail "runuser is required; install util-linux and retry."
export DEBIAN_FRONTEND=noninteractive

# FIX 10: transient apt lock/DNS problems should not kill the install.
apt_retry() {
  local attempt
  for attempt in 1 2 3; do
    if apt-get "${APT_OPTS[@]}" "$@"; then return 0; fi
    warn "apt-get $* failed (attempt ${attempt}/3); retrying in $((attempt * 5))s"
    sleep $((attempt * 5))
  done
  fail "apt-get $* failed after 3 attempts. Check DNS/reachability of the Debian mirrors, then retry."
}

if [[ "$FAST" -eq 0 ]]; then
  log "Installing system prerequisites"
  apt_retry update -qq
  apt_retry install -y -qq ca-certificates curl git openssl gpg util-linux >/dev/null
else
  for tool in curl git gpg curl; do command -v "$tool" >/dev/null 2>&1 || fail "--fast requires $tool to be installed."; done
fi

preflight_repo

NODE_MAJOR=0
NODE_MINOR=0
if command -v node >/dev/null 2>&1; then
  IFS=. read -r NODE_MAJOR NODE_MINOR _NODE_PATCH <<<"$(node -p 'process.versions.node' 2>/dev/null || echo 0.0.0)"
fi
if (( NODE_MAJOR < 20 || (NODE_MAJOR == 20 && NODE_MINOR < 9) )); then
  log "Installing Node.js 22 from the signed NodeSource repository"
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --batch --yes -o /etc/apt/keyrings/nodesource.gpg
  chmod 0644 /etc/apt/keyrings/nodesource.gpg
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main\n' "$(dpkg --print-architecture)" >/etc/apt/sources.list.d/nodesource.list
  apt_retry update -qq
  apt_retry install -y -qq nodejs >/dev/null
fi
# FIX 10: refresh bash's command cache and make sure npm really exists now.
hash -r
NODE_BIN="$(command -v node || true)"
NPM_BIN="$(command -v npm || true)"
[[ -n "$NODE_BIN" ]] || fail "Node.js is still not on PATH after installation."
[[ -n "$NPM_BIN" ]] || fail "npm is missing (the nodejs package installs npm). Reinstall nodejs: apt-get install -y nodejs"
log "Using Node.js $("$NODE_BIN" -v 2>/dev/null || echo '?') and npm $("$NPM_BIN" -v 2>/dev/null || echo '?')"

if [[ -z "$DB_URL" ]]; then
  LOCAL_DATABASE=1
  if [[ "$FAST" -eq 0 ]]; then
    apt_retry install -y -qq postgresql postgresql-contrib >/dev/null
  elif ! command -v psql >/dev/null 2>&1 || ! systemctl list-unit-files postgresql.service >/dev/null 2>&1; then
    apt_retry install -y -qq postgresql postgresql-contrib >/dev/null
  fi
  systemctl enable --now postgresql >/dev/null
  DB_PASS="$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')"
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 -tAc "SELECT 1 FROM pg_roles WHERE rolname='${APP_NAME}'" | grep -qx 1 \
    || runuser -u postgres -- psql -v ON_ERROR_STOP=1 -v dbpass="$DB_PASS" -c "CREATE ROLE ${APP_NAME} LOGIN PASSWORD :'dbpass';" >/dev/null
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 -v dbpass="$DB_PASS" -c "ALTER ROLE ${APP_NAME} WITH PASSWORD :'dbpass';" >/dev/null
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 -tAc "SELECT 1 FROM pg_database WHERE datname='${APP_NAME}'" | grep -qx 1 \
    || runuser -u postgres -- createdb -O "$APP_NAME" "$APP_NAME"
  DB_URL="postgresql://${APP_NAME}:${DB_PASS}@127.0.0.1:5432/${APP_NAME}"
fi

if ! id -u "$APP_NAME" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "/var/lib/${APP_NAME}" --shell /usr/sbin/nologin "$APP_NAME"
fi
APP_HOME="/var/lib/${APP_NAME}"
mkdir -p "$APP_HOME"
chown "$APP_NAME:$APP_NAME" "$APP_HOME"

APP_PARENT="$(dirname "$APP_DIR")"
mkdir -p "$APP_PARENT"
STAGE_ROOT="$(mktemp -d "${APP_PARENT}/.tunnelhub-stage.XXXXXX")"
STAGE_DIR="${STAGE_ROOT}/app"
mkdir -p "$STAGE_DIR"
if [[ "$LOCAL_MODE" -eq 1 ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  [[ -f "$SCRIPT_DIR/package.json" ]] || fail "--local must be run next to a project package.json."
  tar --exclude=node_modules --exclude=.next --exclude=.git --exclude=.env --exclude=credentials.txt -C "$SCRIPT_DIR" -cf - . | tar -C "$STAGE_DIR" -xf -
else
  log "Cloning ${REPO_URL} (${BRANCH}) into a temporary staging directory"
  if ! git clone --depth=1 --branch "$BRANCH" "$REPO_URL" "$STAGE_DIR" 2>/tmp/tunnelhub-clone.log; then
    sed -n '1,12p' /tmp/tunnelhub-clone.log >&2 || true
    fail "git clone failed. The repository URL, branch or network access is wrong; the previous installation was not touched."
  fi
fi

for required in package.json src/app/page.tsx src/db/schema.ts src/db/index.ts src/app/api/health/route.ts; do
  [[ -f "$STAGE_DIR/$required" ]] || fail "Incomplete source tree: missing $required. Existing installation has not been changed."
done
if [[ ! -f "$STAGE_DIR/drizzle.config.ts" && ! -f "$STAGE_DIR/drizzle.config.json" && ! -f "$STAGE_DIR/drizzle.config.js" ]]; then
  fail "Incomplete source tree: drizzle.config.* is missing, so the database schema cannot be applied."
fi
for legacy in "$STAGE_DIR/src/app/(panel)" "$STAGE_DIR/src/app/(dashboard)"; do
  if [[ -d "$legacy" ]]; then
    rm -rf "$legacy"
    warn "Removed duplicate legacy route folder: ${legacy#"$STAGE_DIR"/}"
  fi
done

if [[ -f "$APP_DIR/.env" ]]; then cp "$APP_DIR/.env" "$STAGE_DIR/.env"; fi
cat >"$STAGE_DIR/.env" <<EOF
DATABASE_URL=${DB_URL}
SESSION_SECRET=${SESSION_SECRET}
ADMIN_USERNAME=${ADMIN_USER}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
PORT=${APP_PORT}
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
EOF
chmod 600 "$STAGE_DIR/.env"
chown -R "$APP_NAME:$APP_NAME" "$STAGE_DIR"

DEPS_HASH="$( { sha256sum "$STAGE_DIR/package.json"; [[ -f "$STAGE_DIR/package-lock.json" ]] && sha256sum "$STAGE_DIR/package-lock.json" || true; } | awk '{print $1}' | paste -sd- - )"
SKIP_NPM=0
if [[ "$FAST" -eq 1 && -x "$APP_DIR/node_modules/.bin/next" && -f "$APP_DIR/node_modules/.tunnelhub-hash" && "$(cat "$APP_DIR/node_modules/.tunnelhub-hash")" == "$DEPS_HASH" ]]; then
  log "Matching dependencies found; reusing node_modules"
  cp -a "$APP_DIR/node_modules" "$STAGE_DIR/node_modules"
  chown -R "$APP_NAME:$APP_NAME" "$STAGE_DIR/node_modules"
  SKIP_NPM=1
fi

# FIX 3: give the service user a real HOME and npm cache (root's HOME caused EACCES).
run_as_app() {
  runuser -u "$APP_NAME" -- env HOME="$APP_HOME" NPM_CONFIG_CACHE="${APP_HOME}/.npm" \
    bash -c 'cd "$1"; shift; exec "$@"' _ "$STAGE_DIR" "$@"
}
export NEXT_TELEMETRY_DISABLED=1
if [[ "$SKIP_NPM" -eq 0 ]]; then
  # FIX 4: devDependencies are required (drizzle-kit, typescript, tailwind).
  if [[ -f "$STAGE_DIR/package-lock.json" ]]; then
    log "Installing locked Node.js dependencies (including devDependencies)"
    run_as_app env NODE_ENV=development "$NPM_BIN" ci --include=dev --no-audit --no-fund --prefer-offline
  else
    warn "No package-lock.json found; using npm install for this release."
    run_as_app env NODE_ENV=development "$NPM_BIN" install --include=dev --no-audit --no-fund --prefer-offline
  fi
fi
printf '%s' "$DEPS_HASH" >"$STAGE_DIR/node_modules/.tunnelhub-hash"
chown "$APP_NAME:$APP_NAME" "$STAGE_DIR/node_modules/.tunnelhub-hash"

log "Applying the Drizzle database schema"
[[ -x "$STAGE_DIR/node_modules/.bin/drizzle-kit" ]] || fail "drizzle-kit is missing after dependency installation; cannot apply the database schema."
run_as_app env DATABASE_URL="$DB_URL" NODE_ENV=production "$STAGE_DIR/node_modules/.bin/drizzle-kit" push --force

# FIX 5: many small VPS hosts get OOM-killed during next build.
ensure_build_memory() {
  local mem_mb swap_kb
  mem_mb="$(awk '/MemTotal/ {printf "%d", $2/1024}' /proc/meminfo 2>/dev/null || echo 2048)"
  if (( mem_mb >= 1800 )); then return 0; fi
  if swapon --show 2>/dev/null | grep -q .; then
    log "Low memory (${mem_mb} MB) but swap is already active; continuing."
    return 0
  fi
  log "Low memory detected (${mem_mb} MB); creating a temporary 2 GB build swap file"
  BUILD_SWAP_FILE="/swapfile.tunnelhub"
  if { fallocate -l 2G "$BUILD_SWAP_FILE" 2>/dev/null || dd if=/dev/zero of="$BUILD_SWAP_FILE" bs=1M count=2048 status=none; } \
    && chmod 600 "$BUILD_SWAP_FILE" \
    && mkswap "$BUILD_SWAP_FILE" >/dev/null 2>&1 \
    && swapon "$BUILD_SWAP_FILE" >/dev/null 2>&1; then
    log "Temporary swap enabled for the build (removed afterwards)."
  else
    warn "Could not enable temporary swap; the build may fail on this host."
    rm -f "$BUILD_SWAP_FILE" 2>/dev/null || true
    BUILD_SWAP_FILE=""
  fi
}
ensure_build_memory

log "Building the production application"
run_as_app env DATABASE_URL="$DB_URL" SESSION_SECRET="$SESSION_SECRET" NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS="--max-old-space-size=${NODE_MEMORY_MB}" "$NPM_BIN" run build
release_build_swap

DB_AFTER=""
if [[ "$LOCAL_DATABASE" -eq 1 ]]; then DB_AFTER=" postgresql.service"; fi
cat >/etc/systemd/system/${APP_NAME}.service <<EOF
[Unit]
Description=TunnelHub network management panel
After=network-online.target${DB_AFTER}
Wants=network-online.target

[Service]
Type=simple
User=${APP_NAME}
Group=${APP_NAME}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env
Environment=NODE_ENV=production
Environment=NEXT_TELEMETRY_DISABLED=1
Environment=HOME=${APP_HOME}
ExecStart=${NODE_BIN} ${APP_DIR}/node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port ${APP_PORT}
Restart=on-failure
RestartSec=4
TimeoutStartSec=120
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
UMask=0077

[Install]
WantedBy=multi-user.target
EOF

if [[ -d "$APP_DIR" ]]; then
  BACKUP_DIR="${APP_DIR}.previous.$(date +%s)"
  systemctl stop "$APP_NAME" >/dev/null 2>&1 || true
  mv "$APP_DIR" "$BACKUP_DIR"
  SWAPPED=1
fi
mv "$STAGE_DIR" "$APP_DIR"
SWAPPED=1
chown -R "$APP_NAME:$APP_NAME" "$APP_DIR"
systemctl daemon-reload
systemctl enable "$APP_NAME" >/dev/null 2>&1 || warn "Could not enable ${APP_NAME} at boot; check 'systemctl is-enabled ${APP_NAME}'."
# FIX 6: never let a non-zero restart abort before the healthcheck and logs.
if ! systemctl restart "$APP_NAME"; then
  warn "systemctl restart ${APP_NAME} reported an error; collecting diagnostics."
  systemctl status "$APP_NAME" --no-pager -l >&2 || true
  journalctl -u "$APP_NAME" -n 40 --no-pager >&2 || true
fi

log "Waiting for the healthcheck"
HEALTH=0
for _ in $(seq 1 45); do
  if curl -fsS --max-time 3 "http://127.0.0.1:${APP_PORT}/api/health" >/dev/null 2>&1; then HEALTH=1; break; fi
  sleep 2
done
if [[ "$HEALTH" -ne 1 ]]; then
  journalctl -u "$APP_NAME" -n 60 --no-pager >&2 || true
  fail "Healthcheck failed; the previous installation will be restored when available."
fi

SWAPPED=0
if [[ -n "$BACKUP_DIR" && -d "$BACKUP_DIR" ]]; then rm -rf "$BACKUP_DIR"; fi
STAGE_ROOT=""
SERVER_IP="$(server_ip)"
{
  echo "TunnelHub credentials — store this file securely"
  echo "URL: http://${SERVER_IP}:${APP_PORT}"
  echo "Username: ${ADMIN_USER}"
  echo "Password: ${ADMIN_PASSWORD}"
  echo "Service: systemctl status ${APP_NAME}"
  echo "Logs: journalctl -u ${APP_NAME} -f"
} >"$APP_DIR/credentials.txt"
chown "$APP_NAME:$APP_NAME" "$APP_DIR/credentials.txt"
chmod 600 "$APP_DIR/credentials.txt"

printf '\n\033[1;32m======================================================\033[0m\n'
printf '\033[1;32m  TUNNELHUB INSTALLED SUCCESSFULLY\033[0m\n'
printf '\033[1;32m======================================================\033[0m\n'
printf '  URL      : http://%s:%s\n' "$SERVER_IP" "$APP_PORT"
printf '  Username : %s\n' "$ADMIN_USER"
printf '  Password : %s\n' "$ADMIN_PASSWORD"
printf '  Saved to : %s/credentials.txt (mode 600)\n' "$APP_DIR"
printf '  Logs     : journalctl -u %s -f\n\n' "$APP_NAME"
