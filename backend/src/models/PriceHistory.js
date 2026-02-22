import { query } from '../config/database.js';

/**
 * PriceHistory Model - Handles price history tracking
 */
class PriceHistory {
  /**
   * Record a new price snapshot
   */
  static async create({ product_id, price, availability = 'available' }) {
    const sql = `
      INSERT INTO price_history (product_id, price, availability)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    const result = await query(sql, [product_id, price, availability]);
    return result.rows[0];
  }

  /**
   * Get price history for a product
   */
  static async findByProductId(product_id, limit = 100) {
    const sql = `
      SELECT * FROM price_history
      WHERE product_id = $1
      ORDER BY scraped_at DESC
      LIMIT $2
    `;
    
    const result = await query(sql, [product_id, limit]);
    return result.rows;
  }

  /**
   * Get latest price for a product
   */
  static async getLatestPrice(product_id) {
    const sql = `
      SELECT * FROM price_history
      WHERE product_id = $1
      ORDER BY scraped_at DESC
      LIMIT 1
    `;
    
    const result = await query(sql, [product_id]);
    return result.rows[0];
  }

  /**
   * Get price history within date range
   */
  static async findByDateRange(product_id, startDate, endDate) {
    const sql = `
      SELECT * FROM price_history
      WHERE product_id = $1
        AND scraped_at BETWEEN $2 AND $3
      ORDER BY scraped_at ASC
    `;
    
    const result = await query(sql, [product_id, startDate, endDate]);
    return result.rows;
  }

  /**
   * Get price statistics for a product
   */
  static async getPriceStats(product_id) {
    const sql = `
      SELECT 
        MIN(price) as lowest_price,
        MAX(price) as highest_price,
        AVG(price) as average_price,
        COUNT(*) as total_records,
        MIN(scraped_at) as first_tracked,
        MAX(scraped_at) as last_tracked
      FROM price_history
      WHERE product_id = $1
    `;
    
    const result = await query(sql, [product_id]);
    return result.rows[0];
  }

  /**
   * Get price trend (last N records)
   */
  static async getPriceTrend(product_id, limit = 30) {
    const sql = `
      SELECT 
        price,
        scraped_at,
        LAG(price) OVER (ORDER BY scraped_at) as previous_price
      FROM price_history
      WHERE product_id = $1
      ORDER BY scraped_at DESC
      LIMIT $2
    `;
    
    const result = await query(sql, [product_id, limit]);
    return result.rows;
  }

  /**
   * Detect price changes (returns records where price changed)
   */
  static async getPriceChanges(product_id) {
    const sql = `
      WITH price_changes AS (
        SELECT 
          price,
          scraped_at,
          LAG(price) OVER (ORDER BY scraped_at) as previous_price
        FROM price_history
        WHERE product_id = $1
      )
      SELECT * FROM price_changes
      WHERE previous_price IS NOT NULL 
        AND price != previous_price
      ORDER BY scraped_at DESC
    `;
    
    const result = await query(sql, [product_id]);
    return result.rows;
  }

  /**
   * Delete old price history records (cleanup)
   */
  static async deleteOlderThan(days) {
    const sql = `
      DELETE FROM price_history
      WHERE scraped_at < NOW() - INTERVAL '${days} days'
      RETURNING COUNT(*) as deleted_count
    `;
    
    const result = await query(sql);
    return result.rows[0];
  }

  /**
   * Batch insert multiple price records
   */
  static async batchCreate(records) {
    if (!records || records.length === 0) return [];

    const values = records.map((r, i) => 
      `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`
    ).join(', ');

    const params = records.flatMap(r => [r.product_id, r.price, r.availability || 'available']);

    const sql = `
      INSERT INTO price_history (product_id, price, availability)
      VALUES ${values}
      RETURNING *
    `;

    const result = await query(sql, params);
    return result.rows;
  }
}

export default PriceHistory;
