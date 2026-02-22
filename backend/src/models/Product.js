import { query } from '../config/database.js';

/**
 * Product Model - Handles all product-related database operations
 */
class Product {
  /**
   * Create a new tracked product
   */
  static async create({ name, platform, product_url, image_url = null }) {
    const sql = `
      INSERT INTO products (name, platform, product_url, image_url)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (product_url) DO UPDATE 
      SET is_active = true, updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    const result = await query(sql, [name, platform, product_url, image_url]);
    return result.rows[0];
  }

  /**
   * Get product by ID
   */
  static async findById(id) {
    const sql = 'SELECT * FROM products WHERE id = $1';
    const result = await query(sql, [id]);
    return result.rows[0];
  }

  /**
   * Get product by URL
   */
  static async findByUrl(product_url) {
    const sql = 'SELECT * FROM products WHERE product_url = $1';
    const result = await query(sql, [product_url]);
    return result.rows[0];
  }

  /**
   * Get all active tracked products
   */
  static async findAllActive() {
    const sql = 'SELECT * FROM products WHERE is_active = true ORDER BY created_at DESC';
    const result = await query(sql);
    return result.rows;
  }

  /**
   * Get tracked products by platform
   */
  static async findByPlatform(platform) {
    const sql = 'SELECT * FROM products WHERE platform = $1 AND is_active = true ORDER BY created_at DESC';
    const result = await query(sql, [platform]);
    return result.rows;
  }

  /**
   * Update product
   */
  static async update(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    });

    values.push(id);

    const sql = `
      UPDATE products 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(sql, values);
    return result.rows[0];
  }

  /**
   * Deactivate product (soft delete)
   */
  static async deactivate(id) {
    const sql = 'UPDATE products SET is_active = false WHERE id = $1 RETURNING *';
    const result = await query(sql, [id]);
    return result.rows[0];
  }

  /**
   * Permanently delete product
   */
  static async delete(id) {
    const sql = 'DELETE FROM products WHERE id = $1 RETURNING *';
    const result = await query(sql, [id]);
    return result.rows[0];
  }

  /**
   * Get product with latest price
   */
  static async findByIdWithLatestPrice(id) {
    const sql = `
      SELECT 
        p.*,
        ph.price as latest_price,
        ph.availability as latest_availability,
        ph.scraped_at as last_checked
      FROM products p
      LEFT JOIN LATERAL (
        SELECT price, availability, scraped_at
        FROM price_history
        WHERE product_id = p.id
        ORDER BY scraped_at DESC
        LIMIT 1
      ) ph ON true
      WHERE p.id = $1
    `;
    
    const result = await query(sql, [id]);
    return result.rows[0];
  }

  /**
   * Get all tracked products with their latest prices
   */
  static async findAllActiveWithLatestPrice() {
    const sql = `
      SELECT 
        p.*,
        ph.price as latest_price,
        ph.availability as latest_availability,
        ph.scraped_at as last_checked
      FROM products p
      LEFT JOIN LATERAL (
        SELECT price, availability, scraped_at
        FROM price_history
        WHERE product_id = p.id
        ORDER BY scraped_at DESC
        LIMIT 1
      ) ph ON true
      WHERE p.is_active = true
      ORDER BY p.created_at DESC
    `;
    
    const result = await query(sql);
    return result.rows;
  }
}

export default Product;
