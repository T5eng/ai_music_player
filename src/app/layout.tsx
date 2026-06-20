import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Music Player",
  description: "AI 驱动的个性化音乐电台",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-surface text-white antialiased">{children}</body>
    </html>
  );
}
