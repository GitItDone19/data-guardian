-- 1. Create Raw Tables
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

-- 2. Truncate in case of re-run
TRUNCATE TABLE raw.customers CASCADE;
TRUNCATE TABLE raw.orders CASCADE;
TRUNCATE TABLE raw.payments CASCADE;
TRUNCATE TABLE raw.products CASCADE;
TRUNCATE TABLE raw.product_category_name_translation CASCADE;

-- 3. Copy CSV data into tables
\copy raw.customers FROM '/tmp/raw_seed/customers.csv' WITH (FORMAT csv, HEADER true);
\copy raw.orders FROM '/tmp/raw_seed/orders.csv' WITH (FORMAT csv, HEADER true);
\copy raw.payments FROM '/tmp/raw_seed/payments.csv' WITH (FORMAT csv, HEADER true);
\copy raw.products FROM '/tmp/raw_seed/products.csv' WITH (FORMAT csv, HEADER true);
\copy raw.product_category_name_translation FROM '/tmp/raw_seed/product_category_name_translation.csv' WITH (FORMAT csv, HEADER true);
