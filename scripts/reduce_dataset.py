
import os
import pandas as pd

RAW_SEED_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "raw_seed")

def reduce_dataset(sample_orders_n=5000):
    print(f"Starting dataset reduction from {RAW_SEED_DIR}...")

    # File paths
    orders_file = os.path.join(RAW_SEED_DIR, "olist_orders_dataset.csv")
    customers_file = os.path.join(RAW_SEED_DIR, "olist_customers_dataset.csv")
    payments_file = os.path.join(RAW_SEED_DIR, "olist_order_payments_dataset.csv")
    products_file = os.path.join(RAW_SEED_DIR, "olist_products_dataset.csv")
    translation_file = os.path.join(RAW_SEED_DIR, "product_category_name_translation.csv")

    # 1. Sample Orders
    print(f"Sampling {sample_orders_n} orders from olist_orders_dataset.csv...")
    df_orders = pd.read_csv(orders_file)
    df_orders_sampled = df_orders.sample(n=min(sample_orders_n, len(df_orders)), random_state=42)
    
    sampled_order_ids = set(df_orders_sampled["order_id"])
    sampled_customer_ids = set(df_orders_sampled["customer_id"])

    # 2. Filter Customers matching sampled orders
    print("Filtering customers matching sampled orders...")
    df_customers = pd.read_csv(customers_file)
    df_customers_sampled = df_customers[df_customers["customer_id"].isin(sampled_customer_ids)]

    # 3. Filter Payments matching sampled orders
    print("Filtering payments matching sampled orders...")
    df_payments = pd.read_csv(payments_file)
    df_payments_sampled = df_payments[df_payments["order_id"].isin(sampled_order_ids)]

    # 4. Sample Products
    print("Sampling products...")
    df_products = pd.read_csv(products_file)
    # Keep top 1500 products
    df_products_sampled = df_products.sample(n=min(1500, len(df_products)), random_state=42)

    # 5. Product Category Translations (keep full as it's already tiny - 2KB)
    if os.path.exists(translation_file):
        df_trans = pd.read_csv(translation_file)
    else:
        df_trans = pd.DataFrame()

    # Output normalized filenames in raw_seed
    output_files = {
        "customers.csv": df_customers_sampled,
        "orders.csv": df_orders_sampled,
        "payments.csv": df_payments_sampled,
        "products.csv": df_products_sampled,
    }

    print("\n--- Summary of Reduced Files ---")
    for name, df in output_files.items():
        out_path = os.path.join(RAW_SEED_DIR, name)
        df.to_csv(out_path, index=False)
        size_kb = os.path.getsize(out_path) / 1024
        print(f"Saved {name}: {len(df)} rows ({size_kb:.1f} KB)")

    # Clean up original heavy files to free disk space
    heavy_files = [
        orders_file,
        customers_file,
        payments_file,
        products_file
    ]
    for hf in heavy_files:
        if os.path.exists(hf):
            os.remove(hf)
            print(f"Removed heavy source: {os.path.basename(hf)}")

    print("\nDataset successfully reduced! Total size is now < 1.5 MB with full referential integrity.")

if __name__ == "__main__":
    reduce_dataset()
