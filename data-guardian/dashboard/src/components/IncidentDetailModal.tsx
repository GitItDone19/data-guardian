"use client";

import React, { useState } from "react";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  FileCode2,
  TestTube2,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Terminal,
} from "lucide-react";
import { IncidentDetailResponse, submitApproval, triageIncident } from "../lib/api";

interface IncidentDetailModalProps {
  incident: IncidentDetailResponse;
  onClose: () => void;
  onUpdated: () => void;
}

export default function IncidentDetailModal({
  incident,
  onClose,
  onUpdated,
}: IncidentDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"rca" | "diff" | "sandbox" | "audit">("rca");
  const [submitting, setSubmitting] = useState(false);
  const [triaging, setTriaging] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const status = incident.status;
  const rca = incident.root_cause_analysis;
  const patch = incident.proposed_model_patch;
  const sandbox = incident.sandbox_test_result;

  const handleTriage = async () => {
    setTriaging(true);
    try {
      await triageIncident(incident.incident_id);
      onUpdated();
    } catch {
      setActionMessage("✕ Failed to run agent triage. Ensure backend is running.");
    } finally {
      setTriaging(false);
    }
  };

  const handleApproval = async (action: "approve" | "reject") => {
    setSubmitting(true);
    setActionMessage(null);
    try {
      const res = await submitApproval(incident.incident_id, action);
      setActionMessage(res.message);
      onUpdated();
    } catch {
      setActionMessage("✕ Error communicating with backend approval gate.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-panel w-full max-w-4xl max-h-[90vh] flex flex-col bg-slate-900/95 border-slate-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {incident.incident_id}
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    status === "RESOLVED"
                      ? "bg-emerald-950/80 border border-emerald-700 text-emerald-300"
                      : status === "WAITING_FOR_APPROVAL"
                      ? "bg-amber-950/80 border border-amber-700 text-amber-300 animate-pulse"
                      : status === "REJECTED"
                      ? "bg-rose-950/80 border border-rose-700 text-rose-300"
                      : "bg-cyan-950/80 border border-cyan-700 text-cyan-300"
                  }`}
                >
                  {status}
                </span>
              </div>
              <p className="text-sm font-semibold text-white mt-1">
                {rca?.title || incident.error_summary || "Pipeline Failure Incident"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-6">
          <button
            onClick={() => setActiveTab("rca")}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === "rca"
                ? "border-cyan-400 text-cyan-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Root Cause Analysis (RCA)
          </button>

          <button
            onClick={() => setActiveTab("diff")}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === "diff"
                ? "border-cyan-400 text-cyan-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            Code Patch Diff
            {patch && (
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("sandbox")}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === "sandbox"
                ? "border-cyan-400 text-cyan-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <TestTube2 className="w-3.5 h-3.5" />
            Sandbox Verification
            {sandbox?.tests_passed && (
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: RCA */}
          {activeTab === "rca" && (
            <div className="space-y-4">
              {rca ? (
                <>
                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                        Root Cause Summary
                      </span>
                      {rca.confidence_score && (
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300">
                          Confidence: {Math.round(rca.confidence_score * 100)}%
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed">
                      {rca.root_cause_summary}
                    </p>
                  </div>

                  {rca.technical_details && (
                    <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                        Technical Breakdown
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed font-mono">
                        {rca.technical_details}
                      </p>
                    </div>
                  )}

                  {rca.evidence_citations && rca.evidence_citations.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Empirical Evidence Citations
                      </span>
                      <div className="grid gap-2">
                        {rca.evidence_citations.map((cite, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-lg bg-slate-950/50 border border-slate-800 text-xs flex items-start gap-3"
                          >
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-400 font-mono font-medium">
                              {cite.evidence_type}
                            </span>
                            <div>
                              <span className="font-semibold text-slate-200">{cite.source}: </span>
                              <span className="text-slate-400">{cite.finding}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {rca.blast_radius && rca.blast_radius.length > 0 && (
                    <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800">
                      <span className="text-xs font-semibold text-slate-400 block mb-1">
                        Blast Radius (Downstream Dependencies)
                      </span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {rca.blast_radius.map((model, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono"
                          >
                            {model}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-10 space-y-3">
                  <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
                  <p className="text-sm text-slate-300">
                    This incident has not been triaged by the LangGraph agent yet.
                  </p>
                  <button
                    onClick={handleTriage}
                    disabled={triaging}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg transition-colors"
                  >
                    {triaging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Terminal className="w-4 h-4" />}
                    <span>Run AI Agent Triage & Analysis</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CODE DIFF */}
          {activeTab === "diff" && (
            <div className="space-y-4">
              {patch ? (
                <>
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono">
                    <span className="text-cyan-400 font-semibold">{patch.target_file}</span>
                    <span className="text-slate-400">Strategy: {patch.strategy}</span>
                  </div>

                  <p className="text-xs text-slate-300 italic">{patch.explanation}</p>

                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs overflow-x-auto">
                    <pre className="space-y-0.5">
                      {patch.patch_diff.split("\n").map((line, idx) => {
                        let lineClass = "text-slate-400";
                        if (line.startsWith("+") && !line.startsWith("+++")) {
                          lineClass = "diff-line-add px-2 py-0.5 rounded-sm block";
                        } else if (line.startsWith("-") && !line.startsWith("---")) {
                          lineClass = "diff-line-del px-2 py-0.5 rounded-sm block";
                        } else if (line.startsWith("@@") || line.startsWith("---") || line.startsWith("+++")) {
                          lineClass = "diff-line-header px-2 py-0.5 block";
                        }
                        return (
                          <span key={idx} className={lineClass}>
                            {line || " "}
                          </span>
                        );
                      })}
                    </pre>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No patch generated yet. Run Triage first.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SANDBOX TEST */}
          {activeTab === "sandbox" && (
            <div className="space-y-4">
              {sandbox ? (
                <>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <div>
                      <span className="text-xs font-semibold text-slate-400 uppercase">Target Schema</span>
                      <p className="text-sm font-mono text-cyan-400 font-bold">{sandbox.sandbox_schema}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold text-slate-400 uppercase">Validation Outcome</span>
                      <p
                        className={`text-sm font-bold flex items-center gap-1.5 justify-end ${
                          sandbox.tests_passed ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {sandbox.tests_passed ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" /> Passed 100% Assertions
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-4 h-4" /> Tests Failed
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Evaluated Sandbox Assertions
                    </span>
                    <div className="grid gap-2">
                      {sandbox.assertions_evaluated.map((assertion, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-lg bg-slate-950/50 border border-slate-800 text-xs font-mono"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                assertion.result === "PASSED" ? "bg-emerald-400" : "bg-rose-500"
                              }`}
                            ></span>
                            <span className="text-slate-200">{assertion.check}</span>
                          </div>
                          <span className="text-slate-400">{assertion.details}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-slate-400 text-xs">
                  Sandbox test execution pending.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action & Human in the Loop Approval Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            {actionMessage && <span className="text-cyan-400 font-medium">{actionMessage}</span>}
          </div>

          <div className="flex items-center gap-3">
            {status === "WAITING_FOR_APPROVAL" && (
              <>
                <button
                  onClick={() => handleApproval("reject")}
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>Reject Plan</span>
                </button>

                <button
                  onClick={() => handleApproval("approve")}
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  <span>Approve & Deploy Fix</span>
                </button>
              </>
            )}

            {status === "OPEN" && (
              <button
                onClick={handleTriage}
                disabled={triaging}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-all disabled:opacity-50"
              >
                {triaging ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                <span>Start Autonomous Triage</span>
              </button>
            )}

            {status === "RESOLVED" && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-800">
                <CheckCircle2 className="w-4 h-4" />
                <span>Fix Successfully Applied & Verified</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
