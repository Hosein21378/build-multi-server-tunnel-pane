import type { Severity } from "@/lib/site";

export type Finding = {
  slug: string;
  severity: Severity;
  category: string;
  title: string;
  target: string;
  line: number | null;
  impact: string;
  detail: string;
  fix: string;
  beforeCode: string | null;
  afterCode: string | null;
  sortOrder: number;
};

export const FINDINGS: Finding[] = [
  {
    slug: "repo-slug-typo",
    severity: "critical",
    category: "آدرس مخزن",
    title: "نام مخزن اشتباه است: ‎-panel‎ وجود ندارد، مخزن واقعی ‎-pane‎ است",
    target: "install.sh",
    line: 14,
    impact: "نصبکننده در همان مرحله clone متوقف میشود و هیچ پنلی بالا نمیآید.",
    detail:
      "متغیر REPO_URL روی آدرسی hardcode شده بود که در GitHub وجود ندارد. درخواست مستقیم به آن آدرس پاسخ HTTP 404 و Git پیام «repository not found» میدهد. نام درست مخزن « build-multi-server-tunnel-pane » است؛ حرف n در انتهای panel اضافه است.",
    fix:
      "نسخه اصلاحشده REPO_URL را روی مخزن واقعی تنظیم میکند، و امکان override با TUNNELHUB_REPO یا سوییچ --repo هم حفظ شده است.",
    beforeCode: 'REPO_URL="${TUNNELHUB_REPO:-https://github.com/Hosein21378/build-multi-server-tunnel-panel.git}"',
    afterCode: 'REPO_URL="${TUNNELHUB_REPO:-https://github.com/Hosein21378/build-multi-server-tunnel-pane.git}"',
    sortOrder: 1,
  },
  {
    slug: "raw-download-404",
    severity: "critical",
    category: "دستور نصب",
    title: "curl با ‎-f‎ روی ۴۰۴ خروجی خالی میسازد؛ نصب بیصدا شکست میخورد",
    target: "README.md",
    line: 38,
    impact: "فایل install.sh با حجم صفر ساخته میشود، sudo bash آن را اجرا میکند و هیچ اتفاقی نمیافتد.",
    detail:
      "در README هم همان آدرس غلط قرار داشت. چون ‎curl -fsSL‎ با کد ۲۲ خارج میشود، فایل خالی باقی میماند. اسکریپت خالی هیچ است و کاربر فقط «نصب نشد» میبیند. جالب است بدانید خود اسکریپت یک گارد ضد «اجرای فایل خالی/pipe» دارد، اما چون فایل وجود دارد گارد فعال نمیشود.",
    fix:
      "دستور نصب اصلاحشده از مخزن درست دانلود میکند و با ‎test -s install.sh‎ و بررسی sha256 قبل از اجرا مطمئن میشود فایل کامل و سالم است.",
    beforeCode:
      "curl -fsSL https://raw.githubusercontent.com/Hosein21378/build-multi-server-tunnel-panel/main/install.sh -o install.sh\nsudo bash install.sh",
    afterCode:
      'curl -fsSL "<installer-url>" -o install.sh \\\n  && test -s install.sh \\\n  && sudo bash install.sh --dry-run \\\n  && sudo bash install.sh',
    sortOrder: 2,
  },
  {
    slug: "clone-no-preflight",
    severity: "high",
    category: "پایداری",
    title: "دسترسی به مخزن قبل از شروع کار بررسی نمیشود",
    target: "install.sh",
    line: 222,
    impact: "وقتی GitHub در دسترس نیست (فیلترینگ/DNS)، خطا دیر و مبهم اتفاق میافتد.",
    detail:
      "اسکریپت مستقیم clone میکرد و خروجی خام git را به کاربر نشان میداد؛ معلوم نمیشد مشکل نام مخزن است یا شبکه یا برنچ. حالا یک preflight قبل از هر تغییری انجام میشود و در صورت نیاز به مخزن جایگزین، با هشدار واضح سوییچ میکند.",
    fix:
      "تابع repo_reachable با git ls-remote برنچ را بررسی میکند، پیش از هر اقدامی؛ در صورت شکست، پیام چهارخطی با راهکار (نام درست، توکن برای مخزن خصوصی، آینه) نمایش داده میشود.",
    beforeCode: 'git clone --depth=1 --branch "$BRANCH" "$REPO_URL" "$STAGE_DIR"',
    afterCode:
      'preflight_repo\n...\nif ! git clone --depth=1 --branch "$BRANCH" "$REPO_URL" "$STAGE_DIR" 2>/tmp/tunnelhub-clone.log; then\n  sed -n \'1,12p\' /tmp/tunnelhub-clone.log >&2\n  fail "git clone failed ... previous installation was not touched."\nfi',
    sortOrder: 3,
  },
  {
    slug: "runuser-home-eacces",
    severity: "high",
    category: "نصب پکیجها",
    title: "‎HOME‎ کاربر سرویس روی ‎/root‎ میماند و ‎npm‎ خطای دسترسی میدهد",
    target: "install.sh",
    line: 257,
    impact: "npm install / next build با EACCES روی /root/.npm میشکند، در حالی که log واضحی چاپ نمیشود.",
    detail:
      "نصب بهعنوان کاربر tunnelhub با runuser انجام میشد، اما runuser محیط را از root به ارث میدهد؛ پس HOME=/root باقی میماند و npm کش خود را در پوشه روت میسازد. این خطا روی سرورهای تازه و sudo -E بسیار شایع است.",
    fix:
      "نسخه اصلاحشده HOME و NPM_CONFIG_CACHE را صریح به /var/lib/tunnelhub تنظیم میکند و پوشه را قبل از build به مالکیت کاربر سرویس درمیآورد.",
    beforeCode: "run_as_app() { runuser -u \"$APP_NAME\" -- bash -c 'cd \"$1\"; shift; exec \"$@\"' _ \"$STAGE_DIR\" \"$@\"; }",
    afterCode:
      'run_as_app() {\n  runuser -u "$APP_NAME" -- env HOME="$APP_HOME" NPM_CONFIG_CACHE="${APP_HOME}/.npm" \\\n    bash -c \'cd "$1"; shift; exec "$@"\' _ "$STAGE_DIR" "$@"\n}',
    sortOrder: 4,
  },
  {
    slug: "missing-dev-dependencies",
    severity: "high",
    category: "نصب پکیجها",
    title: "وابستگیهای dev نصب نمیشوند؛ ‎drizzle-kit‎ غایب میماند",
    target: "install.sh",
    line: 262,
    impact: "در محیطی که NODE_ENV=production تنظیم شده، مرحله ساخت دیتابیس شکست میخورد.",
    detail:
      "npm install/ci بدون ‎--include=dev‎ وقتی NODE_ENV=production باشد (مثلاً روی پنلهای مدیریت سرور یا با sudo -E) devDependencies را رد میکند. اما drizzle-kit و typescript و tailwind در devDependencies هستند و build به آنها نیاز دارد.",
    fix:
      "نصب با NODE_ENV=development و --include=dev انجام میشود، و وجود node_modules/.bin/drizzle-kit قبل از اجرا بررسی میشود.",
    beforeCode: 'run_as_app "$NPM_BIN" ci --no-audit --no-fund --prefer-offline',
    afterCode:
      'run_as_app env NODE_ENV=development "$NPM_BIN" ci --include=dev --no-audit --no-fund --prefer-offline',
    sortOrder: 5,
  },
  {
    slug: "build-out-of-memory",
    severity: "high",
    category: "Build",
    title: "build روی VPS کمحافظه با OOM کشته میشود",
    target: "install.sh",
    line: 274,
    impact: "فرآیند Killed میشود، rollback انجام میشود و هر بار نصب از صفر شکست میخورد.",
    detail:
      "next build معمولاً بیش از ۱ گیگابایت حافظه میخواهد. روی سرورهای ۵۱۲ مگابایت تا ۱ گیگابایت (بسیار رایج) کرنل فرآیند را میکشد و تنها چیزی که میبینید Killed است.",
    fix:
      "اگر RAM کمتر از ۱.۸ گیگ باشد و swap فعال نباشد، یک فایل swap دو گیگی موقت ساخته و بعد از build حذف میشود؛ build هم با NODE_OPTIONS=--max-old-space-size اجرا میشود.",
    beforeCode: 'run_as_app env ... "$NPM_BIN" run build',
    afterCode:
      'ensure_build_memory\nrun_as_app env ... NODE_OPTIONS="--max-old-space-size=${NODE_MEMORY_MB}" "$NPM_BIN" run build\nrelease_build_swap',
    sortOrder: 6,
  },
  {
    slug: "systemctl-restart-abort",
    severity: "high",
    category: "سرویس",
    title: "‎set -e‎ باعث میشود خطای restart از healthcheck و لاگها بپرد",
    target: "install.sh",
    line: 317,
    impact: "کاربر فقط پیام «Healthcheck failed» میبیند بدون اینکه دلیل واقعی بالا نیامدن سرویس را ببیند.",
    detail:
      "systemctl restart زیر set -Eeuo pipefail اجرا میشد؛ اگر شکست میخورد، اسکریپت قبل از journalctl و حلقه سلامت خارج میشد. عیبیابی عملاً غیرممکن میشد.",
    fix: "restart داخل بلوک if قرار گرفت؛ در صورت خطا، status و ۴۰ خط آخر ژورنال چاپ میشود و بعد healthcheck کامل اجرا میشود.",
    beforeCode: 'systemctl restart "$APP_NAME"',
    afterCode:
      'if ! systemctl restart "$APP_NAME"; then\n  systemctl status "$APP_NAME" --no-pager -l >&2 || true\n  journalctl -u "$APP_NAME" -n 40 --no-pager >&2 || true\nfi',
    sortOrder: 7,
  },
  {
    slug: "first-install-rollback",
    severity: "medium",
    category: "Rollback",
    title: "در نصب اول، rollback سرویس را enabled و خراب رها میکند",
    target: "install.sh",
    line: 34,
    impact: "بعد از شکست، systemd هر چند ثانیه سرویسی را restart میکند که پوشهاش پاک شده است.",
    detail:
      "تابع cleanup فقط وقتی نسخه قبلی وجود داشت آن را برمیگرداند؛ در نصب اول unit فعال باقی میماند و چون APP_DIR حذف شده، سرویس در حلقه خطا گیر میکند.",
    fix: "نسخه اصلاحشده در نصب اول unit را disable و فایل آن را حذف و daemon-reload میکند.",
    beforeCode: "mv \"$BACKUP_DIR\" \"$APP_DIR\"  # only when a backup exists",
    afterCode:
      'else\n  systemctl disable "$APP_NAME" >/dev/null 2>&1 || true\n  rm -f "/etc/systemd/system/${APP_NAME}.service"\n  systemctl daemon-reload >/dev/null 2>&1 || true\nfi',
    sortOrder: 8,
  },
  {
    slug: "password-charset",
    severity: "medium",
    category: "ورودیها",
    title: "پسورد دلخواه با علائم رایج رد میشد",
    target: "install.sh",
    line: 153,
    impact: "دستور نصب با ‎--admin-password MyStr0ng!Pass‎ بدون دلیل متوقف میشد.",
    detail:
      "regex قبلی فقط ‎A-Za-z0-9._~@%+=-‎ را قبول میکرد؛ کاراکترهایی مثل ! ? : , ( ) در پسورد خطا میدادند و پیام هم گویا نبود.",
    fix:
      "مجموعه کاراکترها گسترش یافت (بدون فاصله، کوتیشن، بکاسلش، $، backtick و # که برای .env/systemd خطرناکاند) و حداقل طول به ۸ رسید.",
    beforeCode: "[[ \"$ADMIN_PASSWORD\" =~ ^[A-Za-z0-9._~@%+=-]{12,128}$ ]]",
    afterCode: "PASSWORD_RE='^[A-Za-z0-9._~@%+=:,!?*()<>|/;^&-]{8,128}$'\n[[ \"$ADMIN_PASSWORD\" =~ $PASSWORD_RE ]]",
    sortOrder: 9,
  },
  {
    slug: "apt-lock-retry",
    severity: "medium",
    category: "پیشنیازها",
    title: "قفل apt یا DNS لحظهای، کل نصب را میکشت",
    target: "install.sh",
    line: 169,
    impact: "خطای گذرای «Could not get lock /var/lib/dpkg/lock» نصب را بدون تلاش دوباره متوقف میکرد.",
    detail:
      "خروجی apt در /dev/null بود و هیچ retryای وجود نداشت؛ روی سرورهایی که unattended-upgrades فعال است این خطا بسیار شایع است.",
    fix:
      "تابع apt_retry با DPkg::Lock::Timeout=120 و Acquire::Retries=3 و سه تلاش پشتسرهم اضافه شد و پیام خطای فارسی/گویا برای آینههای دبیان میدهد.",
    beforeCode: "apt-get update -qq\napt-get install -y -qq ca-certificates curl git openssl gpg util-linux >/dev/null",
    afterCode:
      'APT_OPTS=(-o DPkg::Lock::Timeout=120 -o Acquire::Retries=3)\napt_retry update -qq\napt_retry install -y -qq ca-certificates curl git openssl gpg util-linux >/dev/null',
    sortOrder: 10,
  },
  {
    slug: "node-path-refresh",
    severity: "medium",
    category: "Node.js",
    title: "پس از نصب Node، مسیرها refresh و npm بررسی نمیشود",
    target: "install.sh",
    line: 189,
    impact: "اگر نسخه قدیمی Node قبلاً وجود داشت، مسیر cache شده bash میتوانست استفاده شود؛ نبود npm هم پیام واضحی نداشت.",
    detail:
      "اسکریپت NODE_BIN و NPM_BIN را با command -v میگرفت ولی hash -r نمیزد و وجود npm را هم چک نمیکرد.",
    fix: "بعد از نصب، hash -r انجام میشود، نسخه Node و npm لاگ میشود و نبود npm با راهنمای نصب گزارش میشود.",
    beforeCode: 'NODE_BIN="$(command -v node)"\nNPM_BIN="$(command -v npm)"',
    afterCode:
      'hash -r\nNODE_BIN="$(command -v node || true)"\nNPM_BIN="$(command -v npm || true)"\n[[ -n "$NPM_BIN" ]] || fail "npm is missing ..."',
    sortOrder: 11,
  },
  {
    slug: "postgres-service-check",
    severity: "medium",
    category: "دیتابیس",
    title: "در حالت ‎--fast‎ فقط وجود ‎psql‎ کافی تلقی میشد",
    target: "install.sh",
    line: 195,
    impact: "روی سروری که فقط postgresql-client دارد، ‎systemctl enable --now postgresql‎ شکست میخورد.",
    detail:
      "بررسی --fast فقط command -v psql را چک میکرد؛ ممکن بود باینری کلاینت نصب باشد ولی سرویس دیتابیس نباشد.",
    fix: "نسخه اصلاحشده وجود unit سیستم systemd به نام postgresql.service را هم بررسی میکند و در صورت نبود، سرور دیتابیس را نصب میکند.",
    beforeCode: 'elif ! command -v psql >/dev/null 2>&1; then apt-get install -y -qq postgresql postgresql-contrib',
    afterCode:
      'elif ! command -v psql >/dev/null 2>&1 || ! systemctl list-unit-files postgresql.service >/dev/null 2>&1; then\n  apt_retry install -y -qq postgresql postgresql-contrib',
    sortOrder: 12,
  },
  {
    slug: "empty-server-ip",
    severity: "low",
    category: "خروجی",
    title: "‎hostname -I‎ خالی، آدرس نهایی را ناقص چاپ میکند",
    target: "install.sh",
    line: 348,
    impact: "خروجی ‎http://:3000‎ و credentials.txt بیفایده میشد.",
    detail: "روی سرورهای بدون IPv4 یا با network namespace خاص، hostname -I میتواند خالی باشد.",
    fix: "تابع server_ip اضافه شد: اول hostname -I، بعد ip route get، در نهایت 127.0.0.1.",
    beforeCode: 'printf \'  URL      : http://%s:%s\\n\' "$(hostname -I 2>/dev/null | awk \'{print $1}\')" "$APP_PORT"',
    afterCode: 'SERVER_IP="$(server_ip)"\nprintf \'  URL      : http://%s:%s\\n\' "$SERVER_IP" "$APP_PORT"',
    sortOrder: 13,
  },
  {
    slug: "dry-run-mode",
    severity: "low",
    category: "قابلیت جدید",
    title: "حالت ‎--dry-run‎ برای تست قبل از دستزدن به سرور",
    target: "install.sh",
    line: null,
    impact: "قبلاً برای فهمیدن اینکه نصب کار میکند یا نه، باید کل فرآیند اجرا میشد.",
    detail:
      "حالا میتوانید اسکریپت را کاملاً بیخطر اجرا کنید: گزینهها و دسترسی به مخزن بررسی میشود و برنامه نصب چاپ میشود، بدون اینکه فایلی تغییر کند.",
    fix: "سوییچ --dry-run به usage و به جریان اعتبارسنجی اضافه شد و در --diagnose هم آدرس مخزن نمایش داده میشود.",
    beforeCode: "sudo bash install.sh   # changes the server immediately",
    afterCode: "sudo bash install.sh --dry-run   # validate only, change nothing",
    sortOrder: 14,
  },
];
