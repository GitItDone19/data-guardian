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
    <div className="rounded-[6px] border border-border bg-card grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border transition-colors">
      {/* Stat 1: Pipeline status */}
      <div className="p-4 flex flex-col justify-between gap-2">
        <span className="text-xs text-muted-foreground font-medium">Pipeline status</span>
        <div className="flex items-center gap-2">
          <span
            className={`size-2 rounded-full ${
              isHealthy ? "bg-primary" : "bg-destructive"
            }`}
          />
          <span className="text-2xl font-semibold text-foreground tracking-tight">
            {isHealthy ? "Healthy" : "Degraded"}
          </span>
        </div>
        <span className="text-xs text-muted-foreground/70 font-mono">
          ecommerce_pipeline
        </span>
      </div>

      {/* Stat 2: Open incidents */}
      <div className="p-4 flex flex-col justify-between gap-2">
        <span className="text-xs text-muted-foreground font-medium">Open incidents</span>
        <div className="text-2xl font-semibold text-foreground tracking-tight">
          {openCount}
        </div>
        <span className="text-xs text-muted-foreground/70">
          {openCount === 0 ? "No active failures" : "Requires triage or review"}
        </span>
      </div>

      {/* Stat 3: Auto-resolved incidents */}
      <div className="p-4 flex flex-col justify-between gap-2">
        <span className="text-xs text-muted-foreground font-medium">Auto-resolved</span>
        <div className="text-2xl font-semibold text-foreground tracking-tight">
          {totalIncidents === 0 ? (
            "-"
          ) : (
            <>
              {resolvedIncidents}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                / {totalIncidents}
              </span>
            </>
          )}
        </div>
        <span className="text-xs text-muted-foreground/70">
          {resolutionRate !== null ? `${resolutionRate}% resolution rate` : "No data yet"}
        </span>
      </div>

      {/* Stat 4: Mean time to resolve */}
      <div className="p-4 flex flex-col justify-between gap-2">
        <span className="text-xs text-muted-foreground font-medium">Mean time to resolve</span>
        <div className="text-2xl font-semibold text-foreground tracking-tight">
          {resolvedIncidents > 0 ? "42s" : "-"}
        </div>
        <span className="text-xs text-muted-foreground/70">
          {resolvedIncidents > 0 ? "Autonomous sandbox validation" : "No data yet"}
        </span>
      </div>
    </div>
  );
}
