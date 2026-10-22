-- ENABLE EXTENSION FOR GENERATING UUIDs (OPTIONAL BUT RECOMMENDED)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'MANAGER', 'CASHIER')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. MASTER ITEMS TABLE
CREATE TABLE IF NOT EXISTS master_items (
    id SERIAL PRIMARY KEY,
    oem VARCHAR(100) NOT NULL,
    brand VARCHAR(100) NOT NULL,
    part_name VARCHAR(150) NOT NULL,
    make VARCHAR(100),
    model VARCHAR(100),
    year VARCHAR(50),
    engine VARCHAR(100),
    unit_type VARCHAR(20) DEFAULT 'pc' CHECK (unit_type IN ('pc', 'set', 'box')),
    pcs_per_box INT,
    size_per_pc VARCHAR(50),
    position VARCHAR(100),
    origin VARCHAR(100),
    description TEXT,
    images TEXT[], -- ARRAY OF IMAGE URLs FROM CLOUD STORAGE
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. INVENTORY VARIANTS TABLE
CREATE TABLE IF NOT EXISTS inventory_variants (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    barcode VARCHAR(100) UNIQUE NOT NULL,
    master_id INT NOT NULL REFERENCES master_items(id) ON DELETE CASCADE,
    supplier VARCHAR(150) NOT NULL,
    cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    stock INT NOT NULL DEFAULT 0,
    low_stock_limit INT NOT NULL DEFAULT 2,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. SALES TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS sales_transactions (
    id SERIAL PRIMARY KEY,
    txn_number VARCHAR(50) UNIQUE NOT NULL,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    grand_total NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_profit NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    cash NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    change NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. ITEMIZED SALES ITEMS TABLE (SNAPSHOT DATA FOR ACCURATE AUDIT)
CREATE TABLE IF NOT EXISTS sales_items (
    id SERIAL PRIMARY KEY,
    transaction_id INT NOT NULL REFERENCES sales_transactions(id) ON DELETE CASCADE,
    variant_id INT REFERENCES inventory_variants(id) ON DELETE SET NULL,
    variant_code VARCHAR(50) NOT NULL,
    part_name VARCHAR(150) NOT NULL,
    oem VARCHAR(100),
    brand VARCHAR(100),
    qty INT NOT NULL CHECK (qty > 0),
    cost NUMERIC(10, 2) NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL
);

-- INDEXES FOR FASTER POS & SEARCH PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_master_oem ON master_items(oem);
CREATE INDEX IF NOT EXISTS idx_master_part_name ON master_items(part_name);
CREATE INDEX IF NOT EXISTS idx_variant_barcode ON inventory_variants(barcode);
CREATE INDEX IF NOT EXISTS idx_variant_code ON inventory_variants(code);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales_transactions(created_at);