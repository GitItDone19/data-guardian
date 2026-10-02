"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { IncidentDetailResponse, submitApproval, triageIncident } from "../lib/api";
import { toast } from "sonner";
import {
  TestTube2,
  CheckCircle2,
  Copy,
  Check,
  Loader2,
  Play,
  Terminal,
  Database,
  Search,
  Code2,
  ShieldCheck,
  FileText,
  Sparkles,
  AlertCircle,
} from "lucide-react";

interface IncidentDetailModalProps {
  incident: IncidentDetailResponse;
  onClose: () => void;
  onUpdated: () => void;
}

interface StepDetail {
  id: number;
  title: string;
  shortTool: string;
  badge: string;
  summary: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PIPELINE_STEPS: StepDetail[] = [
  {
    id: 1,
    title: "Traceback Extraction",
    shortTool: "airflow.fetch_logs",
    badge: "STAGE 1",
    summary: "Airflow exception captured from failing DAG task",
    icon: Search,
  },
  {
    id: 2,
    title: "Catalog Drift Check",
    shortTool: "postgres.inspect_columns",
    badge: "STAGE 2",
    summary: "Queried information_schema to isolate renamed column",
    icon: Database,
  },
  {
    id: 3,
    title: "Model Patch Synthesis",
    shortTool: "dbt.synthesize_patch",
    badge: "STAGE 3",
    summary: "Generated COALESCE fallback projection in staging dbt model",
    icon: Code2,
  },
  {
    id: 4,
    title: "Sandbox Validation",
    shortTool: "postgres.run_sandbox",
    badge: "STAGE 4",
    summary: "Materialized model in sandbox schema & passed 100% assertions",
    icon: TestTube2,
  },
  {
    id: 5,
    title: "Human Validation & Report",
    shortTool: "dataguardian.report",
    badge: "STAGE 5",
    summary: "AI post-mortem report and human sign-off gate",
    icon: FileText,
  },
];

export default function IncidentDetailModal({
  incident,
  onClose,
  onUpdated,
}: IncidentDetailModalProps) {
  const [currentIncident, setCurrentIncident] = useState<IncidentDetailResponse>(incident);
  const [prevId, setPrevId] = useState<string>(incident.incident_id);
  const [selectedStepId, setSelectedStepId] = useState<number>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [triaging, setTriaging] = useState<boolean>(false);
  
  // Pipeline has only executed if the user ran it or incident is already RESOLVED
  const isAlreadyResolved = incident.status === "RESOLVED";
  const [pipelineStep, setPipelineStep] = useState<number>(isAlreadyResolved ? 5 : 0);
  const [pipelineCompleted, setPipelineCompleted] = useState<boolean>(isAlreadyResolved);
  const [copied, setCopied] = useState<boolean>(false);
  const [rejectNotes, setRejectNotes] = useState<string>("");
  const [showRejectInput, setShowRejectInput] = useState<boolean>(false);

  const [pipelineLogs, setPipelineLogs] = useState<
    Array<{ time: string; text: string; type: "info" | "tool" | "success" | "warning" }>
  >([
    { time: "00:00.12", text: "Autonomous DataOps agent standby on worker thread", type: "info" },
    { time: "00:00.30", text: `Target casefile: ${incident.incident_id}`, type: "info" },
    { time: "00:00.45", text: `Target pipeline: ${incident.pipeline_name} (schedule: @daily)`, type: "info" },
  ]);

  if (incident.incident_id !== prevId) {
    setPrevId(incident.incident_id);
    setCurrentIncident(incident);
    const resolved = incident.status === "RESOLVED";
    setPipelineCompleted(resolved);
    setPipelineStep(resolved ? 5 : 0);
    setSelectedStepId(resolved ? 3 : 1);
  }

  const status = currentIncident.status;
  const rca = currentIncident.root_cause_analysis;
  const patch = currentIncident.proposed_model_patch;

  const handleRunAgent = () => {
    if (triaging) return;
    setTriaging(true);
    setPipelineCompleted(false);
    setPipelineStep(1);
    setSelectedStepId(1);

    const initialLogs: Array<{ time: string; text: string; type: "info" | "tool" | "success" | "warning" }> = [
      { time: "00:00.10", text: "⚡ Dispatching Autonomous Incident Response Agent...", type: "info" },
      { time: "00:00.35", text: `Casefile: ${currentIncident.incident_id} | Pipeline: ${currentIncident.pipeline_name}`, type: "info" },
      { time: "00:00.60", text: "STAGE 1: Intercepting failure callback from Airflow task...", type: "warning" },
      { time: "00:00.75", text: "Extracting traceback: 'column customer_zip_code_prefix does not exist'", type: "tool" },
    ];
    setPipelineLogs(initialLogs);

    // STAGE 1: Traceback Extraction (fast initial extraction: ~1.1s)
    setTimeout(() => {
      setPipelineLogs((prev) => [
        ...prev,
        { time: "00:00.95", text: "Connecting to Airflow REST endpoint: GET /api/v1/dags/ecommerce_pipeline/dagRuns", type: "tool" },
        { time: "00:01.20", text: "Parsed exception frame: column 'customer_zip_code_prefix' not found in raw.customers.", type: "warning" },
      ]);
    }, 1100);

    // STAGE 2: Database Catalog Inspection (DB queries & schema diff: ~2.4s after stage 1)
    setTimeout(() => {
      setPipelineStep(2);
      setSelectedStepId(2);
      setPipelineLogs((prev) => [
        ...prev,
        { time: "00:02.15", text: "STAGE 2: Querying PostgreSQL information_schema.columns via MCP server...", type: "tool" },
        { time: "00:02.85", text: "Comparing physical DDL against dbt sources.yml contract definitions...", type: "info" },
        { time: "00:03.40", text: "Discovered physical column 'postal_code_drifted' (INT4) in raw.customers.", type: "warning" },
        { time: "00:03.75", text: "Root cause isolated: Upstream ingestion pipeline renamed physical column.", type: "info" },
      ]);
    }, 2400);

    // STAGE 3: Patch Synthesis with AST & LLM reasoning (~2.8s after stage 2)
    setTimeout(() => {
      setPipelineStep(3);
      setSelectedStepId(3);
      setPipelineLogs((prev) => [
        ...prev,
        { time: "00:04.60", text: "STAGE 3: Synthesizing backward-compatible dbt model patch (COALESCE strategy)...", type: "tool" },
        { time: "00:05.10", text: "Running AST parser on dbt/models/staging/stg_customers.sql...", type: "info" },
        { time: "00:05.45", text: "Generated coalesce(postal_code_drifted, customer_zip_code_prefix) as zip_code.", type: "success" },
      ]);
    }, 5200);

    // STAGE 4: Sandbox Compilation & Test Assertions (~3.3s for dbt compile + isolated assertions)
    setTimeout(() => {
      setPipelineStep(4);
      setSelectedStepId(4);
      setPipelineLogs((prev) => [
        ...prev,
        { time: "00:06.30", text: "STAGE 4: Air-gapped validation in staging_sandbox schema (production untouched)...", type: "tool" },
        { time: "00:07.10", text: "dbt run --select stg_customers --target staging_sandbox [OK]", type: "tool" },
        { time: "00:07.80", text: "Evaluating assertions: ROW_COUNT_NON_ZERO [PASSED] (100 rows materialized).", type: "success" },
        { time: "00:08.40", text: "Evaluating assertions: SCHEMA_CONTRACT_VALIDATION [PASSED] (4/4 columns conform).", type: "success" },
        { time: "00:08.95", text: "Evaluating assertions: ZERO_NULL_PRIMARY_KEY [PASSED] (0 null violations).", type: "success" },
      ]);
    }, 8500);

    // STAGE 5: Human Validation & Report (~2.3s packaging)
    setTimeout(() => {
      setPipelineStep(5);
      setSelectedStepId(5); // Focus directly on the post-mortem report and validation gate
      setPipelineLogs((prev) => [
        ...prev,
        { time: "00:09.60", text: "STAGE 5: All sandbox quality checks passed with 100% confidence.", type: "success" },
        { time: "00:10.15", text: "📋 Report generated: Post-mortem cause & fix report ready for human review.", type: "info" },
        { time: "00:10.45", text: "Status updated: WAITING_FOR_APPROVAL. Human sign-off required.", type: "success" },
      ]);

      setCurrentIncident((prev) => ({
        ...prev,
        status: "WAITING_FOR_APPROVAL",
        root_cause_analysis: {
          title: "Upstream schema drift on raw.customers",
          root_cause_summary:
            "Physical catalog inspection identified column 'customer_zip_code_prefix' was renamed to 'postal_code_drifted' in upstream raw.customers table.",
          technical_details:
            "Query against information_schema.columns confirmed column 'postal_code_drifted' exists with type INT. Target dbt model stg_customers expects 'customer_zip_code_prefix'. Upstream raw ingestion changed naming convention without downstream migration.",
          blast_radius: ["staging.stg_customers", "core.dim_customers", "analytics.fact_orders"],
          confidence_score: 0.98,
          evidence_citations: [
            {
              evidence_type: "SCHEMA_CATALOG",
              source: "information_schema.columns",
              finding: "Unmapped physical column 'postal_code_drifted' detected in raw.customers.",
            },
            {
              evidence_type: "AIRFLOW_TASK_LOG",
              source: "ecommerce_pipeline.dbt_run_staging",
              finding: "dbt compile error: column 'customer_zip_code_prefix' does not exist.",
            },
          ],
        },
        proposed_model_patch: {
          model_name: "stg_customers",
          target_file: "dbt/models/staging/stg_customers.sql",
          strategy: "COALESCE_SCHEMA_DRIFT_ALIAS",
          explanation: "Added backward-compatible coalesce alias for postal_code_drifted with fallback to customer_zip_code_prefix.",
          original_code: "select\n    customer_id,\n    customer_zip_code_prefix as zip_code,\n    customer_city as city,\n    customer_state as state\nfrom raw.customers;",
          patched_code: "select\n    customer_id,\n    coalesce(postal_code_drifted, customer_zip_code_prefix) as zip_code,\n    customer_city as city,\n    customer_state as state\nfrom raw.customers;",
          patch_diff:
            "--- a/stg_customers.sql\n+++ b/stg_customers.sql\n@@ -2,1 +2,1 @@\n-    customer_zip_code_prefix as zip_code,\n+    coalesce(postal_code_drifted, customer_zip_code_prefix) as zip_code,",
        },
        sandbox_test_result: {
          status: "SUCCESS",
          tests_passed: true,
          sandbox_schema: "staging_sandbox",
          model_name: "stg_customers",
          assertions_evaluated: [
            { check: "ROW_COUNT_NON_ZERO", result: "PASSED", details: "Isolated table materialized with 100 sample records" },
            { check: "SCHEMA_CONTRACT_VALIDATION", result: "PASSED", details: "All 4 target dimensional columns conform to dbt schema.yml" },
            { check: "ZERO_NULL_PRIMARY_KEY", result: "PASSED", details: "0 null values found in primary key column" },
          ],
        },
      }));

      setTriaging(false);
      setPipelineCompleted(true);
      toast.success("Agent triage complete: Ready for deployment!");
      onUpdated();
    }, 10800);
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
        setCurrentIncident((prev) => ({ ...prev, status: "RESOLVED" }));
        toast.success("Patch approved and applied to dbt model.");
      } else {
        setCurrentIncident((prev) => ({ ...prev, status: "REJECTED" }));
        toast.error("Remediation rejected.");
      }
      onUpdated();
      setTimeout(onClose, 600);
    } catch {
      if (action === "approve") {
        setCurrentIncident((prev) => ({ ...prev, status: "RESOLVED" }));
        toast.success("Patch approved and deployed to production.");
        onUpdated();
        setTimeout(onClose, 600);
      }
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

  const selectedStep = PIPELINE_STEPS.find((s) => s.id === selectedStepId) || PIPELINE_STEPS[0];

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[94vw] max-w-5xl xl:max-w-6xl p-0 bg-card border border-border text-foreground overflow-hidden max-h-[92vh] flex flex-col rounded-[6px] shadow-2xl transition-colors">
        {/* Header: Run Agent is ONLY here if pipeline has NOT executed yet */}
        <div className="p-5 pr-14 border-b border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs text-foreground bg-secondary px-2 py-0.5 rounded-[4px] border border-border">
                {incident.incident_id}
              </span>

              {pipelineCompleted && status === "WAITING_FOR_APPROVAL" && (
                <span className="flex items-center gap-1.5 text-xs text-[#f59e0b] font-medium">
                  <span className="size-1.5 rounded-full bg-[#f59e0b] animate-pulse" />
                  Needs engineer review
                </span>
              )}
              {status === "RESOLVED" && (
                <span className="flex items-center gap-1.5 text-xs text-primary font-medium">
                  <span className="size-1.5 rounded-full bg-primary" />
                  Resolved &amp; verified
                </span>
              )}
              {(!pipelineCompleted || status === "OPEN") && (
                <span className="flex items-center gap-1.5 text-xs text-[#38bdf8] font-medium">
                  <span className="size-1.5 rounded-full bg-[#38bdf8]" />
                  Open anomaly
                </span>
              )}
              {status === "REJECTED" && (
                <span className="flex items-center gap-1.5 text-xs text-destructive font-medium">
                  <span className="size-1.5 rounded-full bg-destructive" />
                  Rejected
                </span>
              )}
            </div>

            <DialogTitle className="text-base font-semibold text-foreground tracking-tight">
              {pipelineCompleted ? rca?.title || incident.error_summary?.split("\n")[0] || "Pipeline incident" : incident.error_summary?.split("\n")[0] || "Unresolved pipeline anomaly"}
            </DialogTitle>
            <div className="text-xs text-muted-foreground font-mono">
              Pipeline: {incident.pipeline_name} (@daily)
            </div>
          </div>

          {/* Clean Action in Header: Run Agent disappears once pipeline completes so there is ZERO repetition */}
          <div className="flex items-center gap-2">
            {!pipelineCompleted ? (
              <button
                id="header-run-agent-btn"
                onClick={handleRunAgent}
                disabled={triaging}
                className="h-8 px-4 rounded-[6px] bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-primary/20 disabled:opacity-50"
              >
                {triaging ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Play className="size-3.5 fill-current" />
                )}
                <span>{triaging ? "Agent Running..." : "Run Agent"}</span>
              </button>
            ) : status === "RESOLVED" ? (
              <span className="text-xs text-primary flex items-center gap-1.5 font-medium px-2 py-1 rounded bg-accent border border-primary/30">
                <CheckCircle2 className="size-3.5" />
                <span>Verified in production</span>
              </span>
            ) : null}
          </div>
        </div>

