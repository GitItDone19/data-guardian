import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DataGuardian — Autonomous Agentic DataOps Platform",
  description:
    "Real-time pipeline monitoring, autonomous incident triage, empirical root cause analysis, and human-approved remediation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-[#090d16] text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
