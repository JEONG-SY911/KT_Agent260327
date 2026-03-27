import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Market Intelligence Agent",
  description:
    "Autonomous market research and competitor analysis powered by LangGraph multi-agent AI.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-slate-50 antialiased">{children}</body>
    </html>
  );
}
