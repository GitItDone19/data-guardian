"use client";

import React from "react";
import {
  ShieldAlert,
  Activity,
  Layers,
  Database,
  TestTube2,
  FileText,
  ExternalLink,
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
    <aside className="w-56 shrink-0 bg-[#1c1c1c] border-r border-[#2e2e2e] flex flex-col justify-between h-screen sticky top-0 select-none">
      {/* Top Header & Project Switcher */}
      <div>
        {/* Brand Header */}
        <div className="h-12 px-4 flex items-center border-b border-[#2e2e2e]">
          <div className="flex items-center gap-2.5">
            {/* Supabase-style flat emerald logo */}
            <div className="size-6 rounded-[5px] bg-[#3ecf8e] flex items-center justify-center text-[#0e0e0e]">
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="size-3.5"
              >
                <path d="M12 2L2 19.5h9L9 22l13-10h-9l3-10z" />
              </svg>
            </div>
            <span className="font-semibold text-sm text-[#ededed] tracking-tight">
              DataGuardian
            </span>
          </div>
        </div>


        {/* Navigation Menu */}
        <nav className="p-2.5 space-y-4">
          {/* Section: Operational reliability */}
          <div>
            <div className="px-2 mb-1.5 text-xs text-[#707070]">
              Operational reliability
            </div>
            <div className="space-y-0.5">
              <button
                onClick={() => setActiveTab("incidents")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-[13px] font-medium transition-colors cursor-pointer ${
                  activeTab === "incidents"
                    ? "bg-[#232323] text-[#ededed]"
                    : "text-[#a0a0a0] hover:text-[#ededed] hover:bg-[#232323]/50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <ShieldAlert className="size-4 text-[#a0a0a0]" strokeWidth={1.5} />
                  <span>Incidents & triage</span>
                </div>
                {openIncidentsCount > 0 ? (
                  <span className="px-1.5 py-0.2 rounded-full text-[11px] font-medium bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30">
                    {openIncidentsCount}
                  </span>
                ) : (
                  <span className="text-[11px] text-[#707070]">0</span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("metrics")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-[13px] font-medium transition-colors cursor-pointer ${
                  activeTab === "metrics"
                    ? "bg-[#232323] text-[#ededed]"
                    : "text-[#a0a0a0] hover:text-[#ededed] hover:bg-[#232323]/50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Activity className="size-4 text-[#a0a0a0]" strokeWidth={1.5} />
                  <span>Pipeline metrics</span>
                </div>
              </button>

              <button
                onClick={() => setActiveTab("lineage")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-[13px] font-medium transition-colors cursor-pointer ${
                  activeTab === "lineage"
                    ? "bg-[#232323] text-[#ededed]"
                    : "text-[#a0a0a0] hover:text-[#ededed] hover:bg-[#232323]/50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Layers className="size-4 text-[#a0a0a0]" strokeWidth={1.5} />
                  <span>dbt DAG lineage</span>
                </div>
              </button>
            </div>
          </div>

          {/* Section: Warehouse & schema */}
          <div>
            <div className="px-2 mb-1.5 text-xs text-[#707070]">
              Warehouse & schema
            </div>
            <div className="space-y-0.5">
              <button
                onClick={() => setActiveTab("database")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-[13px] font-medium transition-colors cursor-pointer ${
                  activeTab === "database"
                    ? "bg-[#232323] text-[#ededed]"
                    : "text-[#a0a0a0] hover:text-[#ededed] hover:bg-[#232323]/50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Database className="size-4 text-[#a0a0a0]" strokeWidth={1.5} />
                  <span>PostgreSQL tables</span>
                </div>
              </button>

              <button
                onClick={() => setActiveTab("sandbox")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-[13px] font-medium transition-colors cursor-pointer ${
                  activeTab === "sandbox"
                    ? "bg-[#232323] text-[#ededed]"
                    : "text-[#a0a0a0] hover:text-[#ededed] hover:bg-[#232323]/50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <TestTube2 className="size-4 text-[#a0a0a0]" strokeWidth={1.5} />
                  <span>Staging sandbox</span>
                </div>
              </button>

              <button
                onClick={() => setActiveTab("audit")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-[13px] font-medium transition-colors cursor-pointer ${
                  activeTab === "audit"
                    ? "bg-[#232323] text-[#ededed]"
                    : "text-[#a0a0a0] hover:text-[#ededed] hover:bg-[#232323]/50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="size-4 text-[#a0a0a0]" strokeWidth={1.5} />
                  <span>Agent audit log</span>
                </div>
              </button>
            </div>
          </div>

          {/* Section: External tools */}
          <div>
            <div className="px-2 mb-1.5 text-xs text-[#707070]">
              External tools
            </div>
            <div className="space-y-0.5">
              <a
                href="http://localhost:8000/docs"
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-[13px] font-medium text-[#a0a0a0] hover:text-[#ededed] hover:bg-[#232323]/50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <ExternalLink className="size-4 text-[#a0a0a0]" strokeWidth={1.5} />
                  <span>FastAPI & MCP docs</span>
                </div>
              </a>
            </div>
          </div>
        </nav>
      </div>

      {/* Reduced Subtle Connection Status Line */}
      <div className="p-3 border-t border-[#2e2e2e] flex items-center justify-between text-xs text-[#a0a0a0]">
        <div className="flex items-center gap-2">
          <span
            className={`size-2 rounded-full ${
              apiOnline ? "bg-[#3ecf8e]" : "bg-[#ef4444]"
            }`}
          />
          <span>{apiOnline ? "Connected (:5433)" : "API offline"}</span>
        </div>
        <span className="font-mono text-[11px] text-[#707070]">v1.0</span>
      </div>
    </aside>
  );
}
