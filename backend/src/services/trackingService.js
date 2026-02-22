import Product from '../models/Product.js';
import PriceHistory from '../models/PriceHistory.js';
import scraperRegistry from '../scrapers/index.js';

/**
 * Tracking Service - Handles product tracking and price updates
 */
class TrackingService {
  /**
   * Start tracking a product.
   * Stores the exact product URL (not search result URL) for canonical tracking.
   */
  async trackProduct({ name, platform, url, imageUrl = null }) {
    try {
      console.log(`[Tracking] Track request: "${name}" on ${platform}`);
      console.log(`[Tracking] Product URL: ${url}`);

      // Check if product already exists by exact URL (prevents cross-product contamination)
      let product = await Product.findByUrl(url);
      
      if (product) {
        // Reactivate if it was deactivated
        if (!product.is_active) {
          product = await Product.update(product.id, { is_active: true });
          console.log(`[Tracking] Reactivated existing product: ${product.id}`);
        } else {
          console.log(`[Tracking] Product already tracked: ${product.id}`);
        }
      } else {
        // Create new product with the exact product page URL
        product = await Product.create({
          name,
          platform,
          product_url: url,
          image_url: imageUrl,
        });
        console.log(`[Tracking] New product tracked: ${product.id}`);
      }
      
      // Fetch and record initial price from the exact product page
      try {
        await this.updateProductPrice(product.id);
      } catch (priceError) {
        console.warn(`[Tracking] Initial price fetch failed for product ${product.id}: ${priceError.message}`);
        // Don't throw — product is still tracked, price will be fetched on next scheduled run
      }
      
      // Return product with latest price
      return await Product.findByIdWithLatestPrice(product.id);
      
    } catch (error) {
      console.error('[Tracking] Track product error:', error);
      throw error;
    }
  }

  /**
   * Stop tracking a product
   */
  async untrackProduct(productId) {
    try {
      const product = await Product.deactivate(productId);
      return product;
    } catch (error) {
      console.error('Untrack product error:', error);
      throw error;
    }
  }

  /**
   * Get all tracked products
   */
  async getTrackedProducts() {
    try {
      const products = await Product.findAllActiveWithLatestPrice();
      return products;
    } catch (error) {
      console.error('Get tracked products error:', error);
      throw error;
    }
  }

  /**
   * Get tracked product by ID
   */
  async getTrackedProduct(productId) {
    try {
      const product = await Product.findByIdWithLatestPrice(productId);
      return product;
    } catch (error) {
      console.error('Get tracked product error:', error);
      throw error;
    }
  }

  /**
   * Update price for a specific product
   */
  async updateProductPrice(productId) {
    try {
      const product = await Product.findById(productId);
      
      if (!product) {
        throw new Error(`Product not found: ${productId}`);
      }
      
      console.log(`[Tracking] Updating price for product ${productId} (${product.platform})`);
      console.log(`[Tracking] Fetching from URL: ${product.product_url}`);
      
      // Fetch current product details from the same canonical product page
      const details = await scraperRegistry.getProductDetails(
        product.platform,
        product.product_url
      );
      
      // Normalize availability from scraper (may be boolean or string)
      const availability = details.availability === true || details.availability === 'available'
        ? 'available' : 'out_of_stock';

      // Record new price
      if (details.price) {
        await PriceHistory.create({
          product_id: productId,
          price: details.price,
          availability,
        });
        
        console.log(`[Tracking] Price updated: ₹${details.price} (${product.platform}) — ${availability}`);
        return details;
      } else {
        console.warn(`[Tracking] No price found for product ${productId} — scraper returned null price`);
        return null;
      }
      
    } catch (error) {
      console.error(`Update price error for product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Update prices for all tracked products
   */
  async updateAllPrices() {
    try {
      const products = await Product.findAllActive();
      console.log(`📊 Updating prices for ${products.length} products...`);
      
      const results = [];
      
      for (const product of products) {
        try {
          const update = await this.updateProductPrice(product.id);
          results.push({
            productId: product.id,
            success: true,
            price: update?.price,
          });
        } catch (error) {
          console.error(`Failed to update product ${product.id}:`, error.message);
          results.push({
            productId: product.id,
            success: false,
            error: error.message,
          });
        }
        
        // Add delay between requests to avoid rate limiting
        await this.delay(2000);
      }
      
      const successCount = results.filter(r => r.success).length;
      console.log(`✅ Price update complete: ${successCount}/${products.length} successful`);
      
      return results;
      
    } catch (error) {
      console.error('Update all prices error:', error);
      throw error;
    }
  }

  /**
   * Get price history for a product
   */
  async getPriceHistory(productId, limit = 100) {
    try {
      const history = await PriceHistory.findByProductId(productId, limit);
      const stats = await PriceHistory.getPriceStats(productId);
      
      return {
        productId,
        history,
        stats,
      };
    } catch (error) {
      console.error('Get price history error:', error);
      throw error;
    }
  }

  /**
   * Get price changes for a product
   */
  async getPriceChanges(productId) {
    try {
      const changes = await PriceHistory.getPriceChanges(productId);
      return changes;
    } catch (error) {
      console.error('Get price changes error:', error);
      throw error;
    }
  }

  /**
   * Helper: delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default new TrackingService();
