"""
Ingestion script for DataGuardian raw data.
Reads seed CSV files from data/raw_seed (or incident simulations)
and loads them into the PostgreSQL 'raw' schema tables.
"""

import os
import sys
import pandas as pd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

POSTGRES_USER = os.getenv("POSTGRES_USER", "data_guardian")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "guardian_pass")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB", "data_guardian_db")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_DATA_DIR = os.path.join(BASE_DIR, "data", "raw_seed")

def get_engine():
    connection_url = (
        f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@"
        f"{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
    )
    return create_engine(connection_url)

def init_raw_tables(engine):
    """Ensure the raw schema and tables exist before loading."""
    ddl = """
    CREATE SCHEMA IF NOT EXISTS raw;

    CREATE TABLE IF NOT EXISTS raw.customers (
        customer_id VARCHAR(100) PRIMARY KEY,
        customer_unique_id VARCHAR(100),
        customer_zip_code_prefix INT,
        customer_city VARCHAR(100),
        customer_state VARCHAR(10)
    );

    CREATE TABLE IF NOT EXISTS raw.orders (
        order_id VARCHAR(100) PRIMARY KEY,
        customer_id VARCHAR(100),
        order_status VARCHAR(50),
        order_purchase_timestamp VARCHAR(50),
        order_approved_at VARCHAR(50),
        order_delivered_carrier_date VARCHAR(50),
        order_delivered_customer_date VARCHAR(50),
        order_estimated_delivery_date VARCHAR(50)
    );

    CREATE TABLE IF NOT EXISTS raw.payments (
        order_id VARCHAR(100),
        payment_sequential INT,
        payment_type VARCHAR(50),
        payment_installments INT,
        payment_value NUMERIC(10, 2)
    );

    CREATE TABLE IF NOT EXISTS raw.products (
        product_id VARCHAR(100) PRIMARY KEY,
        product_category_name VARCHAR(100),
        product_name_lenght NUMERIC,
        product_description_lenght NUMERIC,
        product_photos_qty NUMERIC,
        product_weight_g NUMERIC,
        product_length_cm NUMERIC,
        product_height_cm NUMERIC,
        product_width_cm NUMERIC
    );

    CREATE TABLE IF NOT EXISTS raw.product_category_name_translation (
        product_category_name VARCHAR(100) PRIMARY KEY,
        product_category_name_english VARCHAR(100)
    );
    """
    with engine.begin() as conn:
        conn.execute(text(ddl))

def load_data(data_dir=None):
    """
    Loads CSV data from data_dir into the raw schema.
    Returns a dictionary of loaded table names and row counts.
    """
    if data_dir is None:
        data_dir = DEFAULT_DATA_DIR

    print(f"Starting raw data ingestion from: {data_dir}")
    engine = get_engine()
    init_raw_tables(engine)

    files_and_tables = [
        ("customers.csv", "customers"),
        ("orders.csv", "orders"),
        ("payments.csv", "payments"),
        ("products.csv", "products"),
        ("product_category_name_translation.csv", "product_category_name_translation")
    ]

    results = {}

    with engine.begin() as conn:
        for filename, table_name in files_and_tables:
            file_path = os.path.join(data_dir, filename)
            if not os.path.exists(file_path):
                print(f"[WARN] File not found: {file_path}, skipping.")
                continue

            print(f"Loading {filename} -> raw.{table_name}...")
            df = pd.read_csv(file_path)

            # Truncate before load to ensure idempotency
            conn.execute(text(f"TRUNCATE TABLE raw.{table_name} CASCADE;"))
            df.to_sql(
                table_name,
                con=conn,
                schema="raw",
                if_exists="append",
                index=False,
                chunksize=1000,
                method="multi"
            )
            results[table_name] = len(df)
            print(f"Loaded {len(df)} rows into raw.{table_name}")

    print("Raw ingestion complete!")
    return results

if __name__ == "__main__":
    custom_dir = sys.argv[1] if len(sys.argv) > 1 else None
    load_data(custom_dir)
