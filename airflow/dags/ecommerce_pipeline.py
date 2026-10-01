"""
Airflow DAG: ecommerce_pipeline
Orchestrates end-to-end ingestion, staging transformations, core dimensional modelling,
and data quality assertion testing for DataGuardian.
Equipped with autonomous incident logging hooks on task failure.
"""

import os
import sys
from datetime import datetime, timedelta

# Ensure airflow/plugins and project root are on sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PLUGINS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "plugins")
SCRIPTS_DIR = os.path.join(BASE_DIR, "scripts")
DBT_DIR = os.path.join(BASE_DIR, "dbt")

for path in [BASE_DIR, PLUGINS_DIR, SCRIPTS_DIR]:
    if path not in sys.path:
        sys.path.append(path)

# Try importing Airflow components; if running in non-Airflow dev env, provide mocks
try:
    from airflow import DAG
    from airflow.operators.python import PythonOperator
    from airflow.operators.bash import BashOperator
    AIRFLOW_AVAILABLE = True
except ImportError:
    AIRFLOW_AVAILABLE = False
    # Mock classes for testing outside Airflow runtime
    class DAG:
        def __init__(self, dag_id, default_args=None, schedule_interval=None, **kwargs):
            self.dag_id = dag_id
            self.default_args = default_args or {}
            self.schedule_interval = schedule_interval
            self.tasks = []

    class BaseOperator:
        def __init__(self, task_id, dag=None, on_failure_callback=None, **kwargs):
            self.task_id = task_id
            self.dag = dag
            self.on_failure_callback = on_failure_callback
            if dag:
                dag.tasks.append(self)
        def __rshift__(self, other):
            return other

    class PythonOperator(BaseOperator):
        def __init__(self, python_callable=None, op_kwargs=None, **kwargs):
            super().__init__(**kwargs)
            self.python_callable = python_callable
            self.op_kwargs = op_kwargs or {}

    class BashOperator(BaseOperator):
        def __init__(self, bash_command=None, env=None, **kwargs):
            super().__init__(**kwargs)
            self.bash_command = bash_command
            self.env = env or {}

# Import the incident failure callback
try:
    from failure_hook import record_incident_on_failure
except ImportError:
    try:
        from airflow.plugins.failure_hook import record_incident_on_failure
    except ImportError:
        def record_incident_on_failure(context):
            print(f"[WARN] Fallback failure hook invoked: {context}")

# Import the ingestion logic
try:
    from ingest_raw import load_data
except ImportError:
    try:
        from scripts.ingest_raw import load_data
    except ImportError:
        def load_data(data_dir=None):
            print("[INFO] Fallback load_data invoked.")

# DAG Default Configuration
default_args = {
    "owner": "data_guardian",
    "depends_on_past": False,
    "start_date": datetime(2026, 1, 1),
    "email_on_failure": False,
    "email_on_retry": False,
    "retries": 1,
    "retry_delay": timedelta(minutes=1),
    "on_failure_callback": record_incident_on_failure,
}

dag = DAG(
    dag_id="ecommerce_pipeline",
    default_args=default_args,
    description="End-to-End E-Commerce Data Pipeline with Autonomous Agent Incident Trigger",
    schedule_interval="@daily",
    catchup=False,
    max_active_runs=1,
)

# Task 1: Ingest seed data into PostgreSQL 'raw' schema
def execute_ingestion(**kwargs):
    print("Executing Task: Ingest Raw Data...")
    counts = load_data()
    print(f"Ingestion finished successfully with counts: {counts}")
    return counts

ingest_task = PythonOperator(
    task_id="ingest_raw_data",
    python_callable=execute_ingestion,
    dag=dag,
)

# Set dbt command paths safely for cross-platform (bash / powershell / docker)
dbt_flags = f"--project-dir \"{DBT_DIR}\" --profiles-dir \"{DBT_DIR}\""

# Task 2: Run dbt Staging models (Views in staging schema)
dbt_run_staging = BashOperator(
    task_id="dbt_run_staging",
    bash_command=f"dbt run --select staging {dbt_flags}",
    dag=dag,
)

# Task 3: Run dbt Core models (Tables in core schema: dim_customers, fact_orders)
dbt_run_core = BashOperator(
    task_id="dbt_run_core",
    bash_command=f"dbt run --select core {dbt_flags}",
    dag=dag,
)

# Task 4: Run dbt Data Quality & Contract Tests
dbt_test_quality = BashOperator(
    task_id="dbt_test_quality",
    bash_command=f"dbt test {dbt_flags}",
    dag=dag,
)

# Define Dependency Flow:
# 1. Raw Ingestion must finish before Staging views are refreshed.
# 2. Staging views must be built before Core dimensional tables are computed.
# 3. Quality tests must run after Core models are built to validate data contracts.
ingest_task >> dbt_run_staging >> dbt_run_core >> dbt_test_quality
