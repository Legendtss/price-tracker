import AmazonScraper from './AmazonScraper.js';
import FlipkartScraper from './FlipkartScraper.js';
import MyntraScraper from './MyntraScraper.js';

/**
 * Scraper Registry - Central management for all platform scrapers.
 * Tracks per-platform success/failure, timing, and aggregates results.
 */
class ScraperRegistry {
  constructor() {
    this.scrapers = new Map();
    this.initializeScrapers();
  }

  initializeScrapers() {
    this.register('amazon', new AmazonScraper());
    this.register('flipkart', new FlipkartScraper());
    this.register('myntra', new MyntraScraper());
    
    console.log(`[ScraperRegistry] Initialized ${this.scrapers.size} scrapers:`, Array.from(this.scrapers.keys()));
  }

  register(platform, scraper) {
    this.scrapers.set(platform, scraper);
  }

  getScraper(platform) {
    const scraper = this.scrapers.get(platform);
    if (!scraper) {
      throw new Error(`No scraper found for platform: ${platform}`);
    }
    return scraper;
  }

  getAvailablePlatforms() {
    return Array.from(this.scrapers.keys());
  }

  async searchPlatform(platform, query, maxResults = 10) {
    const scraper = this.getScraper(platform);
    return await scraper.search(query, maxResults);
  }

  /**
   * Search all platforms concurrently.
   * Returns aggregated results with per-platform status, timing, and error details.
   * 
   * NOTE: Always scrapes more than maxResults internally so the relevance
   * filter has enough candidates. The actual limit enforcement happens in SearchService.
   */
  async searchAll(query, maxResults = 10) {
    const platforms = this.getAvailablePlatforms();
    const overallStart = Date.now();
    // Always scrape more candidates than requested — first N results are often
    // sponsored or irrelevant. The relevance filter in SearchService will select the best.
    const internalLimit = Math.max(maxResults * 3, 15);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[ScraperRegistry] Search: "${query}" across ${platforms.length} platforms (internal limit: ${internalLimit})`);
    console.log(`${'='.repeat(60)}`);

    // Execute all searches in parallel
    const searchPromises = platforms.map(async (platform) => {
      const start = Date.now();
      try {
        const results = await this.searchPlatform(platform, query, internalLimit);
        const durationMs = Date.now() - start;
        console.log(`[ScraperRegistry] ${platform}: ${results.length} results in ${durationMs}ms`);
        return {
          platform,
          results,
          success: true,
          error: null,
          durationMs,
          checked: true,
        };
      } catch (error) {
        const durationMs = Date.now() - start;
        console.error(`[ScraperRegistry] ${platform}: FAILED in ${durationMs}ms — ${error.message}`);
        return {
          platform,
          results: [],
          success: false,
          error: error.message,
          durationMs,
          checked: true,
        };
      }
    });

    const allResults = await Promise.allSettled(searchPromises);
    const overallDurationMs = Date.now() - overallStart;

    // Aggregate results
    const aggregated = {
      query,
      platforms: {},
      totalResults: 0,
      lowestPrice: null,
      searchedAt: new Date().toISOString(),
      durationMs: overallDurationMs,
    };

    allResults.forEach((settled) => {
      if (settled.status === 'fulfilled') {
        const { platform, results, success, error, durationMs, checked } = settled.value;
        aggregated.platforms[platform] = {
          success,
          checked,
          count: results.length,
          results,
          error,
          durationMs,
        };

        aggregated.totalResults += results.length;

        // Track lowest price across all platforms
        results.forEach((product) => {
          const price = product.price;
          if (price && (!aggregated.lowestPrice || price < aggregated.lowestPrice.price)) {
            aggregated.lowestPrice = { ...product, platform };
          }
        });
      } else {
        // Promise itself rejected (shouldn't happen since we catch inside)
        console.error(`[ScraperRegistry] Promise rejected:`, settled.reason);
      }
    });

    console.log(`\n[ScraperRegistry] Search complete in ${overallDurationMs}ms: ${aggregated.totalResults} total results`);
    for (const [platform, data] of Object.entries(aggregated.platforms)) {
      const status = data.success ? `${data.count} results` : `FAILED: ${data.error}`;
      console.log(`  ${platform}: ${status} (${data.durationMs}ms)`);
    }
    console.log(`${'='.repeat(60)}\n`);

    return aggregated;
  }

  /**
   * Get product details from specific URL
   */
  async getProductDetails(platform, url) {
    console.log(`[ScraperRegistry] Getting product details: ${platform} — ${url}`);
    const scraper = this.getScraper(platform);
    return await scraper.getProductDetails(url);
  }
}

// Export singleton instance
const scraperRegistry = new ScraperRegistry();
export default scraperRegistry;
