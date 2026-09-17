import os
import pandas as pd
import numpy as np

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
RAW_SEED_DIR = os.path.join(BASE_DIR, "data", "raw_seed")
INCIDENT_DIR = os.path.join(BASE_DIR, "data", "incident_simulations")

def generate_incident_simulations():
    os.makedirs(INCIDENT_DIR, exist_ok=True)
    print(f"Generating incident simulation datasets in {INCIDENT_DIR}...\n")

    # 1. Incident A: Schema Drift in Customers
    # Simulates an upstream API renaming/dropping columns
    customers_path = os.path.join(RAW_SEED_DIR, "customers.csv")
    if os.path.exists(customers_path):
        df_customers = pd.read_csv(customers_path)
        # Rename column to simulate schema drift
        df_drift = df_customers.rename(columns={"customer_zip_code_prefix": "postal_code_drifted"})
        out_drift = os.path.join(INCIDENT_DIR, "schema_drift_customers.csv")
        df_drift.to_csv(out_drift, index=False)
        print(f"1. Created Schema Drift Dataset: {out_drift}")
        print("   - Injected change: renamed 'customer_zip_code_prefix' -> 'postal_code_drifted'")

    # 2. Incident B: Null Value Spike in Orders
    # Simulates data quality corruption / pipeline breakage
    orders_path = os.path.join(RAW_SEED_DIR, "orders.csv")
    if os.path.exists(orders_path):
        df_orders = pd.read_csv(orders_path)
        # Inject 45% nulls into order_status
        np.random.seed(42)
        mask = np.random.rand(len(df_orders)) < 0.45
        df_orders_corrupt = df_orders.copy()
        df_orders_corrupt.loc[mask, "order_status"] = np.nan
        out_nulls = os.path.join(INCIDENT_DIR, "null_spike_orders.csv")
        df_orders_corrupt.to_csv(out_nulls, index=False)
        print(f"\n2. Created Data Quality Null Spike Dataset: {out_nulls}")
        print(f"   - Injected change: {mask.sum()} nulls injected into 'order_status' ({mask.mean()*100:.1f}%)")

    # 3. Incident C: Duplicate Transaction Records in Payments
    # Simulates payment webhook retry duplication
    payments_path = os.path.join(RAW_SEED_DIR, "payments.csv")
    if os.path.exists(payments_path):
        df_payments = pd.read_csv(payments_path)
        # Duplicate 150 random rows
        df_duplicates = df_payments.sample(n=150, random_state=42)
        df_payments_dup = pd.concat([df_payments, df_duplicates], ignore_index=True)
        out_dup = os.path.join(INCIDENT_DIR, "duplicate_payments.csv")
        df_payments_dup.to_csv(out_dup, index=False)
        print(f"\n3. Created Duplicate Anomaly Dataset: {out_dup}")
        print(f"   - Injected change: duplicated {len(df_duplicates)} payment transaction records")

    print("\nAll incident simulation datasets successfully generated!")

if __name__ == "__main__":
    generate_incident_simulations()
