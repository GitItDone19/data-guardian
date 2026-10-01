"use client";

import React, { useState, useRef, useEffect } from "react";
import { triggerSimulation } from "../lib/api";
import { toast } from "sonner";
import {
  RefreshCw,
  ChevronDown,
  RotateCcw,
  FlaskConical,
  ExternalLink,
} from "lucide-react";

interface HeaderProps {
  apiOnline: boolean;
  activeIncidentsCount?: number;
  hasWaitingApproval?: boolean;
  onRefresh: () => void;
}

export default function Header({
  apiOnline,
  activeIncidentsCount = 0,
  hasWaitingApproval = false,
  onRefresh,
}: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loadingScenario, setLoadingScenario] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSimulate = async (scenario: "null_spike" | "schema_drift" | "duplicates" | "reset") => {
    setLoadingScenario(scenario);
    setDropdownOpen(false);
    try {
      const res = await triggerSimulation(scenario);
      toast.success(
        scenario === "reset"
          ? "Database reset: Seed baseline restored."
          : `Incident injected: ${res.message}`
      );
      onRefresh();
    } catch {
      toast.error("Error triggering simulation", {
        description: "Verify backend is running on port 8000.",
      });
    } finally {
      setLoadingScenario(null);
    }
  };

  return (
    <header className="h-12 px-5 bg-[#1c1c1c] border-b border-[#2e2e2e] flex items-center justify-between gap-4 sticky top-0 z-20 select-none">
      {/* Breadcrumbs Trail in Supabase Studio style */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px]">
        <div className="flex items-center gap-1 text-[#a0a0a0] hover:text-[#ededed] cursor-pointer transition-colors">
          <span>DataGuardian</span>
          <ChevronDown className="size-3 text-[#707070]" />
        </div>
        <span className="text-[#404040]">/</span>
        <div className="flex items-center gap-1 text-[#a0a0a0] hover:text-[#ededed] cursor-pointer transition-colors">
          <span>ecommerce_pipeline</span>
          <ChevronDown className="size-3 text-[#707070]" />
        </div>
        <span className="text-[#404040]">/</span>
        <span className="text-[#ededed] font-medium flex items-center gap-2">
          <span>Incidents & self-healing</span>
          {hasWaitingApproval && (
            <span className="size-1.5 rounded-full bg-[#f59e0b]" title="Incident awaiting review" />
          )}
        </span>
      </nav>

      {/* Supabase Studio Action Toolbar */}
      <div className="flex items-center gap-2.5">
        {/* Status indicator */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-[#a0a0a0] mr-1">
          <span
            className={`size-2 rounded-full ${
              apiOnline ? "bg-[#3ecf8e]" : "bg-[#ef4444]"
            }`}
          />
          <span>{apiOnline ? "Live" : "Offline"}</span>
        </div>

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          className="h-8 px-2.5 rounded-[6px] bg-[#232323] hover:bg-[#282828] border border-[#2e2e2e] text-xs font-medium text-[#ededed] flex items-center gap-1.5 transition-colors cursor-pointer"
          title="Refresh dashboard data"
        >
          <RefreshCw className="size-3.5 text-[#a0a0a0]" />
          <span>Refresh</span>
        </button>

        {/* Simulate anomaly dropdown button */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            disabled={loadingScenario !== null}
            className="h-8 px-3 rounded-[6px] bg-[#232323] hover:bg-[#282828] border border-[#2e2e2e] text-xs font-medium text-[#ededed] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <FlaskConical className="size-3.5 text-[#a0a0a0]" />
            <span>{loadingScenario ? "Simulating..." : "Simulate anomaly"}</span>
            <ChevronDown className="size-3 text-[#707070]" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-1.5 w-64 rounded-[6px] bg-[#1c1c1c] border border-[#2e2e2e] p-1 shadow-lg z-50">
              <div className="px-2.5 py-1.5 text-[11px] font-medium text-[#707070]">
                Select test failure scenario
              </div>

              <button
                onClick={() => handleSimulate("null_spike")}
                className="w-full text-left px-2.5 py-2 rounded-[4px] hover:bg-[#232323] text-xs text-[#ededed] transition-colors flex flex-col gap-0.5"
              >
                <div className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-[#f59e0b]" />
                  <span className="font-medium">Null value spike</span>
                </div>
                <span className="text-[11px] text-[#707070] pl-3.5">
                  Inject null order statuses into raw.orders
                </span>
              </button>

              <button
                onClick={() => handleSimulate("schema_drift")}
                className="w-full text-left px-2.5 py-2 rounded-[4px] hover:bg-[#232323] text-xs text-[#ededed] transition-colors flex flex-col gap-0.5"
              >
                <div className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-[#38bdf8]" />
                  <span className="font-medium">Schema drift</span>
                </div>
                <span className="text-[11px] text-[#707070] pl-3.5">
                  Rename zip_code column in raw.customers
                </span>
              </button>

              <button
                onClick={() => handleSimulate("duplicates")}
                className="w-full text-left px-2.5 py-2 rounded-[4px] hover:bg-[#232323] text-xs text-[#ededed] transition-colors flex flex-col gap-0.5"
              >
                <div className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-[#ef4444]" />
                  <span className="font-medium">Duplicate primary keys</span>
                </div>
                <span className="text-[11px] text-[#707070] pl-3.5">
                  Insert duplicate keys into raw.payments
                </span>
              </button>

              <div className="h-px bg-[#2e2e2e] my-1" />

              <button
                onClick={() => handleSimulate("reset")}
                className="w-full text-left px-2.5 py-2 rounded-[4px] hover:bg-[#232323] text-xs text-[#ededed] transition-colors flex items-center gap-2"
              >
                <RotateCcw className="size-3 text-[#a0a0a0]" />
                <span>Reset seed baseline</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
