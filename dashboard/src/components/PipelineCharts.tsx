"use client";

import React from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Clock, ShieldAlert, CheckCircle2, Zap } from "lucide-react";

// 1. Pipeline SLA & Duration Trend (Last 14 DAG Runs)
// Tracks runtime in seconds and whether the run breached SLA (target SLA: 180s)
const RUN_DURATION_DATA = [
  { run: "Run 1", duration: 132, status: "PASS", sla: 180 },
  { run: "Run 2", duration: 138, status: "PASS", sla: 180 },
  { run: "Run 3", duration: 145, status: "PASS", sla: 180 },
  { run: "Run 4", duration: 141, status: "PASS", sla: 180 },
  { run: "Run 5", duration: 188, status: "INCIDENT", sla: 180 }, // Anomaly
  { run: "Run 6", duration: 136, status: "PASS", sla: 180 },
  { run: "Run 7", duration: 140, status: "PASS", sla: 180 },
  { run: "Run 8", duration: 148, status: "PASS", sla: 180 },
  { run: "Run 9", duration: 195, status: "INCIDENT", sla: 180 }, // Anomaly
  { run: "Run 10", duration: 142, status: "PASS", sla: 180 },
  { run: "Run 11", duration: 139, status: "PASS", sla: 180 },
  { run: "Run 12", duration: 144, status: "PASS", sla: 180 },
  { run: "Run 13", duration: 152, status: "PASS", sla: 180 },
  { run: "Run 14 (Latest)", duration: 135, status: "PASS", sla: 180 },
];

// 2. Incident Root-Cause Categorization
const ROOT_CAUSE_DISTRIBUTION = [
  { name: "Schema Drift", count: 18, color: "#38bdf8", pct: "47%" },
  { name: "Null Spike", count: 11, color: "#f59e0b", pct: "29%" },
  { name: "Primary Key Dupes", count: 6, color: "#ef4444", pct: "16%" },
  { name: "Type Coercion", count: 3, color: "#a855f7", pct: "8%" },
];

// 3. MTTR Comparison: Autonomous DataGuardian vs Traditional Human On-Call (in minutes)
const MTTR_COMPARISON_DATA = [
  { phase: "Detection", human: 34, autonomous: 1.2 },
  { phase: "Root Cause (RCA)", human: 48, autonomous: 2.1 },
  { phase: "Patch & Sandbox Test", human: 65, autonomous: 3.5 },
  { phase: "Approval & Deploy", human: 22, autonomous: 0.8 },
];

// 4. Data Quality Contract Pass Rate (by dbt model layer)
const CONTRACT_PASS_DATA = [
  { layer: "raw (sources)", pass: 94.2, fail: 5.8 },
  { layer: "staging (stg_)", pass: 98.6, fail: 1.4 },
  { layer: "core (dim_/fct_)", pass: 99.4, fail: 0.6 },
  { layer: "marts (reporting)", pass: 100.0, fail: 0.0 },
];

