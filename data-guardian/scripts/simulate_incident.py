"""
Incident Injection & Simulation Utility for DataGuardian.
Allows developers, CI/CD, or automated test runners to intentionally inject
realistic data anomalies into PostgreSQL 'raw' schema tables to test
the Data Quality Engine, Airflow failure hooks, and the AI DataOps Agent.
"""

import os
import sys
import argparse
import pandas as pd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_SEED_DIR = os.path.join(BASE_DIR, "data", "raw_seed")
INCIDENT_DIR = os.path.join(BASE_DIR, "data", "incident_simulations")
SCRIPTS_DIR = os.path.join(BASE_DIR, "scripts")

for p in [BASE_DIR, SCRIPTS_DIR]:
    if p not in sys.path:
        sys.path.append(p)

try:
    from ingest_raw import load_data, init_raw_tables
except ImportError:
    from scripts.ingest_raw import load_data, init_raw_tables

POSTGRES_USER = os.getenv("POSTGRES_USER", "data_guardian")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "guardian_pass")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB", "data_guardian_db")


def get_engine():
    connection_url = (
        f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@"
        f"{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
    )
    return create_engine(connection_url)


def _safe_str(e):
    try:
        return str(e)
    except Exception:
        try:
            return repr(e)
        except Exception:
            return "Unknown database error"


AVAILABLE_INCIDENTS = {
    "null_spike": {
        "name": "Null Value Spike in Orders",
        "target_table": "raw.orders",
        "file": "null_spike_orders.csv",
        "description": "Injects ~45% null values into the 'order_status' column of raw.orders."
    },
    "schema_drift": {
        "name": "Schema Drift in Customers",
        "target_table": "raw.customers",
        "file": "schema_drift_customers.csv",
        "description": "Renames 'customer_zip_code_prefix' to 'postal_code_drifted' in raw.customers."
    },
    "duplicates": {
        "name": "Duplicate Payment Transactions",
        "target_table": "raw.payments",
        "file": "duplicate_payments.csv",
        "description": "Injects 150 duplicate transaction records into raw.payments."
    }
}


def inject_schema_drift(engine=None) -> bool:
    """Injects upstream schema drift into raw.customers."""
    engine = engine or get_engine()
    csv_file = os.path.join(INCIDENT_DIR, "schema_drift_customers.csv")
    if not os.path.exists(csv_file):
        print(f"[ERROR] Simulation dataset missing: {csv_file}")
        return False

    print(f"\n[INJECTING] Incident: Schema Drift in raw.customers...")
    df = pd.read_csv(csv_file)

    try:
        with engine.begin() as conn:
            # Modify schema structure to simulate drifted upstream payload
            conn.execute(text("ALTER TABLE raw.customers DROP COLUMN IF EXISTS customer_zip_code_prefix CASCADE;"))
            conn.execute(text("ALTER TABLE raw.customers ADD COLUMN IF NOT EXISTS postal_code_drifted INT;"))
            conn.execute(text("TRUNCATE TABLE raw.customers CASCADE;"))

            df.to_sql(
                "customers",
                con=conn,
                schema="raw",
                if_exists="append",
                index=False,
                chunksize=1000,
                method="multi"
            )
        print(f"[SUCCESS] Loaded {len(df)} rows with shifted schema ('postal_code_drifted') into raw.customers.")
        print("          Downstream dbt staging models and schema checks will now catch this drift.")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to inject schema drift (is PostgreSQL running?): {_safe_str(e)}")
        return False


def inject_null_spike(engine=None) -> bool:
    """Injects 45% null values into raw.orders.order_status."""
    engine = engine or get_engine()
    csv_file = os.path.join(INCIDENT_DIR, "null_spike_orders.csv")
    if not os.path.exists(csv_file):
        print(f"[ERROR] Simulation dataset missing: {csv_file}")
        return False

    print(f"\n[INJECTING] Incident: 45% Null Spike in raw.orders...")
    df = pd.read_csv(csv_file)

    try:
        with engine.begin() as conn:
            conn.execute(text("TRUNCATE TABLE raw.orders CASCADE;"))
            df.to_sql(
                "orders",
                con=conn,
                schema="raw",
                if_exists="append",
                index=False,
                chunksize=1000,
                method="multi"
            )
        null_count = df["order_status"].isna().sum()
        null_pct = (null_count / len(df)) * 100
        print(f"[SUCCESS] Loaded {len(df)} orders with {null_count} null status values ({null_pct:.1f}%) into raw.orders.")
        print("          Data Quality Engine rule QR_ORDERS_NULL_STATUS will trigger an incident.")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to inject null spike (is PostgreSQL running?): {_safe_str(e)}")
        return False


