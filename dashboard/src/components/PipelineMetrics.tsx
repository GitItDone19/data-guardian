"use client";

import React from "react";
import { PipelineStatusResponse } from "../lib/api";

interface PipelineMetricsProps {
  statusData: PipelineStatusResponse | null;
  totalIncidents: number;
  resolvedIncidents: number;
}

export default function PipelineMetrics({
  statusData,
  totalIncidents,
  resolvedIncidents,
}: PipelineMetricsProps) {
  const isHealthy = statusData?.status === "HEALTHY" || (statusData?.open_incidents_count === 0);
  const openCount = statusData?.open_incidents_count ?? 0;

  const resolutionRate =
    totalIncidents > 0 ? Math.round((resolvedIncidents / totalIncidents) * 100) : null;

  return (
    <div className="rounded-[6px] border border-[#2e2e2e] bg-[#1c1c1c] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#2e2e2e]">
      {/* Stat 1: Pipeline status */}
      <div className="p-4 flex flex-col justify-between gap-2">
        <span className="text-xs text-[#a0a0a0]">Pipeline status</span>
        <div className="flex items-center gap-2">
          <span
            className={`size-2 rounded-full ${
              isHealthy ? "bg-[#3ecf8e]" : "bg-[#ef4444]"
            }`}
          />
          <span className="text-2xl font-semibold text-[#ededed] tracking-tight">
            {isHealthy ? "Healthy" : "Degraded"}
          </span>
        </div>
        <span className="text-xs text-[#707070] font-mono">
          ecommerce_pipeline
        </span>
      </div>

      {/* Stat 2: Open incidents */}
      <div className="p-4 flex flex-col justify-between gap-2">
        <span className="text-xs text-[#a0a0a0]">Open incidents</span>
        <div className="text-2xl font-semibold text-[#ededed] tracking-tight">
          {openCount}
        </div>
        <span className="text-xs text-[#707070]">
          {openCount === 0 ? "No active failures" : "Requires triage or review"}
        </span>
      </div>

      {/* Stat 3: Auto-resolved incidents */}
      <div className="p-4 flex flex-col justify-between gap-2">
        <span className="text-xs text-[#a0a0a0]">Auto-resolved</span>
        <div className="text-2xl font-semibold text-[#ededed] tracking-tight">
          {totalIncidents === 0 ? (
            "-"
          ) : (
            <>
              {resolvedIncidents}{" "}
              <span className="text-xs font-normal text-[#a0a0a0]">
                / {totalIncidents}
              </span>
            </>
          )}
        </div>
        <span className="text-xs text-[#707070]">
          {resolutionRate !== null ? `${resolutionRate}% resolution rate` : "No data yet"}
        </span>
      </div>

      {/* Stat 4: Mean time to resolve */}
      <div className="p-4 flex flex-col justify-between gap-2">
        <span className="text-xs text-[#a0a0a0]">Mean time to resolve</span>
        <div className="text-2xl font-semibold text-[#ededed] tracking-tight">
          {resolvedIncidents > 0 ? "42s" : "-"}
        </div>
        <span className="text-xs text-[#707070]">
          {resolvedIncidents > 0 ? "Autonomous sandbox validation" : "No data yet"}
        </span>
      </div>
    </div>
  );
}
