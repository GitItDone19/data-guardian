"use client";

import React, { useState } from "react";
import { AlertCircle, CheckCircle2, Clock, ShieldAlert, ArrowUpRight, Search } from "lucide-react";
import { IncidentSummary } from "../lib/api";

interface IncidentListProps {
  incidents: IncidentSummary[];
  onSelectIncident: (id: string) => void;
}

export default function IncidentList({ incidents, onSelectIncident }: IncidentListProps) {
  const [filter, setFilter] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");

  const filtered = incidents.filter((inc) => {
    const matchesFilter = filter === "ALL" || inc.status === filter;
    const matchesSearch =
      inc.incident_id.toLowerCase().includes(search.toLowerCase()) ||
      (inc.error_summary && inc.error_summary.toLowerCase().includes(search.toLowerCase())) ||
      inc.pipeline_name.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="glass-panel p-6">
      {/* Controls & Filter Pills */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">Incident Audit & Remediation Log</h2>
          <p className="text-xs text-slate-400">Autonomous detection, investigation, and recovery stream</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search incidents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-950 border border-slate-800 text-xs">
            {["ALL", "OPEN", "WAITING_FOR_APPROVAL", "RESOLVED"].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  filter === tab
                    ? "bg-cyan-500/20 text-cyan-300 font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab === "ALL"
                  ? "All"
                  : tab === "WAITING_FOR_APPROVAL"
                  ? "Waiting Approval"
                  : tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Incident List Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 rounded-xl bg-slate-950/40 border border-slate-800 text-slate-400 text-xs">
          No incidents matching current criteria.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((inc) => {
            const isWaiting = inc.status === "WAITING_FOR_APPROVAL";
            const isResolved = inc.status === "RESOLVED";
            const isOpen = inc.status === "OPEN";

            return (
              <div
                key={inc.incident_id}
                onClick={() => onSelectIncident(inc.incident_id)}
                className={`glass-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer hover:border-cyan-500/60 transition-all ${
                  isWaiting ? "border-amber-500/40 bg-amber-950/10" : ""
                }`}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="mt-0.5">
                    {isResolved && (
                      <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 inline-block">
                        <CheckCircle2 className="w-4 h-4" />
                      </span>
                    )}
                    {isWaiting && (
                      <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 inline-block animate-pulse">
                        <Clock className="w-4 h-4" />
                      </span>
                    )}
                    {isOpen && (
                      <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 inline-block">
                        <AlertCircle className="w-4 h-4" />
                      </span>
                    )}
                    {!isResolved && !isWaiting && !isOpen && (
                      <span className="p-1.5 rounded-lg bg-slate-800 text-slate-400 inline-block">
                        <ShieldAlert className="w-4 h-4" />
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-mono font-bold text-white tracking-wide">
                        {inc.incident_id}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          isResolved
                            ? "bg-emerald-950/80 border border-emerald-700 text-emerald-300"
                            : isWaiting
                            ? "bg-amber-950/80 border border-amber-700 text-amber-300 font-bold animate-pulse"
                            : "bg-rose-950/80 border border-rose-700 text-rose-300"
                        }`}
                      >
                        {inc.status}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                        {inc.pipeline_name}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 truncate">
                      {inc.error_summary || "Anomalous event recorded."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 self-end sm:self-center">
                  {inc.created_at && (
                    <span className="text-[11px] text-slate-500 font-mono">
                      {new Date(inc.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                  <div className="flex items-center gap-1 text-xs text-cyan-400 font-medium">
                    <span>Inspect</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
