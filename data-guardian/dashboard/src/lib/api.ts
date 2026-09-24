/**
 * DataGuardian API Client
 * Interfaces with the FastAPI Management Backend (http://localhost:8000)
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export interface PipelineTaskInfo {
  task_id: string;
  type: string;
  upstream: string[];
}

export interface IncidentSummary {
  incident_id: string;
  pipeline_name: string;
  status: string;
  error_summary?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PipelineStatusResponse {
  dag_id: string;
  status: string;
  schedule: string;
  task_count: number;
  tasks: PipelineTaskInfo[];
  open_incidents_count: number;
  unresolved_incidents: IncidentSummary[];
}

export interface IncidentDetailResponse {
  incident_id: string;
  pipeline_name: string;
  status: string;
  error_summary?: string;
  root_cause?: string;
  proposed_fix?: string;
  created_at?: string;
  updated_at?: string;
  audit_events?: Array<{
    log_id: number;
    action_type: string;
    tool_name?: string;
    tool_input?: string;
    tool_output?: string;
    reasoning_summary?: string;
    timestamp?: string;
  }>;
  root_cause_analysis?: {
    title?: string;
    root_cause_summary?: string;
    technical_details?: string;
    blast_radius?: string[];
    evidence_citations?: Array<{
      evidence_type: string;
      source: string;
      finding: string;
    }>;
    confidence_score?: number;
  };
  proposed_model_patch?: {
    model_name: string;
    target_file: string;
    strategy: string;
    patch_diff: string;
    original_code: string;
    patched_code: string;
    explanation: string;
  };
  sandbox_test_result?: {
    status: string;
    tests_passed: boolean;
    sandbox_schema: string;
    model_name: string;
    assertions_evaluated: Array<{
      check: string;
      result: string;
      details: string;
    }>;
  };
}

export interface ApprovalResponse {
  incident_id: string;
  action: string;
  status: string;
  message: string;
  remediation_result?: Record<string, unknown>;
}

export async function fetchHealth(): Promise<{ status: string }> {
  try {
    const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
    if (!res.ok) throw new Error("Health check failed");
    return await res.json();
  } catch {
    return { status: "OFFLINE" };
  }
}

export async function fetchPipelineStatus(): Promise<PipelineStatusResponse> {
  const res = await fetch(`${API_BASE}/pipelines/status`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch pipeline status");
  return await res.json();
}

export async function fetchIncidents(statusFilter?: string): Promise<IncidentSummary[]> {
  const url = statusFilter
    ? `${API_BASE}/incidents?status=${statusFilter}`
    : `${API_BASE}/incidents`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch incidents");
  return await res.json();
}

export async function fetchIncidentDetail(incidentId: string): Promise<IncidentDetailResponse> {
  const res = await fetch(`${API_BASE}/incidents/${incidentId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch incident ${incidentId}`);
  return await res.json();
}

export async function triageIncident(incidentId: string): Promise<IncidentDetailResponse> {
  const res = await fetch(`${API_BASE}/incidents/${incidentId}/triage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Triage failed for incident ${incidentId}`);
  return await res.json();
}

export async function submitApproval(
  incidentId: string,
  action: "approve" | "reject",
  reviewerNotes?: string
): Promise<ApprovalResponse> {
  const res = await fetch(`${API_BASE}/incidents/${incidentId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, reviewer_notes: reviewerNotes }),
  });
  if (!res.ok) throw new Error(`Approval submission failed for ${incidentId}`);
  return await res.json();
}

export async function triggerSimulation(scenario: "null_spike" | "schema_drift" | "duplicates" | "reset"): Promise<{
  status: string;
  scenario: string;
  message: string;
}> {
  const res = await fetch(`${API_BASE}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario }),
  });
  if (!res.ok) throw new Error(`Simulation ${scenario} failed`);
  return await res.json();
}
