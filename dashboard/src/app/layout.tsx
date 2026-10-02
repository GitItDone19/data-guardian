import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/ThemeProvider";
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
      suppressHydrationWarning
      className={cn(
        inter.variable,
        jetbrainsMono.variable
      )}
    >
      <body suppressHydrationWarning className="antialiased min-h-screen font-sans bg-background text-foreground selection:bg-primary/20 selection:text-primary transition-colors duration-150">
        <ThemeProvider>
          <TooltipProvider delay={150}>
            {children}
            <Toaster
              position="bottom-right"
              toastOptions={{
                className: "text-xs border border-border bg-card text-foreground",
              }}
            />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
