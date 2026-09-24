"use client";

import React from "react";
import { CheckCircle2, AlertOctagon, Layers, Cpu, ShieldCheck } from "lucide-react";
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
  const isHealthy = statusData?.status === "HEALTHY";
  const openCount = statusData?.open_incidents_count ?? 0;
  const taskCount = statusData?.task_count ?? 4;
  const recoveryRate = totalIncidents > 0 ? Math.round((resolvedIncidents / totalIncidents) * 100) : 100;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* 1. Overall Pipeline Health */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-slate-400">Pipeline Health</span>
          {isHealthy ? (
            <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </span>
          ) : (
            <span className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
              <AlertOctagon className="w-5 h-5" />
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-bold ${isHealthy ? "text-emerald-400" : "text-rose-400"}`}>
            {statusData ? statusData.status : "INITIALIZING"}
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">DAG: ecommerce_pipeline (@daily)</p>
      </div>

      {/* 2. Tasks Monitored */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-slate-400">Pipeline Tasks</span>
          <span className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
            <Layers className="w-5 h-5" />
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white">{taskCount}</span>
          <span className="text-xs text-slate-400">tasks active</span>
        </div>
        <p className="text-xs text-slate-500 mt-1">Ingest → Staging → Core → Test</p>
      </div>

      {/* 3. Open Incidents */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-slate-400">Active Anomalies</span>
          <span className={`p-2 rounded-lg ${openCount > 0 ? "bg-amber-500/10 text-amber-400" : "bg-slate-800 text-slate-400"}`}>
            <Cpu className="w-5 h-5" />
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-bold ${openCount > 0 ? "text-amber-400" : "text-slate-300"}`}>
            {openCount}
          </span>
          <span className="text-xs text-slate-400">unresolved</span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          {openCount === 0 ? "No active data contract breaches" : "Requiring agent triage & remediation"}
        </p>
      </div>

      {/* 4. Automated Recovery Rate */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-slate-400">Autonomous Healing</span>
          <span className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <ShieldCheck className="w-5 h-5" />
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-indigo-400">{recoveryRate}%</span>
          <span className="text-xs text-slate-400">success rate</span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          {resolvedIncidents} of {totalIncidents} incidents auto-healed
        </p>
      </div>
    </div>
  );
}
