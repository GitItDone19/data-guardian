"use client";

import React, { useState, useEffect, useCallback } from "react";
import Header from "../components/Header";
import PipelineMetrics from "../components/PipelineMetrics";
import IncidentList from "../components/IncidentList";
import IncidentDetailModal from "../components/IncidentDetailModal";
import {
  fetchHealth,
  fetchPipelineStatus,
  fetchIncidents,
  fetchIncidentDetail,
  PipelineStatusResponse,
  IncidentSummary,
  IncidentDetailResponse,
} from "../lib/api";

export default function DashboardPage() {
  const [apiOnline, setApiOnline] = useState<boolean>(false);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatusResponse | null>(null);
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<IncidentDetailResponse | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

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

        // If a modal is open, refresh its detail
        if (selectedIncidentId) {
          const updatedDetail = await fetchIncidentDetail(selectedIncidentId).catch(() => null);
          if (updatedDetail) setSelectedIncident(updatedDetail);
        }
      } else {
        // Fallback demo state if FastAPI is not yet running
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
              error_summary: "Schema Drift Detected in raw.customers! postal_code_drifted appeared.",
              created_at: new Date().toISOString(),
            },
          ],
        });
        setIncidents([
          {
            incident_id: "INC_SCHEMA_DRIFT_DEMO",
            pipeline_name: "ecommerce_pipeline",
            status: "WAITING_FOR_APPROVAL",
            error_summary: "Schema Drift: customer_zip_code_prefix renamed to postal_code_drifted",
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
      // Demo fallback detail for initial preview
      setSelectedIncident({
        incident_id: id,
        pipeline_name: "ecommerce_pipeline",
        status: "WAITING_FOR_APPROVAL",
        error_summary: "Schema Drift: customer_zip_code_prefix renamed to postal_code_drifted",
        root_cause_analysis: {
          title: "Upstream Schema Drift Detected on raw.customers",
          root_cause_summary:
            "Expected column 'customer_zip_code_prefix' was renamed to 'postal_code_drifted'.",
          technical_details:
            "Physical catalog check confirmed postal_code_drifted exists in raw.customers.",
          blast_radius: ["staging.stg_customers", "core.dim_customers"],
          confidence_score: 0.98,
          evidence_citations: [
            {
              evidence_type: "SCHEMA",
              source: "raw.customers",
              finding: "Found unmapped column postal_code_drifted.",
            },
          ],
        },
        proposed_model_patch: {
          model_name: "stg_customers",
          target_file: "dbt/models/staging/stg_customers.sql",
          strategy: "RENAME_COLUMN_ALIAS",
          explanation: "Added coalesce alias for postal_code_drifted.",
          original_code: "select customer_zip_code_prefix as zip_code from raw.customers;",
          patched_code: "select coalesce(postal_code_drifted, customer_zip_code_prefix) as zip_code from raw.customers;",
          patch_diff:
            "--- a/stg_customers.sql\n+++ b/stg_customers.sql\n@@ -8,1 +8,1 @@\n-    customer_zip_code_prefix as zip_code,\n+    coalesce(postal_code_drifted, customer_zip_code_prefix) as zip_code,",
        },
        sandbox_test_result: {
          status: "SUCCESS",
          tests_passed: true,
          sandbox_schema: "staging_sandbox",
          model_name: "stg_customers",
          assertions_evaluated: [
            { check: "ROW_COUNT_NON_ZERO", result: "PASSED", details: "Table contains 100 rows in sandbox" },
            { check: "SCHEMA_CONTRACT_VALIDATION", result: "PASSED", details: "Verified zip_code, city, state" },
          ],
        },
      });
    }
  };

  const totalCount = incidents.length;
  const resolvedCount = incidents.filter((i) => i.status === "RESOLVED").length;

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Top Header & Simulation Controls */}
      <Header apiOnline={apiOnline} onRefresh={loadDashboardData} />

      {/* Metrics Row */}
      <PipelineMetrics
        statusData={pipelineStatus}
        totalIncidents={totalCount}
        resolvedIncidents={resolvedCount}
      />

      {/* Main Incident Feed */}
      <IncidentList incidents={incidents} onSelectIncident={handleSelectIncident} />

      {/* Modal Inspector for Active Incident */}
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
    </main>
  );
}
