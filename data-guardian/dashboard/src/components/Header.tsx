"use client";

import React, { useState } from "react";
import { Shield, Activity, Play, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { triggerSimulation } from "../lib/api";

interface HeaderProps {
  apiOnline: boolean;
  onRefresh: () => void;
}

export default function Header({ apiOnline, onRefresh }: HeaderProps) {
  const [loadingScenario, setLoadingScenario] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const handleSimulate = async (scenario: "null_spike" | "schema_drift" | "duplicates" | "reset") => {
    setLoadingScenario(scenario);
    try {
      const res = await triggerSimulation(scenario);
      setNotification(`✓ ${res.message}`);
      onRefresh();
    } catch {
      setNotification(`✕ Simulation error. Ensure FastAPI is running on :8000`);
    } finally {
      setLoadingScenario(null);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  return (
    <header className="glass-panel px-6 py-4 mb-8 flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800">
      {/* Brand & Connectivity */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-lg shadow-cyan-500/10">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white">DataGuardian</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-800 text-cyan-400 font-medium">
              Autonomous Agent
            </span>
          </div>
          <p className="text-xs text-slate-400">Agentic DataOps & Autonomous Incident Remediation</p>
        </div>
      </div>

      {/* Action Controls & Simulation Injections */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span>Backend API:</span>
          {apiOnline ? (
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Online (:8000)
            </span>
          ) : (
            <span className="flex items-center gap-1 text-rose-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              Offline
            </span>
          )}
        </div>

        <div className="h-5 w-[1px] bg-slate-800 hidden md:block"></div>

        {/* Quick Simulation Buttons */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-400 mr-1 hidden lg:inline">Simulate:</span>
          <button
            onClick={() => handleSimulate("null_spike")}
            disabled={loadingScenario !== null}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 transition-colors disabled:opacity-50"
            title="Inject ~45% NULL values into raw.orders.order_status"
          >
            <AlertTriangle className="w-3 h-3" />
            <span>Null Spike</span>
          </button>

          <button
            onClick={() => handleSimulate("schema_drift")}
            disabled={loadingScenario !== null}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 transition-colors disabled:opacity-50"
            title="Inject schema drift into raw.customers (postal_code_drifted)"
          >
            <Play className="w-3 h-3" />
            <span>Schema Drift</span>
          </button>

          <button
            onClick={() => handleSimulate("duplicates")}
            disabled={loadingScenario !== null}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 transition-colors disabled:opacity-50"
            title="Inject duplicate primary keys into raw.payments"
          >
            <Play className="w-3 h-3" />
            <span>Duplicates</span>
          </button>

          <button
            onClick={() => handleSimulate("reset")}
            disabled={loadingScenario !== null}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors disabled:opacity-50"
            title="Restore warehouse to 100% healthy baseline data"
          >
            <RefreshCw className={`w-3 h-3 ${loadingScenario === "reset" ? "animate-spin" : ""}`} />
            <span>Reset DB</span>
          </button>
        </div>
      </div>

      {/* Floating Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          <span>{notification}</span>
        </div>
      )}
    </header>
  );
}
