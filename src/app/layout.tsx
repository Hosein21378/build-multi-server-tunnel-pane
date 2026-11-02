import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Install Doctor — نصب‌کنندهٔ TunnelHub، تعمیر شد",
  description:
    "تشخیص علت شکست نصب TunnelHub روی سرور (آدرس مخزن ۴۰۴) و دانلود نسخه اصلاح‌شدهٔ install.sh با ۱۴ اصلاح.",
  applicationName: "TunnelHub Install Doctor",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
