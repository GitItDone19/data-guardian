"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { triggerSimulation, IncidentSummary } from "../lib/api";
import { toast } from "sonner";
import {
  ChevronDown,
  RotateCcw,
  FlaskConical,
  Bell,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";


interface HeaderProps {
  apiOnline: boolean;
  activeIncidentsCount?: number;
  hasWaitingApproval?: boolean;
  incidents?: IncidentSummary[];
  onRefresh: () => void;
  onSelectIncident?: (id: string) => void;
}

export default function Header({
  apiOnline,
  activeIncidentsCount = 0,
  hasWaitingApproval = false,
  incidents = [],
  onRefresh,
  onSelectIncident,
}: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loadingScenario, setLoadingScenario] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [seenCount, setSeenCount] = useState(0);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unseenCount = Math.max(0, activeIncidentsCount - seenCount);

  function openNotifications() {
    setNotifOpen((o) => !o);
    if (!notifOpen) setSeenCount(activeIncidentsCount);
  }

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

  function statusColor(status: string) {
    if (status === "WAITING_FOR_APPROVAL") return "text-[#f59e0b]";
    if (status === "RESOLVED") return "text-primary";
    return "text-destructive";
  }

  function statusIcon(status: string) {
    if (status === "WAITING_FOR_APPROVAL") return <Clock className="size-3.5 text-[#f59e0b] shrink-0" />;
    if (status === "RESOLVED") return <CheckCircle2 className="size-3.5 text-primary shrink-0" />;
    return <AlertTriangle className="size-3.5 text-destructive shrink-0" />;
  }

  function timeAgo(iso?: string) {
    if (!iso) return "recently";
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  }

  return (
    <header className="h-12 px-5 bg-card border-b border-border flex items-center justify-between gap-4 sticky top-0 z-20 select-none transition-colors">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px]">
        <Link href="/" className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors" title="Go to Product Landing Page">
          <span className="font-medium">DataGuardian</span>
        </Link>
        <span className="text-muted-foreground/50">/</span>
        <div className="flex items-center gap-1 text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
          <span>ecommerce_pipeline</span>
          <ChevronDown className="size-3 text-muted-foreground" />
        </div>
        <span className="text-muted-foreground/50">/</span>
        <span className="text-foreground font-medium flex items-center gap-2">
          <span>Incidents &amp; self-healing</span>
          {hasWaitingApproval && (
            <span className="size-1.5 rounded-full bg-[#f59e0b]" title="Incident awaiting review" />
          )}
          {activeIncidentsCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30">
              {activeIncidentsCount}
            </span>
          )}
        </span>
      </nav>

      {/* Action Toolbar */}
      <div className="flex items-center gap-2">
        {/* API Status */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
          <span className={`size-2 rounded-full ${apiOnline ? "bg-primary" : "bg-destructive"}`} />
          <span>{apiOnline ? "Live" : "Offline"}</span>
        </div>

        {/* ── NOTIFICATION BELL ── */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={openNotifications}
            className="relative h-8 w-8 rounded-[6px] bg-secondary hover:bg-accent border border-border flex items-center justify-center transition-colors cursor-pointer"
            title="Notifications"
            aria-label="Open notifications"
          >
            <Bell className="size-3.5 text-muted-foreground" />
            {unseenCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center">
                {unseenCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-1.5 w-80 rounded-[8px] bg-card border border-border shadow-xl z-50 overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Notifications</span>
                {activeIncidentsCount > 0 ? (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/20">
                    {activeIncidentsCount} active
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground">All clear</span>
                )}
              </div>

              {/* List */}
              <div className="max-h-72 overflow-y-auto divide-y divide-border/50">
                {incidents.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                    <CheckCircle2 className="size-5 text-primary" />
                    <span>All pipelines healthy</span>
                  </div>
                ) : (
                  incidents.map((inc) => (
                    <button
                      key={inc.incident_id}
                      onClick={() => {
                        onSelectIncident?.(inc.incident_id);
                        setNotifOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-secondary transition-colors flex items-start gap-2.5 cursor-pointer"
                    >
                      {statusIcon(inc.status)}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-mono font-semibold text-foreground truncate">
                            {inc.incident_id}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {timeAgo(inc.created_at)}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {inc.error_summary}
                        </p>
                        <span className={`text-[10px] font-medium mt-1 block ${statusColor(inc.status)}`}>
                          {inc.status.replace(/_/g, " ")}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Footer */}
              {incidents.length > 0 && (
                <div className="px-4 py-2.5 border-t border-border bg-secondary/40">
                  <button
                    onClick={() => { onRefresh(); setNotifOpen(false); }}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="size-3" />
                    Refresh incidents
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Simulate anomaly */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            disabled={loadingScenario !== null}
            className="h-8 px-3 rounded-[6px] bg-secondary hover:bg-accent border border-border text-xs font-medium text-foreground flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <FlaskConical className="size-3.5 text-muted-foreground" />
            <span>{loadingScenario ? "Simulating..." : "Simulate anomaly"}</span>
            <ChevronDown className="size-3 text-muted-foreground" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-1.5 w-64 rounded-[6px] bg-card border border-border p-1 shadow-lg z-50">
              <div className="px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground">
                Select test failure scenario
              </div>

              <button
                onClick={() => handleSimulate("null_spike")}
                className="w-full text-left px-2.5 py-2 rounded-[4px] hover:bg-secondary text-xs text-foreground transition-colors flex flex-col gap-0.5"
              >
                <div className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-[#f59e0b]" />
                  <span className="font-medium">Null value spike</span>
                </div>
                <span className="text-[11px] text-muted-foreground pl-3.5">
                  Inject null order statuses into raw.orders
                </span>
              </button>

              <button
                onClick={() => handleSimulate("schema_drift")}
                className="w-full text-left px-2.5 py-2 rounded-[4px] hover:bg-secondary text-xs text-foreground transition-colors flex flex-col gap-0.5"
              >
                <div className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-[#38bdf8]" />
                  <span className="font-medium">Schema drift</span>
                </div>
                <span className="text-[11px] text-muted-foreground pl-3.5">
                  Rename zip_code column in raw.customers
                </span>
              </button>

              <button
                onClick={() => handleSimulate("duplicates")}
                className="w-full text-left px-2.5 py-2 rounded-[4px] hover:bg-secondary text-xs text-foreground transition-colors flex flex-col gap-0.5"
              >
                <div className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-destructive" />
                  <span className="font-medium">Duplicate primary keys</span>
                </div>
                <span className="text-[11px] text-muted-foreground pl-3.5">
                  Insert duplicate keys into raw.payments
                </span>
              </button>

              <div className="h-px bg-border my-1" />

              <button
                onClick={() => handleSimulate("reset")}
                className="w-full text-left px-2.5 py-2 rounded-[4px] hover:bg-secondary text-xs text-foreground transition-colors flex items-center gap-2"
              >
                <RotateCcw className="size-3 text-muted-foreground" />
                <span>Reset seed baseline</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