// Custom Tooltip component matching Supabase / Dark-First aesthetic
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-[4px] border border-border bg-popover px-3 py-2 text-xs shadow-md">
        <p className="font-semibold text-foreground mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={`item-${index}`} className="text-[11px] flex items-center gap-1.5" style={{ color: entry.color }}>
            <span className="size-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span>{entry.name}:</span>
            <span className="font-mono font-medium">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export default function PipelineCharts() {
  return (
    <div className="space-y-6">
      {/* Top 2 Charts: Runtime SLA Trend + MTTR Benchmark */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Chart 1: DAG Runtime Duration & SLA Compliance */}
        <div className="rounded-[6px] border border-border bg-card p-4 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  DAG Runtime &amp; SLA Compliance
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Runtime trend across last 14 runs vs. SLA limit (180s)
              </p>
            </div>
            <span className="text-[11px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
              Avg 142s (Safe)
            </span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={RUN_DURATION_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="durationGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3ecf8e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3ecf8e" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="run"
                  stroke="#707070"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: "#333333" }}
                  interval={2}
                />
                <YAxis
                  stroke="#707070"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: "#333333" }}
                  unit="s"
                  domain={[80, 220]}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="duration"
                  name="Runtime (s)"
                  stroke="#3ecf8e"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#durationGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60 text-xs">
            <div>
              <span className="text-muted-foreground block text-[10px]">Target SLA</span>
              <span className="font-mono font-medium text-foreground">&lt; 180 seconds</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">SLA Breaches</span>
              <span className="font-mono font-medium text-destructive">2 incidents auto-caught</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Uptime Rate</span>
              <span className="font-mono font-medium text-primary">99.85%</span>
            </div>
          </div>
        </div>

        {/* Chart 2: Autonomous vs Human MTTR Benchmark */}
        <div className="rounded-[6px] border border-border bg-card p-4 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Zap className="size-4 text-[#f59e0b]" />
                <h3 className="text-sm font-semibold text-foreground">
                  Mean Time to Resolve (MTTR): Agent vs Human
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Resolution latency in minutes by lifecycle triage phase
              </p>
            </div>
            <span className="text-[11px] font-mono text-[#f59e0b] bg-[#f59e0b]/10 px-2 py-0.5 rounded border border-[#f59e0b]/20">
              95% Time Saved
            </span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MTTR_COMPARISON_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="phase"
                  stroke="#707070"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: "#333333" }}
                />
                <YAxis
                  stroke="#707070"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: "#333333" }}
                  unit="m"
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="human" name="Human On-Call (mins)" fill="#ef4444" radius={[4, 4, 0, 0]} opacity={0.65} />
                <Bar dataKey="autonomous" name="DataGuardian Agent (mins)" fill="#3ecf8e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60 text-xs">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-destructive" />
              <span className="text-muted-foreground">Human triage: ~169 mins total</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-primary" />
              <span className="text-foreground font-medium">DataGuardian: ~7.6 mins total</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom 2 Charts: Root Cause Breakdown + Contract Pass Rate */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Chart 3: Root Cause Anomaly Distribution */}
        <div className="rounded-[6px] border border-border bg-card p-4 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-4 text-[#38bdf8]" />
                <h3 className="text-sm font-semibold text-foreground">
                  Incident Root-Cause Breakdown
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Distribution of pipeline failures identified by catalog inspectors
              </p>
            </div>
            <span className="text-[11px] font-mono text-[#38bdf8] bg-[#38bdf8]/10 px-2 py-0.5 rounded border border-[#38bdf8]/20">
              38 Incidents
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 h-56">
            <div className="h-full w-full sm:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ROOT_CAUSE_DISTRIBUTION}
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="count"
                  >
                    {ROOT_CAUSE_DISTRIBUTION.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="w-full sm:w-1/2 space-y-2.5">
              {ROOT_CAUSE_DISTRIBUTION.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-foreground">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-muted-foreground">{item.count}</span>
                    <span className="text-foreground font-semibold">({item.pct})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-border/60 text-xs text-muted-foreground">
            Dominant failure mode is unannounced upstream schema drift (47%), resolved via dbt aliasing.
          </div>
        </div>

        {/* Chart 4: dbt Data Contract Validation Pass Rate */}
        <div className="rounded-[6px] border border-border bg-card p-4 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  Data Contract Pass Rate by Model Layer
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Schema and business assertion pass rate across lineage stages
              </p>
            </div>
            <span className="text-[11px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
              98.1% Average
            </span>
          </div>

          <div className="space-y-3 pt-2">
            {CONTRACT_PASS_DATA.map((item) => (
              <div key={item.layer} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-foreground font-medium">{item.layer}</span>
                  <span className="font-mono text-primary font-semibold">{item.pass}% Passed</span>
                </div>
                <div className="h-2 w-full rounded-full bg-secondary overflow-hidden flex">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${item.pass}%` }}
                  />
                  {item.fail > 0 && (
                    <div
                      className="h-full bg-destructive rounded-full"
                      style={{ width: `${item.fail}%` }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
            <span>Air-gapped sandbox guarantees 100% contract pass prior to prod merge.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
