# 🛡️ DataGuardian — Agentic DataOps Platform

> **Autonomous monitoring, root cause analysis (RCA), sandbox test validation, and human-in-the-loop remediation for modern data pipelines.**

---

## 🌟 Overview

**DataGuardian** is an end-to-end, production-grade **Agentic DataOps platform**. When data pipelines fail due to schema drift, missing values, or duplicate records, DataGuardian doesn't just send an alert — it acts as an autonomous data reliability engineer:

1. **Detects** anomalies via statistical assertions and dbt quality contracts.
2. **Investigates** root causes using LangGraph agents and read-only diagnostic tools.
3. **Synthesizes** structured, empirical Root Cause Analysis (RCA) reports.
4. **Validates** proposed SQL/dbt model code patches in an isolated `staging_sandbox` schema.
5. **Enforces Human-in-the-Loop (HITL)** governance via a modern Next.js dashboard.
6. **Remediates** production pipelines safely upon approval, maintaining atomic backups and rollback capabilities.
7. **Exposes** data tools to external AI clients (Claude Desktop, Cursor, VS Code) via the open **Model Context Protocol (MCP)** standard.

---

## 🏗️ System Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        STEP 1: ANOMALY & DETECTION                     │
│                                                                        │
│  [Source Data: Missing / Drift] ───> [dbt Quality Tests Fail]          │
│                                                │                       │
│                                                ▼                       │
│                                  [Ticket Created: dataops.incidents]   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    STEP 2: AGENTIC INVESTIGATION                       │
│                                                                        │
│                    [LangGraph AI Agent Wakes Up]                       │
│                                   │                                    │
│        ┌──────────────────────────┼──────────────────────────┐         │
│        ▼                          ▼                          ▼         │
│ [Airflow Tool]            [Postgres Tool]               [dbt Tool]     │
│ Reads Error Logs         Runs SELECT Queries          Reads Model Code │
│        │                          │                          │         │
│        └──────────────────────────┼──────────────────────────┘         │
│                                   ▼                                    │
│                      [Root Cause Identified (RCA)]                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   STEP 3: SAFE SANDBOX VALIDATION                      │
│                                                                        │
│                     [AI Generates Code Patch]                          │
│                                   │                                    │
│                                   ▼                                    │
│             [AI Tests Fix in Isolated 'staging_sandbox']               │
│                   (Production data is NOT touched!)                    │
│                                   │                                    │
│                                   ▼                                    │
│                       [Sandbox Tests Pass: 100%]                       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  STEP 4: HUMAN APPROVAL (DASHBOARD)                    │
│                                                                        │
│                  [Agent Pauses: Waiting for Human]                     │
│                                   │                                    │
│                                   ▼                                    │
│                [Next.js Dashboard shows to Engineer]:                  │
│                 1. Plain-English Root Cause Explanation                │
│                 2. Code Diff (Old Code vs New Code)                    │
│                 3. Sandbox Test Proof                                  │
│                                   │                                    │
│                                   ▼                                    │
│                 [Engineer Clicks "Approve Fix" Button]                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       STEP 5: AUTOMATIC RECOVERY                       │
│                                                                        │
│                   [Approved Fix Applied to Model]                      │
│                                   │                                    │
│                                   ▼                                    │
│                 [Airflow Pipeline Restarts & Passes]                   │
│                                   │                                    │
│                                   ▼                                    │
│                    [Incident Marked: RESOLVED]                         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 💻 Technology Stack

| Layer | Technology | Role & Purpose |
| :--- | :--- | :--- |
| **Warehouse** | **PostgreSQL 15** | Multi-schema database (`raw`, `staging`, `core`, `analytics`, `dataops`, `staging_sandbox`). |
| **Transformations** | **dbt (dbt-postgres)** | Staging views, dimensional tables (`dim_customers`, `fact_orders`), and schema test contracts. |
| **Orchestration** | **Apache Airflow** | Scheduled ingestion, transformation, and automated failure hooks. |
| **Agent Engine** | **LangGraph + LangChain** | Stateful graph execution, sequential reasoning, memory checkpointing, and HITL interrupts. |
| **Protocol Layer** | **Model Context Protocol (MCP 2.x)** | Modular MCP servers exposing Postgres, dbt, and Airflow toolsets to external AI hosts. |
| **Backend API** | **FastAPI + Uvicorn** | REST endpoints for health metrics, incident triage, and human approval routes. |
| **Web Portal** | **Next.js 15 (React + Tailwind)** | Real-time operations portal with metrics cards, audit logs, diff viewer, and approval actions. |

---

## 📂 Project Structure

