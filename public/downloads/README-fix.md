# رفع مشکل نصب TunnelHub — راهنمای سریع

## علت اصلی
دستور نصب و متغیر `REPO_URL` داخل `install.sh` به مخزنی اشاره می‌کردند که وجود ندارد:

```
https://github.com/Hosein21378/build-multi-server-tunnel-panel   ← 404
https://github.com/Hosein21378/build-multi-server-tunnel-pane    ← 200 (درست)
```

پس `curl -fsSL ... -o install.sh` با کد ۲۲ خارج می‌شود و یک فایل صفر بایتی می‌ماند؛ اجرای آن هم هیچ کاری نمی‌کند.

## نصب با فایل اصلاح‌شده

```bash
# فایل install.sh را از پنل (یا آدرس دلخواه) دانلود کنید، سپس:
echo "<sha256 اعلام‌شده>  install.sh" | sha256sum -c -
sudo bash install.sh --dry-run      # فقط بررسی؛ هیچ تغییری نمی‌دهد
sudo bash install.sh                # نصب واقعی
cat /opt/tunnelhub/credentials.txt  # یوزر/پسورد پنل
```

## گزینه‌ها

| گزینه | کاربرد |
| --- | --- |
| `--port 8080` | تغییر پورت پنل |
| `--dir /opt/panel` | تغییر مسیر نصب |
| `--admin-user`, `--admin-password` | تعیین ورود اولیه |
| `--db-url postgresql://...` | استفاده از PostgreSQL بیرونی |
| `--repo <url>` | آینه/مخزن خصوصی (با توکن) |
| `--fast` | به‌روزرسانی سریع |
| `--diagnose` | گزارش وضعیت سرویس و health |
| `--dry-run` | اعتبارسنجی بدون تغییر سرور |

## پچ مخزن خودتان

```bash
sed -i 's/build-multi-server-tunnel-panel/build-multi-server-tunnel-pane/g' README.md install.sh
```

## ۱۴ اصلاح اعمال‌شده در install.sh

1. آدرس مخزن درست شد (`-pane`).
2. بررسی دسترسی به مخزن قبل از شروع (preflight + fallback).
3. `HOME` و کش npm کاربر سرویس اصلاح شد (رفع EACCES روی `/root/.npm`).
4. نصب وابستگی‌ها با `--include=dev` (نیاز به drizzle-kit و tailwind).
5. swap موقت + `NODE_OPTIONS` برای سرورهای کم‌حافظه.
6. خطای `systemctl restart` دیگر از healthcheck و لاگ‌ها رد نمی‌شود.
7. rollback کامل در نصب اول (disable و حذف unit).
8. مجموعهٔ کاراکترهای مجاز پسورد بزرگ‌تر شد.
9. retry برای قفل apt و خطاهای موقت شبکه.
10. `hash -r` و بررسی وجود npm بعد از نصب Node.
11. بررسی نصب سرور PostgreSQL در حالت `--fast`.
12. fallback برای آدرس IP سرور.
13. پیام خطای گویا برای clone و فایل‌های ناقص.
14. حالت جدید `--dry-run`.

## نکته‌ها
- اسکریپت را فقط از منبع مطمئن بگیرید و checksum را بررسی کنید.
- روی Ubuntu 22.04/24.04 و Debian 12 تست‌پذیر است و به systemd و apt نیاز دارد.
- نصب به‌صورت staged انجام می‌شود و در صورت شکست healthcheck، نسخهٔ قبلی برمی‌گردد.
