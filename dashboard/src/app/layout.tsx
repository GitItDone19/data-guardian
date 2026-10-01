import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

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
    <html
      lang="en"
      className={cn(
        "dark",
        inter.variable,
        jetbrainsMono.variable
      )}
    >
      <body className="antialiased min-h-screen font-sans bg-[#171717] text-[#ededed] selection:bg-[#3ecf8e]/20 selection:text-[#3ecf8e]">
        <TooltipProvider delay={150}>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              className: "text-xs border border-[#2e2e2e] bg-[#1c1c1c] text-[#ededed]",
            }}
          />
        </TooltipProvider>
      </body>
    </html>
  );
}