```
data-guardian/
├── agent/                         # LangGraph AI Agent & Diagnostic Engine
│   ├── graph/                     # Graph definition, state schema, and nodes
│   └── tools/                     # Read-only and write remediation tools
├── airflow/                       # Airflow DAGs and automated failure hooks
│   ├── dags/                      # ecommerce_pipeline.py
│   └── plugins/                   # failure_hook.py
├── backend/                       # FastAPI REST API Backend
│   ├── api/                       # API routes, Pydantic schemas, WebSockets
│   └── main.py                    # Application entry point with CORS
├── dashboard/                     # Next.js 15 Operational Web Portal
│   └── src/app/                   # React components (IncidentList, DiffModal, Metrics)
├── data/                          # Data repository
│   ├── raw_seed/                  # Clean 5,000-order referential Olist seed data
│   └── incident_simulations/      # Anomaly datasets (schema drift, null spikes, duplicates)
├── dbt/                           # dbt transformation models and tests
│   └── models/                    # staging views, core dimensions, schema.yml
├── mcp/                           # Model Context Protocol (MCP) Servers
│   ├── servers/                   # postgres_server.py, dbt_server.py, airflow_server.py
│   └── mcp_config.json            # Client configuration for Claude Desktop / Cursor
├── scripts/                       # Database loading & live incident simulation scripts
└── tests/                         # Test suites (80+ automated tests)
    ├── unit/                      # Unit tests for tools, graph, API, and MCP
    └── integration/               # End-to-end incident lifecycle tests
```

---

## 🚀 Quickstart Guide

### Prerequisites
- **Docker & Docker Compose**
- **Python 3.11+**
- **Node.js 18+ & npm**

### 1. Environment Setup
Clone the repository and configure environment variables:
```bash
cp .env.example .env   # Or review the existing .env file
pip install -r requirements.txt
```

### 2. Start PostgreSQL Warehouse
```bash
docker-compose up -d postgres
```

### 3. Ingest Seed Data
Load clean seed tables into the PostgreSQL `raw` schema:
```bash
python scripts/ingest_raw.py
```

### 4. Run dbt Transformations & Verify
```bash
cd dbt
dbt deps
dbt run
dbt test
cd ..
```

### 5. Launch the FastAPI Management Backend
```bash
uvicorn backend.main:app --reload --port 8000
```
*API Swagger Documentation is available at: `http://localhost:8000/docs`*

### 6. Launch the Next.js Operations Dashboard
```bash
cd dashboard
npm install
npm run dev
```
*Open your browser to: `http://localhost:3000`*

---

## 🔌 Model Context Protocol (MCP) Integration

DataGuardian provides 3 modular MCP servers allowing external AI assistants (e.g. **Claude Desktop**, **Cursor IDE**, or **VS Code**) to securely inspect the database, check dbt models, and triage Airflow pipeline errors.

### Starting an MCP Server
```bash
# PostgreSQL Schema & Query Inspector
python mcp/servers/postgres_server.py

# dbt Model & Contract Inspector
python mcp/servers/dbt_server.py

# Airflow Pipeline & Incident Diagnostic Server
python mcp/servers/airflow_server.py
```

### Connecting to Claude Desktop / Cursor
Add the configuration from [mcp/mcp_config.json](file:///d:/Github/Data%20Engineering/data-guardian/mcp/mcp_config.json) to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "dataguardian-postgres": {
      "command": "python",
      "args": ["<path_to_project>/mcp/servers/postgres_server.py"]
    },
    "dataguardian-dbt": {
      "command": "python",
      "args": ["<path_to_project>/mcp/servers/dbt_server.py"]
    },
    "dataguardian-airflow": {
      "command": "python",
      "args": ["<path_to_project>/mcp/servers/airflow_server.py"]
    }
  }
}
```

---

## 🧪 Live Incident Simulation

You can test DataGuardian's autonomous recovery by injecting realistic anomalies into live database tables:

```bash
# Inject 45% null values into order_status
python scripts/simulate_incident.py --type null_spike

# Inject upstream column rename (postal_code_drifted) into customers
python scripts/simulate_incident.py --type schema_drift

# Inject duplicate payment transaction records
python scripts/simulate_incident.py --type duplicates

# Reset all tables back to clean seed state
python scripts/simulate_incident.py --reset
```

Once injected:
1. Open the dashboard at `http://localhost:3000`.
2. Observe the new incident ticket and trigger AI diagnosis.
3. Review the AI-generated Root Cause Analysis (RCA) and side-by-side code diff.
4. Click **Approve Fix** to observe safe remediation and pipeline recovery.

---

## 🔬 Testing & Quality Verification

Run the complete automated test suite (unit + end-to-end integration):

```bash
# Run unit test suite
python -m pytest tests/unit/

# Run end-to-end integration test suite
python -m pytest tests/integration/

# Run all 76+ tests with coverage
python -m pytest tests/
```

---

## 📄 License
MIT License. Built for autonomous data engineering reliability.
