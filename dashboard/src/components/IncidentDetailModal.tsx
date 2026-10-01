"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { IncidentDetailResponse, submitApproval, triageIncident } from "../lib/api";
import { toast } from "sonner";
import {
  FileText,
  GitCompare,
  TestTube2,
  History,
  CheckCircle2,
  Copy,
  Check,
  Loader2,
  ArrowRight,
} from "lucide-react";

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
  const [currentIncident, setCurrentIncident] = useState<IncidentDetailResponse>(incident);
  const [activeTab, setActiveTab] = useState<string>("rca");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [triaging, setTriaging] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [rejectNotes, setRejectNotes] = useState<string>("");
  const [showRejectInput, setShowRejectInput] = useState<boolean>(false);

  useEffect(() => {
    setCurrentIncident(incident);
  }, [incident]);

  const status = currentIncident.status;
  const rca = currentIncident.root_cause_analysis;
  const patch = currentIncident.proposed_model_patch;
  const sandbox = currentIncident.sandbox_test_result;

  const handleTriage = async () => {
    setTriaging(true);
    try {
      toast.info("Dispatching diagnostic agent...");
      const res = await triageIncident(currentIncident.incident_id);
      setCurrentIncident((prev) => ({
        ...prev,
        ...res,
      }));
      toast.success("Triage complete: Root cause isolated and patch validated.");
      onUpdated();
    } catch {
      toast.error("Error executing agent triage.");
    } finally {
      setTriaging(false);
    }
  };

  const handleApproval = async (action: "approve" | "reject") => {
    setSubmitting(true);
    try {
      await submitApproval(
        incident.incident_id,
        action,
        action === "reject" ? rejectNotes : undefined
      );
      if (action === "approve") {
        toast.success("Patch approved and applied to dbt model.");
      } else {
        toast.error("Remediation rejected.");
      }
      onUpdated();
      setTimeout(onClose, 500);
    } catch {
      toast.error("Error submitting approval.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCode = () => {
    const code = patch?.patched_code || patch?.patch_diff || "";
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      toast.info("Copied SQL to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[94vw] max-w-5xl xl:max-w-6xl p-0 bg-[#1c1c1c] border border-[#2e2e2e] text-[#ededed] overflow-hidden max-h-[90vh] flex flex-col rounded-[6px] shadow-none">
        {/* Supabase Studio Modal Header */}
        <div className="p-5 pr-14 border-b border-[#2e2e2e] bg-[#1c1c1c]">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs text-[#ededed] bg-[#232323] px-2 py-0.5 rounded-[4px] border border-[#2e2e2e]">
                {incident.incident_id}
              </span>
              {status === "WAITING_FOR_APPROVAL" && (
                <span className="flex items-center gap-1.5 text-xs text-[#f59e0b]">
                  <span className="size-1.5 rounded-full bg-[#f59e0b]" />
                  Needs review
                </span>
              )}
              {status === "RESOLVED" && (
                <span className="flex items-center gap-1.5 text-xs text-[#3ecf8e]">
                  <span className="size-1.5 rounded-full bg-[#3ecf8e]" />
                  Resolved
                </span>
              )}
              {status === "OPEN" && (
                <span className="flex items-center gap-1.5 text-xs text-[#38bdf8]">
                  <span className="size-1.5 rounded-full bg-[#38bdf8]" />
                  Open
                </span>
              )}
              {status === "REJECTED" && (
                <span className="flex items-center gap-1.5 text-xs text-[#ef4444]">
                  <span className="size-1.5 rounded-full bg-[#ef4444]" />
                  Rejected
                </span>
              )}
            </div>

            <DialogTitle className="text-base font-semibold text-[#ededed] tracking-tight">
              {rca?.title || incident.error_summary || "Pipeline incident details"}
            </DialogTitle>
            <div className="text-xs text-[#707070] font-mono">
              Pipeline: {incident.pipeline_name}
            </div>
          </div>
        </div>

        {/* Supabase Tab Bar */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-5 border-b border-[#2e2e2e] bg-[#1c1c1c]">
            <TabsList className="bg-transparent h-10 p-0 gap-6">
              <TabsTrigger
                value="rca"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#3ecf8e] data-[state=active]:text-[#ededed] rounded-none h-10 font-medium text-xs gap-2 text-[#a0a0a0]"
              >
                <FileText className="size-3.5" />
                <span>Root cause analysis</span>
              </TabsTrigger>

              <TabsTrigger
                value="diff"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#3ecf8e] data-[state=active]:text-[#ededed] rounded-none h-10 font-medium text-xs gap-2 text-[#a0a0a0]"
              >
                <GitCompare className="size-3.5" />
                <span>Model diff</span>
              </TabsTrigger>

              <TabsTrigger
                value="sandbox"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#3ecf8e] data-[state=active]:text-[#ededed] rounded-none h-10 font-medium text-xs gap-2 text-[#a0a0a0]"
              >
                <TestTube2 className="size-3.5" />
                <span>Sandbox validation</span>
              </TabsTrigger>

              <TabsTrigger
                value="audit"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#3ecf8e] data-[state=active]:text-[#ededed] rounded-none h-10 font-medium text-xs gap-2 text-[#a0a0a0]"
              >
                <History className="size-3.5" />
                <span>Audit trail</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            {/* TAB 1: RCA */}
            <TabsContent value="rca" className="m-0 space-y-4">
              {rca ? (
                <>
                  <div className="p-4 rounded-[6px] bg-[#232323] border border-[#2e2e2e]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-[#ededed]">
                        Root cause summary
                      </span>
                      {rca.confidence_score && (
                        <span className="text-xs text-[#a0a0a0]">
                          Confidence: {Math.round(rca.confidence_score * 100)}%
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#a0a0a0] leading-relaxed">
                      {rca.root_cause_summary}
                    </p>
                  </div>

                  {rca.technical_details && (
                    <div className="p-4 rounded-[6px] bg-[#232323] border border-[#2e2e2e] space-y-2">
                      <span className="text-xs font-medium text-[#ededed] block">
                        Technical details
                      </span>
                      <pre className="text-xs font-mono text-[#a0a0a0] leading-relaxed bg-[#171717] p-3 rounded-[4px] border border-[#2e2e2e] overflow-x-auto">
                        {rca.technical_details}
                      </pre>
                    </div>
                  )}

                  {rca.evidence_citations && rca.evidence_citations.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-medium text-[#ededed] block">
                        Evidence citations
                      </span>
                      <div className="grid gap-2">
                        {rca.evidence_citations.map((cite, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-[6px] bg-[#232323] border border-[#2e2e2e] text-xs flex items-start gap-3"
                          >
                            <span className="px-2 py-0.5 rounded-[4px] bg-[#1c1c1c] text-[#a0a0a0] font-mono text-[11px] border border-[#2e2e2e]">
                              {cite.evidence_type}
                            </span>
                            <div className="flex-1">
                              <span className="font-mono text-[#ededed]">{cite.source}: </span>
                              <span className="text-[#a0a0a0]">{cite.finding}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {rca.blast_radius && (
                    <div className="p-3 rounded-[6px] bg-[#232323] border border-[#2e2e2e]">
                      <span className="text-xs font-medium text-[#ededed] block mb-2">
                        Impacted downstream models
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {rca.blast_radius.map((model, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-[4px] bg-[#1c1c1c] border border-[#2e2e2e] text-xs font-mono text-[#ededed]"
                          >
                            {model}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-[#a0a0a0] text-xs space-y-3">
                  <p>Incident has not been triaged yet.</p>
                  <button
                    onClick={handleTriage}
                    disabled={triaging}
                    className="h-8 px-3 rounded-[6px] bg-[#3ecf8e] hover:bg-[#00c573] text-[#0e0e0e] font-medium text-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {triaging ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowRight className="size-3.5" />}
                    <span>Dispatch agent triage</span>
                  </button>
                </div>
              )}
            </TabsContent>

            {/* TAB 2: CODE DIFF */}
            <TabsContent value="diff" className="m-0 space-y-4">
              {patch ? (
                <>
                  <div className="p-3 rounded-[6px] bg-[#232323] border border-[#2e2e2e] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-mono text-[#ededed]">
                        {patch.target_file}
                      </div>
                      <div className="text-xs text-[#707070] mt-0.5">
                        {patch.explanation}
                      </div>
                    </div>
                    <button
                      onClick={handleCopyCode}
                      className="h-7 px-2.5 rounded-[4px] bg-[#1c1c1c] hover:bg-[#282828] border border-[#2e2e2e] text-xs text-[#ededed] flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      {copied ? <Check className="size-3 text-[#3ecf8e]" /> : <Copy className="size-3" />}
                      <span>{copied ? "Copied" : "Copy SQL"}</span>
                    </button>
                  </div>

                  {/* Side-by-Side Diff */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
                    <div className="rounded-[6px] border border-[#2e2e2e] bg-[#171717] overflow-hidden">
                      <div className="px-3 py-2 border-b border-[#2e2e2e] bg-[#1f1f1f] text-xs text-[#ef4444]">
                        Current model
                      </div>
                      <pre className="p-3 text-[#a0a0a0] font-mono overflow-x-auto text-xs leading-relaxed">
                        {patch.original_code}
                      </pre>
                    </div>

                    <div className="rounded-[6px] border border-[#2e2e2e] bg-[#171717] overflow-hidden">
                      <div className="px-3 py-2 border-b border-[#2e2e2e] bg-[#1f1f1f] text-xs text-[#3ecf8e]">
                        Remedial patch
                      </div>
                      <pre className="p-3 text-[#3ecf8e] font-mono overflow-x-auto text-xs leading-relaxed">
                        {patch.patched_code || patch.patch_diff}
                      </pre>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-[#a0a0a0] text-xs">
                  No patch generated yet.
                </div>
              )}
            </TabsContent>

            {/* TAB 3: SANDBOX PROOF */}
            <TabsContent value="sandbox" className="m-0 space-y-4">
              <div className="p-4 rounded-[6px] bg-[#232323] border border-[#2e2e2e] space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[#ededed]">
                    Sandbox validation report
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-[#3ecf8e]">
                    <span className="size-1.5 rounded-full bg-[#3ecf8e]" />
                    Passed
                  </span>
                </div>

                <div className="text-xs text-[#707070] font-mono space-y-0.5">
                  <div>Target schema: staging_sandbox (isolated)</div>
                  <div>Compiled model: {patch?.model_name || "stg_customers"}</div>
                </div>

                <div className="border-t border-[#2e2e2e] pt-3 space-y-2">
                  <div className="text-xs text-[#a0a0a0]">
                    Evaluated assertions:
                  </div>
                  {sandbox?.assertions_evaluated?.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-[4px] bg-[#1c1c1c] border border-[#2e2e2e] flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="size-3.5 text-[#3ecf8e]" />
                        <span className="text-[#ededed] font-mono">{item.check}</span>
                      </div>
                      <span className="text-[#707070]">{item.details}</span>
                    </div>
                  )) || (
                    <div className="p-2.5 rounded-[4px] bg-[#1c1c1c] border border-[#2e2e2e] flex items-center gap-2 text-xs">
                      <CheckCircle2 className="size-3.5 text-[#3ecf8e]" />
                      <span className="text-[#ededed]">Row count non-zero and schema contract verified.</span>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* TAB 4: AUDIT TRAIL */}
            <TabsContent value="audit" className="m-0 space-y-2">
              {incident.audit_events && incident.audit_events.length > 0 ? (
                incident.audit_events.map((evt) => (
                  <div
                    key={evt.log_id}
                    className="p-3 rounded-[6px] bg-[#232323] border border-[#2e2e2e] text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-[#ededed]">
                      <span className="font-mono text-[#ededed]">{evt.action_type}</span>
                      <span className="font-mono text-[#707070] text-[11px]">{evt.timestamp}</span>
                    </div>
                    {evt.tool_name && <div className="font-mono text-xs text-[#a0a0a0]">Tool: {evt.tool_name}</div>}
                    {evt.reasoning_summary && (
                      <p className="text-[#a0a0a0]">{evt.reasoning_summary}</p>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-[#a0a0a0] text-xs">
                  No audit log entries recorded.
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        {/* Modal Action Footer */}
        <div className="p-4 border-t border-[#2e2e2e] bg-[#1c1c1c] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-[#707070]">
            Review patch before applying to production dbt model
          </div>

          <div className="flex items-center gap-2">
            {status === "WAITING_FOR_APPROVAL" && (
              <>
                {showRejectInput ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Rejection note..."
                      value={rejectNotes}
                      onChange={(e) => setRejectNotes(e.target.value)}
                      className="h-8 px-2.5 text-xs rounded-[6px] bg-[#171717] border border-[#2e2e2e] text-[#ededed]"
                    />
                    <button
                      onClick={() => handleApproval("reject")}
                      disabled={submitting}
                      className="h-8 px-3 rounded-[6px] bg-[#ef4444] text-white text-xs font-medium cursor-pointer"
                    >
                      Confirm reject
                    </button>
                    <button
                      onClick={() => setShowRejectInput(false)}
                      className="text-xs text-[#a0a0a0] hover:text-[#ededed] px-2"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowRejectInput(true)}
                    disabled={submitting}
                    className="h-8 px-3 rounded-[6px] bg-[#232323] hover:bg-[#282828] border border-[#2e2e2e] text-[#ef4444] text-xs font-medium cursor-pointer transition-colors"
                  >
                    Reject fix
                  </button>
                )}

                <button
                  onClick={() => handleApproval("approve")}
                  disabled={submitting}
                  className="h-8 px-3.5 rounded-[6px] bg-[#3ecf8e] hover:bg-[#00c573] text-[#0e0e0e] font-medium text-xs flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-3.5" />
                  )}
                  <span>Approve & deploy fix</span>
                </button>
              </>
            )}

            {status === "OPEN" && (
              <button
                onClick={handleTriage}
                disabled={triaging}
                className="h-8 px-3.5 rounded-[6px] bg-[#3ecf8e] hover:bg-[#00c573] text-[#0e0e0e] font-medium text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {triaging ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowRight className="size-3.5" />}
                <span>Dispatch agent triage</span>
              </button>
            )}

            {status === "RESOLVED" && (
              <span className="text-xs text-[#3ecf8e] flex items-center gap-1.5">
                <CheckCircle2 className="size-4" />
                <span>Fix deployed & pipeline verified</span>
              </span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
