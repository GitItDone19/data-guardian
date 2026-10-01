"use client";

import React, { useState } from "react";
import { IncidentSummary, triggerSimulation } from "../lib/api";
import { Search, ChevronRight, CheckCircle2, FlaskConical } from "lucide-react";
import { toast } from "sonner";

interface IncidentListProps {
  incidents: IncidentSummary[];
  onSelectIncident: (id: string) => void;
  onRefresh?: () => void;
}

function getClassification(summary?: string) {
  const text = (summary || "").toLowerCase();
  if (text.includes("schema") || text.includes("drift") || text.includes("rename")) {
    return { label: "Schema drift", className: "text-[#a0a0a0] bg-[#232323] border-[#2e2e2e]" };
  }
  if (text.includes("null") || text.includes("missing")) {
    return { label: "Null values", className: "text-[#a0a0a0] bg-[#232323] border-[#2e2e2e]" };
  }
  if (text.includes("duplicate") || text.includes("unique") || text.includes("key")) {
    return { label: "Duplicate keys", className: "text-[#a0a0a0] bg-[#232323] border-[#2e2e2e]" };
  }
  return { label: "Quality contract", className: "text-[#a0a0a0] bg-[#232323] border-[#2e2e2e]" };
}

function formatTimestamp(isoString?: string) {
  if (!isoString) return "-";
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  } catch {
    return isoString;
  }
}

