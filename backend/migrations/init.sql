-- Initialize database schema for price tracker

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS price_history CASCADE;
DROP TABLE IF EXISTS search_cache CASCADE;
DROP TABLE IF EXISTS products CASCADE;

-- Products table: stores tracked products
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    platform VARCHAR(50) NOT NULL,
    product_url TEXT NOT NULL,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_url)
);

-- Price history table: stores price snapshots over time
CREATE TABLE price_history (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    price DECIMAL(10, 2) NOT NULL,
    availability VARCHAR(50) DEFAULT 'available',
    scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_product_scraped ON price_history(product_id, scraped_at DESC);
CREATE INDEX idx_product_platform ON products(platform);
CREATE INDEX idx_product_active ON products(is_active);

-- Search cache table: temporary cache for search results (optional, helps reduce scraping)
CREATE TABLE search_cache (
    id SERIAL PRIMARY KEY,
    query VARCHAR(255) NOT NULL,
    platform VARCHAR(50) NOT NULL,
    results JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_query_platform ON search_cache(query, platform);
CREATE INDEX idx_cache_created ON search_cache(created_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data (optional, for testing)
-- INSERT INTO products (name, platform, product_url) VALUES 
-- ('Sample Product', 'amazon', 'https://amazon.in/sample');