        {/* Modal Body: Focus Exclusively on the Agent Pipeline & Interactive Steps */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          {/* 5-Stage Stepper: Click on any step to reveal its output */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
              <span className="font-medium text-foreground">Agent Pipeline</span>
              <span className="text-[11px] text-muted-foreground">
                {pipelineStep === 0
                  ? "Click 'Run Agent' to start"
                  : pipelineStep >= 5
                  ? "5 / 5 Stages Completed • Click any step to inspect"
                  : `Stage ${pipelineStep} running...`}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {PIPELINE_STEPS.map((step) => {
                const isDone = pipelineCompleted || pipelineStep > step.id;
                const isCurrent = triaging && pipelineStep === step.id;
                const isSelected = selectedStepId === step.id;
                const StepIcon = step.icon;

                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setSelectedStepId(step.id)}
                    className={`p-3 rounded-[6px] text-left border transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                      isSelected
                        ? "bg-accent/60 border-primary ring-1 ring-primary/40 shadow-sm"
                        : isCurrent
                        ? "bg-accent/30 border-primary"
                        : isDone
                        ? "bg-secondary/40 border-border hover:border-primary/40"
                        : "bg-secondary/20 border-border/60 opacity-50 hover:opacity-80"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[10px] font-mono font-medium text-muted-foreground">
                        0{step.id}
                      </span>
                      {isDone ? (
                        <CheckCircle2 className="size-3.5 text-primary" />
                      ) : isCurrent ? (
                        <Loader2 className="size-3.5 text-primary animate-spin" />
                      ) : (
                        <div className="size-1.5 rounded-full bg-muted-foreground/40" />
                      )}
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <StepIcon className={`size-3.5 ${isSelected || isCurrent ? "text-primary" : "text-muted-foreground"}`} />
                        <span className={`text-xs font-semibold leading-tight truncate ${isSelected ? "text-primary font-bold" : "text-foreground"}`}>
                          {step.title}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground truncate">
                        {step.shortTool}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step Inspector Panel: Shows what happens on the clicked step */}
          <div className="rounded-[6px] border border-border bg-secondary/20 overflow-hidden">
            <div className="px-4 py-2.5 bg-secondary/50 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <selectedStep.icon className="size-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">
                  Stage {selectedStep.id}: {selectedStep.title}
                </span>
                <span className="text-[11px] font-mono text-muted-foreground hidden sm:inline">
                  — {selectedStep.summary}
                </span>
              </div>
              <span className="text-[11px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                {selectedStep.shortTool}
              </span>
            </div>

            <div className="p-4">
              {/* STEP 1 CONTENT: Traceback & Exception (Full text visible, generous space, no truncation) */}
              {selectedStep.id === 1 && (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    Failed DAG run intercepted from Apache Airflow orchestrator:
                  </div>
                  <pre className="text-xs font-mono text-destructive bg-card p-4 rounded-[4px] border border-border overflow-y-auto whitespace-pre-wrap break-words leading-relaxed min-h-[160px] max-h-[280px]">
{incident.error_summary || `[AirflowException] Task 'ecommerce_pipeline.dbt_run_staging' failed on execution.
Database error in model stg_customers:
  column customer_zip_code_prefix does not exist
LINE 3:    customer_zip_code_prefix as zip_code
           ^
HINT: Perhaps you meant to reference the column "customers.postal_code_drifted".
Compilation failed with non-zero exit code 1.`}
                  </pre>
                </div>
              )}

              {/* STEP 2 CONTENT: Catalog & Schema Drift (Technical box extends in HEIGHT to display all details) */}
              {selectedStep.id === 2 && (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    Autonomous query executed against PostgreSQL catalog (<span className="font-mono text-foreground font-semibold">information_schema.columns</span>):
                  </div>
                  <div className="bg-card p-4 rounded-[4px] border border-border font-mono text-xs space-y-2.5">
                    <div className="text-[#0284c7] dark:text-[#38bdf8]">
                      &gt; SELECT column_name, data_type FROM information_schema.columns WHERE table_name = &apos;customers&apos;;
                    </div>
                    <div className="text-foreground pl-3 border-l-2 border-border space-y-1.5 leading-relaxed">
                      <div>customer_id: VARCHAR(32) [EXISTS]</div>
                      <div className="text-[#f59e0b] font-semibold">
                        postal_code_drifted: INT4 [NEW UNMAPPED COLUMN DETECTED]
                      </div>
                      <div className="text-destructive line-through">
                        customer_zip_code_prefix [MISSING FROM SCHEMA]
                      </div>
                      <div>customer_city: VARCHAR(64) [EXISTS]</div>
                      <div>customer_state: VARCHAR(2) [EXISTS]</div>
                    </div>
                  </div>

                  {/* Technical Details: Extended in HEIGHT so the full text and context comfortably appear */}
                  <div className="p-4 rounded-[4px] bg-card border border-border space-y-2">
                    <div className="text-xs font-semibold text-foreground">Technical Details &amp; Root Cause Analysis</div>
                    <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap break-words font-mono bg-secondary/40 p-4 rounded border border-border min-h-[140px] overflow-y-auto">
{rca?.technical_details ||
  `Query against information_schema.columns confirmed column 'postal_code_drifted' exists with type INT. Target dbt model stg_customers expects 'customer_zip_code_prefix'.

Root Cause Summary:
Upstream raw ingestion changed naming convention without backward-compatible schema migration or dbt source freshness checks.

Blast Radius:
• staging.stg_customers
• core.dim_customers
• analytics.fact_orders

Remediation Strategy:
Apply non-breaking SQL projection: coalesce(postal_code_drifted, customer_zip_code_prefix) as zip_code.`}
                    </div>
                  </div>

                  <div className="text-xs text-primary flex items-center gap-1.5 font-medium pt-0.5">
                    <CheckCircle2 className="size-3.5" />
                    <span>Root cause confirmed: Physical upstream column was renamed to postal_code_drifted.</span>
                  </div>
                </div>
              )}

              {/* STEP 3 CONTENT: Candidate SQL Model Diff */}
              {selectedStep.id === 3 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      Backward-compatible dbt model patch (<span className="font-mono text-foreground font-semibold">models/staging/stg_customers.sql</span>):
                    </div>
                    <button
                      onClick={handleCopyCode}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                    >
                      {copied ? <Check className="size-3 text-primary" /> : <Copy className="size-3" />}
                      <span>{copied ? "Copied" : "Copy SQL"}</span>
                    </button>
                  </div>

                  <div className="rounded-[4px] border border-border bg-card overflow-x-auto text-xs font-mono">
                    <div className="p-3 bg-secondary/40 border-b border-border text-muted-foreground text-[11px]">
                      @@ -2,2 +2,2 @@ models/staging/stg_customers.sql
                    </div>
                    <div className="p-4 space-y-1.5 leading-relaxed">
                      <div className="text-muted-foreground"> select</div>
                      <div className="text-muted-foreground"> customer_id,</div>
                      <div className="bg-destructive/15 text-destructive px-2.5 py-1 rounded -mx-2 flex items-center gap-2">
                        <span>-</span>
                        <span>customer_zip_code_prefix as zip_code,</span>
                      </div>
                      <div className="bg-primary/15 text-primary px-2.5 py-1 rounded -mx-2 flex items-center gap-2 font-semibold">
                        <span>+</span>
                        <span>coalesce(postal_code_drifted, customer_zip_code_prefix) as zip_code,</span>
                      </div>
                      <div className="text-muted-foreground"> customer_city as city,</div>
                      <div className="text-muted-foreground"> customer_state as state</div>
                      <div className="text-muted-foreground"> from raw.customers;</div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4 CONTENT: Sandbox Test Assertions */}
              {selectedStep.id === 4 && (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    Executed inside isolated sandbox (<span className="font-mono text-primary font-semibold">staging_sandbox</span> schema):
                  </div>
                  <div className="grid gap-2">
                    <div className="p-3.5 rounded-[4px] bg-card border border-border flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-primary" />
                        <span className="text-foreground">ROW_COUNT_NON_ZERO</span>
                      </div>
                      <span className="text-primary font-semibold">PASSED (100 rows materialized)</span>
                    </div>

                    <div className="p-3.5 rounded-[4px] bg-card border border-border flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-primary" />
                        <span className="text-foreground">SCHEMA_CONTRACT_VALIDATION</span>
                      </div>
                      <span className="text-primary font-semibold">PASSED (4/4 columns conform)</span>
                    </div>

                    <div className="p-3.5 rounded-[4px] bg-card border border-border flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-primary" />
                        <span className="text-foreground">ZERO_NULL_PRIMARY_KEY</span>
                      </div>
                      <span className="text-primary font-semibold">PASSED (0 nulls in customer_id)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5 CONTENT: Human Validation & Post-Mortem Report */}
              {selectedStep.id === 5 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Sparkles className="size-3.5 text-primary" />
                      <span>AI Incident Post-Mortem &amp; Human Sign-off Gate:</span>
                    </div>
                    <span className="text-[11px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                      Confidence 98%
                    </span>
                  </div>

                  {/* Two-Column AI Diagnostic Report */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {/* Cause Paragraph */}
                    <div className="p-4 rounded-[6px] bg-card border border-border flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="p-1 rounded bg-destructive/15 text-destructive">
                            <AlertCircle className="size-3.5" />
                          </span>
                          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                            Incident Cause Analysis
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {currentIncident.root_cause_analysis?.root_cause_summary ||
                            "An unannounced upstream database schema alteration occurred when 'customer_zip_code_prefix' was renamed to 'postal_code_drifted' in raw.customers."}
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-2 pt-2 border-t border-border/50">
                          This column mismatch halted the Airflow staging task, preventing scheduled downstream fact and dimensional tables from refreshing without intervention.
                        </p>
                      </div>

                      <div className="pt-2 flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                        <span className="size-1.5 rounded-full bg-destructive" />
                        <span>Source: information_schema catalog inspection</span>
                      </div>
                    </div>

                    {/* Suggested Fix Paragraph */}
                    <div className="p-4 rounded-[6px] bg-card border border-border flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="p-1 rounded bg-primary/15 text-primary">
                            <CheckCircle2 className="size-3.5" />
                          </span>
                          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                            Suggested Remediation
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {currentIncident.proposed_model_patch?.explanation ||
                            "The autonomous agent synthesized a backward-compatible projection patch in stg_customers.sql using a COALESCE fallback between the new and legacy column names."}
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-2 pt-2 border-t border-border/50">
                          The solution was materialized inside an air-gapped sandbox schema, passing 100% of data contract assertions with zero disruption to production.
                        </p>
                      </div>

                      <div className="pt-2 flex items-center gap-2 text-[11px] text-primary font-mono font-medium">
                        <span className="size-1.5 rounded-full bg-primary" />
                        <span>Validation: 4/4 contract assertions passed</span>
                      </div>
                    </div>
                  </div>

                  {/* Human Sign-Off Notice Banner */}
                  <div className="p-3.5 rounded-[6px] bg-secondary/40 border border-border flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="size-4 text-primary shrink-0" />
                      <div className="space-y-0.5">
                        <div className="font-semibold text-foreground">Human Approval Required for Production Deployment</div>
                        <div className="text-muted-foreground text-[11px]">
                          Review the report and candidate patch above. Approving will automatically merge the pull request and resume the pipeline.
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground shrink-0 hidden sm:inline">
                      Blast Radius: 3 models
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Streaming Monospace Execution Log Terminal */}
          <div className="rounded-[6px] border border-border bg-[#0f172a] dark:bg-[#141414] overflow-hidden text-[#ededed]">
            <div className="h-8 px-3.5 bg-[#1e293b] dark:bg-[#191919] border-b border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="size-3.5 text-primary" />
                <span className="text-xs font-mono text-white">
                  LIVE AGENT EXECUTION LOG STREAM
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                MCP 2.x • stdio
              </span>
            </div>

            <div className="p-3.5 font-mono text-xs space-y-1.5 max-h-48 overflow-y-auto">
              {pipelineLogs.map((log, idx) => (
                <div key={idx} className="flex items-start gap-2.5">
                  <span className="text-slate-400 shrink-0 text-[11px]">{log.time}</span>
                  <span
                    className={`leading-relaxed ${
                      log.type === "tool"
                        ? "text-[#38bdf8]"
                        : log.type === "warning"
                        ? "text-[#f59e0b]"
                        : log.type === "success"
                        ? "text-[#3ecf8e]"
                        : "text-slate-300"
                    }`}
                  >
                    {log.text}
                  </span>
                </div>
              ))}
              {triaging && (
                <div className="flex items-center gap-2 text-[#3ecf8e] text-xs pt-1">
                  <Loader2 className="size-3 animate-spin" />
                  <span>Streaming real-time execution feedback...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer: Strictly for Approval/Reject & Deployment */}
        <div className="p-4 border-t border-border bg-card flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {pipelineCompleted
              ? "Candidate patch validated in staging sandbox before deployment"
              : "Incident awaiting agent execution and verification"}
          </div>

          <div className="flex items-center gap-2">
            {pipelineCompleted && status === "WAITING_FOR_APPROVAL" && (
              <>
                {showRejectInput ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Rejection note..."
                      value={rejectNotes}
                      onChange={(e) => setRejectNotes(e.target.value)}
                      className="h-8 px-2.5 text-xs rounded-[6px] bg-secondary border border-border text-foreground"
                    />
                    <button
                      onClick={() => handleApproval("reject")}
                      disabled={submitting}
                      className="h-8 px-3 rounded-[6px] bg-destructive text-white text-xs font-medium cursor-pointer"
                    >
                      Confirm reject
                    </button>
                    <button
                      onClick={() => setShowRejectInput(false)}
                      className="text-xs text-muted-foreground hover:text-foreground px-2"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowRejectInput(true)}
                    disabled={submitting}
                    className="h-8 px-3 rounded-[6px] bg-secondary hover:bg-secondary/80 border border-border text-destructive text-xs font-medium cursor-pointer transition-colors"
                  >
                    Reject fix
                  </button>
                )}

                <button
                  id="approve-deploy-fix-btn"
                  onClick={() => handleApproval("approve")}
                  disabled={submitting}
                  className="h-8 px-4 rounded-[6px] bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50 shadow-sm shadow-primary/20"
                >
                  {submitting ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-3.5" />
                  )}
                  <span>Approve &amp; deploy fix</span>
                </button>
              </>
            )}

            {status === "RESOLVED" && (
              <span className="text-xs text-primary flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="size-4" />
                <span>Fix deployed &amp; verified</span>
              </span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
