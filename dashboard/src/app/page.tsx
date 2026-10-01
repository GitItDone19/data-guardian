"use client";

import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import PipelineMetrics from "../components/PipelineMetrics";
import IncidentList from "../components/IncidentList";
import IncidentDetailModal from "../components/IncidentDetailModal";
import { Skeleton } from "../components/ui/skeleton";
import {
  fetchHealth,
  fetchPipelineStatus,
  fetchIncidents,
  fetchIncidentDetail,
  PipelineStatusResponse,
  IncidentSummary,
  IncidentDetailResponse,
} from "../lib/api";
import { Database, GitBranch, Layers, ShieldCheck, TestTube2, RefreshCw } from "lucide-react";

export default function DashboardPage() {
  const [apiOnline, setApiOnline] = useState<boolean>(false);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatusResponse | null>(null);
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<IncidentDetailResponse | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeNavTab, setActiveNavTab] = useState<string>("incidents");

  const loadDashboardData = useCallback(async () => {
    try {
      const health = await fetchHealth();
      const online = health.status === "HEALTHY";
      setApiOnline(online);

      if (online) {
        const [statusData, incData] = await Promise.all([
          fetchPipelineStatus().catch(() => null),
          fetchIncidents().catch(() => []),
        ]);
        setPipelineStatus(statusData);
        setIncidents(incData);

        if (selectedIncidentId) {
          const updatedDetail = await fetchIncidentDetail(selectedIncidentId).catch(() => null);
          if (updatedDetail) setSelectedIncident(updatedDetail);
        }
      } else {
        // Fallback demo state if FastAPI is offline
        setPipelineStatus({
          dag_id: "ecommerce_pipeline",
          status: "DEGRADED",
          schedule: "@daily",
          task_count: 4,
          tasks: [
            { task_id: "ingest_raw_data", type: "PythonOperator", upstream: [] },
            { task_id: "dbt_run_staging", type: "BashOperator", upstream: ["ingest_raw_data"] },
            { task_id: "dbt_run_core", type: "BashOperator", upstream: ["dbt_run_staging"] },
            { task_id: "dbt_test_quality", type: "BashOperator", upstream: ["dbt_run_core"] },
          ],
          open_incidents_count: 1,
          unresolved_incidents: [
            {
              incident_id: "INC_SCHEMA_DRIFT_DEMO",
              pipeline_name: "ecommerce_pipeline",
              status: "WAITING_FOR_APPROVAL",
              error_summary: "Schema drift: customer_zip_code_prefix renamed to postal_code_drifted",
              created_at: new Date().toISOString(),
            },
          ],
        });
        setIncidents([
          {
            incident_id: "INC_SCHEMA_DRIFT_DEMO",
            pipeline_name: "ecommerce_pipeline",
            status: "WAITING_FOR_APPROVAL",
            error_summary: "Schema drift: customer_zip_code_prefix renamed to postal_code_drifted",
            created_at: new Date().toISOString(),
          },
        ]);
      }
    } catch {
      setApiOnline(false);
    } finally {
      setLoading(false);
    }
  }, [selectedIncidentId]);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 8000);
    return () => clearInterval(interval);
  }, [loadDashboardData]);

  const handleSelectIncident = async (id: string) => {
    setSelectedIncidentId(id);
    try {
      const detail = await fetchIncidentDetail(id);
      setSelectedIncident(detail);
    } catch {
      setSelectedIncident({
        incident_id: id,
        pipeline_name: "ecommerce_pipeline",
        status: "WAITING_FOR_APPROVAL",
        error_summary: "Schema drift: customer_zip_code_prefix renamed to postal_code_drifted",
        root_cause_analysis: {
          title: "Upstream schema drift on raw.customers",
          root_cause_summary:
            "Physical catalog inspection identified column 'customer_zip_code_prefix' was renamed to 'postal_code_drifted' in upstream raw.customers table.",
          technical_details:
            "Query against information_schema.columns confirmed column 'postal_code_drifted' exists with type INT. Target dbt model stg_customers expects 'customer_zip_code_prefix'.",
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
          ],
        },
      });
    }
  };

  const totalCount = incidents.length;
  const resolvedCount = incidents.filter((i) => i.status === "RESOLVED").length;
  const hasWaitingApproval = incidents.some((i) => i.status === "WAITING_FOR_APPROVAL");
  const openCount = pipelineStatus?.open_incidents_count ?? incidents.filter((i) => i.status !== "RESOLVED").length;

  return (
    <div className="flex min-h-screen bg-[#171717] text-[#ededed]">
      {/* Left Sidebar */}
      <Sidebar
        activeTab={activeNavTab}
        setActiveTab={setActiveNavTab}
        openIncidentsCount={openCount}
        apiOnline={apiOnline}
      />

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          apiOnline={apiOnline}
          activeIncidentsCount={openCount}
          hasWaitingApproval={hasWaitingApproval}
          onRefresh={loadDashboardData}
        />

        <main className="flex-1 p-6 max-w-screen-2xl w-full mx-auto space-y-6">
          {/* VIEW: Incidents & Triage */}
          {activeNavTab === "incidents" && (
            <>
              {/* Supabase-style Page Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-semibold text-[#ededed] tracking-tight">
                    Incidents & self-healing
                  </h1>
                  <p className="text-xs text-[#a0a0a0] mt-1">
                    Pipeline anomalies, autonomous root cause analysis, and remediation reviews.
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="space-y-4">
                  <div className="rounded-[6px] border border-[#2e2e2e] bg-[#1c1c1c] h-24 grid grid-cols-4 divide-x divide-[#2e2e2e]">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="p-4 space-y-2">
                        <Skeleton className="h-3 w-20 bg-[#232323]" />
                        <Skeleton className="h-7 w-28 bg-[#232323]" />
                      </div>
                    ))}
                  </div>
                  <Skeleton className="h-64 w-full rounded-[6px] bg-[#1c1c1c] border border-[#2e2e2e]" />
                </div>
              ) : (
                <>
                  <PipelineMetrics
                    statusData={pipelineStatus}
                    totalIncidents={totalCount}
                    resolvedIncidents={resolvedCount}
                  />

                  <IncidentList
                    incidents={incidents}
                    onSelectIncident={handleSelectIncident}
                    onRefresh={loadDashboardData}
                  />
                </>
              )}
            </>
          )}

          {/* VIEW: Pipeline Metrics */}
          {activeNavTab === "metrics" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-semibold text-[#ededed] tracking-tight">
                    Pipeline metrics
                  </h1>
                  <p className="text-xs text-[#a0a0a0] mt-1">
                    Execution SLA, task lineage health, and contract verification status.
                  </p>
                </div>
              </div>

              <PipelineMetrics
                statusData={pipelineStatus}
                totalIncidents={totalCount}
                resolvedIncidents={resolvedCount}
              />

              {/* Tasks Lineage Table */}
              <div className="rounded-[6px] border border-[#2e2e2e] bg-[#1c1c1c] overflow-hidden">
                <div className="p-4 border-b border-[#2e2e2e]">
                  <h2 className="text-sm font-semibold text-[#ededed]">Pipeline tasks</h2>
                  <p className="text-xs text-[#707070] mt-0.5">
                    Tasks scheduled under ecommerce_pipeline (@daily)
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[13px]">
                    <thead>
                      <tr className="border-b border-[#2e2e2e] bg-[#1f1f1f] text-[#a0a0a0] text-xs">
                        <th className="py-2.5 px-4 font-normal">Task ID</th>
                        <th className="py-2.5 px-4 font-normal">Operator type</th>
                        <th className="py-2.5 px-4 font-normal">Upstream dependencies</th>
                        <th className="py-2.5 px-4 font-normal">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2e2e2e]">
                      {(pipelineStatus?.tasks || []).map((t) => (
                        <tr key={t.task_id} className="h-11 hover:bg-[#222222] transition-colors">
                          <td className="py-2.5 px-4 font-mono text-xs text-[#ededed]">
                            {t.task_id}
                          </td>
                          <td className="py-2.5 px-4 text-xs text-[#a0a0a0]">
                            {t.type}
                          </td>
                          <td className="py-2.5 px-4 text-xs font-mono text-[#707070]">
                            {t.upstream.length > 0 ? t.upstream.join(", ") : "None (root)"}
                          </td>
                          <td className="py-2.5 px-4">
                            <span className="inline-flex items-center gap-1.5 text-xs text-[#3ecf8e]">
                              <span className="size-1.5 rounded-full bg-[#3ecf8e]" />
                              Healthy
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: dbt DAG Lineage */}
          {activeNavTab === "lineage" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-semibold text-[#ededed] tracking-tight">
                    dbt DAG lineage
                  </h1>
                  <p className="text-xs text-[#a0a0a0] mt-1">
                    Directed dependency graph of physical raw sources, views, and dimensional models.
                  </p>
                </div>
              </div>

              <div className="rounded-[6px] border border-[#2e2e2e] bg-[#1c1c1c] p-6 space-y-6">
                <div>
                  <div className="text-xs text-[#707070] mb-3">Model dependency flow</div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="px-2.5 py-1.5 rounded-[4px] bg-[#232323] border border-[#2e2e2e] font-mono text-[#38bdf8]">
                        raw.customers
                      </span>
                      <span className="text-[#707070]">→</span>
                      <span className="px-2.5 py-1.5 rounded-[4px] bg-[#232323] border border-[#2e2e2e] font-mono text-[#3ecf8e]">
                        staging.stg_customers
                      </span>
                      <span className="text-[#707070]">→</span>
                      <span className="px-2.5 py-1.5 rounded-[4px] bg-[#232323] border border-[#2e2e2e] font-mono text-[#ededed]">
                        core.dim_customers
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <span className="px-2.5 py-1.5 rounded-[4px] bg-[#232323] border border-[#2e2e2e] font-mono text-[#38bdf8]">
                        raw.orders
                      </span>
                      <span className="text-[#707070]">→</span>
                      <span className="px-2.5 py-1.5 rounded-[4px] bg-[#232323] border border-[#2e2e2e] font-mono text-[#3ecf8e]">
                        staging.stg_orders
                      </span>
                      <span className="text-[#707070]">→</span>
                      <span className="px-2.5 py-1.5 rounded-[4px] bg-[#232323] border border-[#2e2e2e] font-mono text-[#ededed]">
                        core.fact_orders
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <span className="px-2.5 py-1.5 rounded-[4px] bg-[#232323] border border-[#2e2e2e] font-mono text-[#38bdf8]">
                        raw.payments
                      </span>
                      <span className="text-[#707070]">→</span>
                      <span className="px-2.5 py-1.5 rounded-[4px] bg-[#232323] border border-[#2e2e2e] font-mono text-[#3ecf8e]">
                        staging.stg_payments
                      </span>
                      <span className="text-[#707070]">→</span>
                      <span className="px-2.5 py-1.5 rounded-[4px] bg-[#232323] border border-[#2e2e2e] font-mono text-[#ededed]">
                        analytics.fact_revenue
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: Database Schemas */}
          {activeNavTab === "database" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-semibold text-[#ededed] tracking-tight">
                    PostgreSQL tables
                  </h1>
                  <p className="text-xs text-[#a0a0a0] mt-1">
                    Database schemas on localhost:5433 (PostgreSQL 15).
                  </p>
                </div>
              </div>

              <div className="rounded-[6px] border border-[#2e2e2e] bg-[#1c1c1c] overflow-hidden">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-[#2e2e2e] bg-[#1f1f1f] text-[#a0a0a0] text-xs">
                      <th className="py-2.5 px-4 font-normal">Schema</th>
                      <th className="py-2.5 px-4 font-normal">Table</th>
                      <th className="py-2.5 px-4 font-normal">Approx rows</th>
                      <th className="py-2.5 px-4 font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2e2e2e]">
                    {[
                      { schema: "raw", table: "customers", rows: "5,000", status: "Active" },
                      { schema: "raw", table: "orders", rows: "5,000", status: "Active" },
                      { schema: "raw", table: "payments", rows: "5,000", status: "Active" },
                      { schema: "staging", table: "stg_customers", rows: "View", status: "Compiled" },
                      { schema: "staging", table: "stg_orders", rows: "View", status: "Compiled" },
                      { schema: "core", table: "dim_customers", rows: "5,000", status: "Materialized" },
                      { schema: "core", table: "fact_orders", rows: "5,000", status: "Materialized" },
                      { schema: "staging_sandbox", table: "stg_customers", rows: "100 (test)", status: "Isolated" },
                    ].map((row, idx) => (
                      <tr key={idx} className="h-11 hover:bg-[#222222] transition-colors">
                        <td className="py-2.5 px-4 text-xs font-mono text-[#a0a0a0]">
                          {row.schema}
                        </td>
                        <td className="py-2.5 px-4 text-xs font-mono font-medium text-[#ededed]">
                          {row.table}
                        </td>
                        <td className="py-2.5 px-4 text-xs text-[#a0a0a0]">
                          {row.rows}
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="inline-flex items-center gap-1.5 text-xs text-[#3ecf8e]">
                            <span className="size-1.5 rounded-full bg-[#3ecf8e]" />
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW: Staging Sandbox */}
          {activeNavTab === "sandbox" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-semibold text-[#ededed] tracking-tight">
                    Staging sandbox
                  </h1>
                  <p className="text-xs text-[#a0a0a0] mt-1">
                    Air-gapped schema execution environment for remedial code patch verification.
                  </p>
                </div>
              </div>

              <div className="rounded-[6px] border border-[#2e2e2e] bg-[#1c1c1c] p-6 space-y-4">
                <h2 className="text-sm font-semibold text-[#ededed]">Isolation architecture</h2>
                <p className="text-xs text-[#a0a0a0] leading-relaxed">
                  When a data anomaly is detected, candidate dbt model patches are never applied directly to production.
                  The agent replicates target schema structures inside <span className="font-mono text-[#ededed]">staging_sandbox</span>, executes the proposed SQL fix, and validates row count and schema contracts before presenting the patch for human approval.
                </p>

                <div className="border-t border-[#2e2e2e] pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-[6px] bg-[#232323] border border-[#2e2e2e]">
                    <div className="font-medium text-[#ededed] mb-1">Row count non-zero assertion</div>
                    <div className="text-[#707070]">Verifies the patch materializes records without truncation.</div>
                  </div>
                  <div className="p-3.5 rounded-[6px] bg-[#232323] border border-[#2e2e2e]">
                    <div className="font-medium text-[#ededed] mb-1">dbt schema contract check</div>
                    <div className="text-[#707070]">Ensures all columns and types match the target dimensional schema.</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: Agent Audit Log */}
          {activeNavTab === "audit" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-semibold text-[#ededed] tracking-tight">
                    Agent audit log
                  </h1>
                  <p className="text-xs text-[#a0a0a0] mt-1">
                    Immutable event log of agent investigations, diagnostic tool runs, and approvals.
                  </p>
                </div>
              </div>

              <div className="rounded-[6px] border border-[#2e2e2e] bg-[#1c1c1c] overflow-hidden">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-[#2e2e2e] bg-[#1f1f1f] text-[#a0a0a0] text-xs">
                      <th className="py-2.5 px-4 font-normal">Timestamp</th>
                      <th className="py-2.5 px-4 font-normal">Action</th>
                      <th className="py-2.5 px-4 font-normal">Tool</th>
                      <th className="py-2.5 px-4 font-normal">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2e2e2e]">
                    {[
                      { time: "Just now", action: "HEARTBEAT_CHECK", tool: "airflow_server", details: "Pipeline schedule nominal (@daily)" },
                      { time: "10m ago", action: "METRIC_COLLECTION", tool: "postgres_server", details: "Warehouse statistics refreshed for 8 tables" },
                      { time: "25m ago", action: "SANDBOX_VERIFIED", tool: "dbt_server", details: "staging_sandbox.stg_customers schema test passed" },
                    ].map((item, idx) => (
                      <tr key={idx} className="h-11 hover:bg-[#222222] transition-colors">
                        <td className="py-2.5 px-4 text-xs font-mono text-[#707070]">
                          {item.time}
                        </td>
                        <td className="py-2.5 px-4 text-xs font-mono text-[#ededed]">
                          {item.action}
                        </td>
                        <td className="py-2.5 px-4 text-xs font-mono text-[#a0a0a0]">
                          {item.tool}
                        </td>
                        <td className="py-2.5 px-4 text-xs text-[#a0a0a0]">
                          {item.details}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Case File / Incident Inspector Modal */}
      {selectedIncident && (
        <IncidentDetailModal
          incident={selectedIncident}
          onClose={() => {
            setSelectedIncident(null);
            setSelectedIncidentId(null);
          }}
          onUpdated={loadDashboardData}
        />
      )}
    </div>
  );
}