def inject_duplicates(engine=None) -> bool:
    """Injects duplicate payment transaction records into raw.payments."""
    engine = engine or get_engine()
    csv_file = os.path.join(INCIDENT_DIR, "duplicate_payments.csv")
    if not os.path.exists(csv_file):
        print(f"[ERROR] Simulation dataset missing: {csv_file}")
        return False

    print(f"\n[INJECTING] Incident: Duplicate Transactions in raw.payments...")
    df = pd.read_csv(csv_file)

    try:
        with engine.begin() as conn:
            conn.execute(text("TRUNCATE TABLE raw.payments CASCADE;"))
            df.to_sql(
                "payments",
                con=conn,
                schema="raw",
                if_exists="append",
                index=False,
                chunksize=1000,
                method="multi"
            )
        print(f"[SUCCESS] Loaded {len(df)} payment rows (with injected duplicate rows) into raw.payments.")
        print("          Data Quality Engine rule QR_PAYMENTS_DUP_TRANSACTION will detect this anomaly.")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to inject duplicate payments (is PostgreSQL running?): {_safe_str(e)}")
        return False


def reset_clean_data(engine=None) -> bool:
    """Restores the database to 100% clean baseline data and restores original column schemas."""
    engine = engine or get_engine()
    print(f"\n[RESETTING] Restoring warehouse to healthy baseline...")

    try:
        with engine.begin() as conn:
            # Revert any altered schema modifications
            conn.execute(text("ALTER TABLE raw.customers DROP COLUMN IF EXISTS postal_code_drifted CASCADE;"))
            conn.execute(text("ALTER TABLE raw.customers ADD COLUMN IF NOT EXISTS customer_zip_code_prefix INT;"))

        # Re-initialize clean tables & re-ingest clean seed data
        init_raw_tables(engine)
        results = load_data(RAW_SEED_DIR)
        print("\n[SUCCESS] Warehouse successfully restored to clean baseline state:")
        for table, count in results.items():
            print(f"  - raw.{table}: {count:,} rows")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to reset clean baseline (is PostgreSQL running?): {_safe_str(e)}")
        return False


def main():
    parser = argparse.ArgumentParser(description="DataGuardian Incident Injection & Simulation CLI")
    parser.add_argument(
        "--incident",
        type=str,
        choices=["null_spike", "schema_drift", "duplicates"],
        help="Inject a specific incident type into the raw database tables."
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Reset warehouse tables to 100% healthy baseline data and original schema contracts."
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List all available simulated incident scenarios."
    )

    args = parser.parse_args()

    if args.list:
        print("\n" + "=" * 80)
        print(" AVAILABLE INCIDENT SIMULATION SCENARIOS")
        print("=" * 80)
        for key, info in AVAILABLE_INCIDENTS.items():
            print(f"Key:         --incident {key}")
            print(f"Name:        {info['name']}")
            print(f"Target:      {info['target_table']}")
            print(f"Description: {info['description']}")
            print("-" * 80)
        print("\nTo reset all tables back to clean baseline:")
        print("  python scripts/simulate_incident.py --reset\n")
        return

    if args.reset:
        success = reset_clean_data()
        sys.exit(0 if success else 1)

    if args.incident:
        if args.incident == "null_spike":
            success = inject_null_spike()
        elif args.incident == "schema_drift":
            success = inject_schema_drift()
        elif args.incident == "duplicates":
            success = inject_duplicates()
        else:
            print(f"[ERROR] Unknown incident: {args.incident}")
            success = False
        sys.exit(0 if success else 1)

    parser.print_help()


if __name__ == "__main__":
    main()