export default function IncidentList({
  incidents,
  onSelectIncident,
  onRefresh,
}: IncidentListProps) {
  const [filter, setFilter] = useState<"ALL" | "WAITING" | "RESOLVED">("ALL");
  const [search, setSearch] = useState<string>("");
  const [isSimulating, setIsSimulating] = useState(false);

  const filtered = incidents.filter((inc) => {
    if (filter === "WAITING" && inc.status !== "WAITING_FOR_APPROVAL") return false;
    if (filter === "RESOLVED" && inc.status !== "RESOLVED") return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchId = inc.incident_id.toLowerCase().includes(q);
      const matchErr = (inc.error_summary || "").toLowerCase().includes(q);
      return matchId || matchErr;
    }
    return true;
  });

  const waitingCount = incidents.filter((i) => i.status === "WAITING_FOR_APPROVAL").length;

  const handleSimulateDefault = async () => {
    setIsSimulating(true);
    try {
      await triggerSimulation("schema_drift");
      toast.success("Incident injected: Schema drift simulated.");
      if (onRefresh) onRefresh();
    } catch {
      toast.error("Failed to inject simulation");
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Standard Supabase Toolbar (No enclosing card) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Segmented Filter Control */}
        <div className="flex items-center rounded-[6px] bg-[#1c1c1c] border border-[#2e2e2e] p-0.5 text-xs">
          <button
            onClick={() => setFilter("ALL")}
            className={`px-3 py-1.5 rounded-[4px] font-medium transition-colors cursor-pointer ${
              filter === "ALL"
                ? "bg-[#282828] text-[#ededed]"
                : "text-[#a0a0a0] hover:text-[#ededed]"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("WAITING")}
            className={`px-3 py-1.5 rounded-[4px] font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              filter === "WAITING"
                ? "bg-[#282828] text-[#ededed]"
                : "text-[#a0a0a0] hover:text-[#ededed]"
            }`}
          >
            <span>Needs review</span>
            {waitingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#2e2e2e] text-[#a0a0a0] text-[10px] font-medium">
                {waitingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setFilter("RESOLVED")}
            className={`px-3 py-1.5 rounded-[4px] font-medium transition-colors cursor-pointer ${
              filter === "RESOLVED"
                ? "bg-[#282828] text-[#ededed]"
                : "text-[#a0a0a0] hover:text-[#ededed]"
            }`}
          >
            Resolved
          </button>
        </div>

        {/* Search input with Supabase styling */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[#707070]" />
          <input
            type="text"
            placeholder="Filter incidents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 pr-3 text-xs rounded-[6px] bg-[#1c1c1c] border border-[#2e2e2e] text-[#ededed] placeholder:text-[#707070] focus:outline-none focus:border-[#3ecf8e] w-full sm:w-64 transition-colors"
          />
        </div>
      </div>

      {/* Supabase Studio Table */}
      <div className="rounded-[6px] border border-[#2e2e2e] bg-[#1c1c1c] overflow-hidden">
        {filtered.length === 0 ? (
          /* Supabase-style empty state */
          <div className="py-16 flex flex-col items-center justify-center text-center p-6 select-none">
            <div className="size-10 rounded-full bg-[#232323] flex items-center justify-center mb-3">
              <CheckCircle2 className="size-5 text-[#a0a0a0]" strokeWidth={1.5} />
            </div>
            <h3 className="text-sm font-medium text-[#ededed]">No incidents</h3>
            <p className="text-xs text-[#707070] max-w-sm mt-1 mb-4">
              {search || filter !== "ALL"
                ? "No incidents matched your search filters."
                : "Your pipeline is healthy with no unresolved quality failures."}
            </p>
            {!search && filter === "ALL" && (
              <button
                onClick={handleSimulateDefault}
                disabled={isSimulating}
                className="h-8 px-3 rounded-[6px] bg-[#232323] hover:bg-[#282828] border border-[#2e2e2e] text-xs font-medium text-[#ededed] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <FlaskConical className="size-3.5 text-[#a0a0a0]" />
                <span>{isSimulating ? "Simulating..." : "Simulate anomaly"}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[#2e2e2e] bg-[#1f1f1f] text-[#a0a0a0] text-xs">
                  <th className="py-2.5 px-4 font-normal">Incident</th>
                  <th className="py-2.5 px-4 font-normal">Classification</th>
                  <th className="py-2.5 px-4 font-normal">Summary</th>
                  <th className="py-2.5 px-4 font-normal">Status</th>
                  <th className="py-2.5 px-4 font-normal">Created</th>
                  <th className="py-2.5 px-4 font-normal text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2e2e2e]">
                {filtered.map((inc) => {
                  const classification = getClassification(inc.error_summary);

                  return (
                    <tr
                      key={inc.incident_id}
                      onClick={() => onSelectIncident(inc.incident_id)}
                      className="h-11 hover:bg-[#222222] cursor-pointer transition-colors group"
                    >
                      {/* ID */}
                      <td className="py-2.5 px-4 font-mono text-xs font-medium text-[#ededed]">
                        {inc.incident_id}
                      </td>

                      {/* Classification */}
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-xs border ${classification.className}`}
                        >
                          {classification.label}
                        </span>
                      </td>

                      {/* Summary */}
                      <td className="py-2.5 px-4 text-[#a0a0a0] max-w-md truncate">
                        {inc.error_summary || "Pipeline data contract assertion failed"}
                      </td>

                      {/* Status as dot + text */}
                      <td className="py-2.5 px-4">
                        {inc.status === "RESOLVED" && (
                          <span className="inline-flex items-center gap-1.5 text-xs text-[#3ecf8e]">
                            <span className="size-1.5 rounded-full bg-[#3ecf8e]" />
                            Resolved
                          </span>
                        )}
                        {inc.status === "WAITING_FOR_APPROVAL" && (
                          <span className="inline-flex items-center gap-1.5 text-xs text-[#a0a0a0]">
                            <span className="size-1.5 rounded-full bg-[#a0a0a0]" />
                            Needs review
                          </span>
                        )}
                        {inc.status === "OPEN" && (
                          <span className="inline-flex items-center gap-1.5 text-xs text-[#a0a0a0]">
                            <span className="size-1.5 rounded-full bg-[#a0a0a0]" />
                            Open
                          </span>
                        )}
                        {inc.status === "REJECTED" && (
                          <span className="inline-flex items-center gap-1.5 text-xs text-[#a0a0a0]">
                            <span className="size-1.5 rounded-full bg-[#a0a0a0]" />
                            Rejected
                          </span>
                        )}
                      </td>

                      {/* Created */}
                      <td className="py-2.5 px-4 text-xs font-mono text-[#707070]">
                        {formatTimestamp(inc.created_at)}
                      </td>

                      {/* Action */}
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectIncident(inc.incident_id);
                          }}
                          className="h-7 px-2.5 rounded-[4px] text-xs text-[#a0a0a0] hover:text-[#ededed] hover:bg-[#282828] transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>View</span>
                          <ChevronRight className="size-3 text-[#707070]" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
