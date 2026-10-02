"use client";

import React from "react";
import Link from "next/link";
import {
  ShieldAlert,
  Activity,
  Layers,
  Database,
  TestTube2,
  FileText,
  ExternalLink,
  Sparkles,
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  openIncidentsCount: number;
  apiOnline: boolean;
  postgresHealthy?: boolean;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  openIncidentsCount,
  apiOnline,
}: SidebarProps) {
  return (
    <aside className="w-56 shrink-0 bg-card border-r border-border flex flex-col justify-between h-screen sticky top-0 select-none transition-colors">
      {/* Top Header & Project Switcher */}
      <div>
        {/* Brand Header */}
        <div className="h-12 px-4 flex items-center border-b border-border">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-85 transition-opacity" title="Back to Landing Page">
            {/* Supabase-style emerald logo */}
            <div className="size-6 rounded-[5px] bg-primary flex items-center justify-center text-primary-foreground">
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="size-3.5"
              >
                <path d="M12 2L2 19.5h9L9 22l13-10h-9l3-10z" />
              </svg>
            </div>
            <span className="font-semibold text-sm text-foreground tracking-tight">
              DataGuardian
            </span>
          </Link>
        </div>

        {/* Navigation Menu */}
        <nav className="p-2.5 space-y-4">
          {/* Section: Operational reliability */}
          <div>
            <div className="px-2 mb-1.5 text-xs text-muted-foreground font-medium">
              Operational reliability
            </div>
            <div className="space-y-0.5">
              <button
                onClick={() => setActiveTab("incidents")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-[13px] font-medium transition-colors cursor-pointer ${
                  activeTab === "incidents"
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <ShieldAlert className="size-4 text-muted-foreground" strokeWidth={1.5} />
                  <span>Incidents &amp; triage</span>
                </div>
                {openIncidentsCount > 0 ? (
                  <span className="px-1.5 py-0.2 rounded-full text-[11px] font-medium bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30">
                    {openIncidentsCount}
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground/60">0</span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("metrics")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-[13px] font-medium transition-colors cursor-pointer ${
                  activeTab === "metrics"
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Activity className="size-4 text-muted-foreground" strokeWidth={1.5} />
                  <span>Pipeline metrics</span>
                </div>
              </button>

              <button
                onClick={() => setActiveTab("lineage")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-[13px] font-medium transition-colors cursor-pointer ${
                  activeTab === "lineage"
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Layers className="size-4 text-muted-foreground" strokeWidth={1.5} />
                  <span>dbt DAG lineage</span>
                </div>
              </button>
            </div>
          </div>

          {/* Section: Warehouse & schema */}
          <div>
            <div className="px-2 mb-1.5 text-xs text-muted-foreground font-medium">
              Warehouse &amp; schema
            </div>
            <div className="space-y-0.5">
              <button
                onClick={() => setActiveTab("database")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-[13px] font-medium transition-colors cursor-pointer ${
                  activeTab === "database"
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Database className="size-4 text-muted-foreground" strokeWidth={1.5} />
                  <span>PostgreSQL tables</span>
                </div>
              </button>

              <button
                onClick={() => setActiveTab("sandbox")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-[13px] font-medium transition-colors cursor-pointer ${
                  activeTab === "sandbox"
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <TestTube2 className="size-4 text-muted-foreground" strokeWidth={1.5} />
                  <span>Staging sandbox</span>
                </div>
              </button>

              <button
                onClick={() => setActiveTab("audit")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-[13px] font-medium transition-colors cursor-pointer ${
                  activeTab === "audit"
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="size-4 text-muted-foreground" strokeWidth={1.5} />
                  <span>Agent audit log</span>
                </div>
              </button>
            </div>
          </div>

          {/* Section: External tools */}
          <div>
            <div className="px-2 mb-1.5 text-xs text-muted-foreground font-medium">
              External tools
            </div>
            <div className="space-y-0.5">
              <Link
                href="/"
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Sparkles className="size-4 text-primary" strokeWidth={1.5} />
                  <span>Product landing</span>
                </div>
              </Link>
              <a
                href="http://localhost:8000/docs"
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <ExternalLink className="size-4 text-muted-foreground" strokeWidth={1.5} />
                  <span>FastAPI &amp; MCP docs</span>
                </div>
              </a>
            </div>
          </div>
        </nav>
      </div>

      {/* Reduced Subtle Connection Status Line */}
      <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span
            className={`size-2 rounded-full ${
              apiOnline ? "bg-primary" : "bg-destructive"
            }`}
          />
          <span>{apiOnline ? "Connected (:5433)" : "API offline"}</span>
        </div>
        <span className="font-mono text-[11px] text-muted-foreground/70">v1.0</span>
      </div>
    </aside>
  );
}
