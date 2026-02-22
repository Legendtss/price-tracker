import scraperRegistry from '../scrapers/index.js';
import { query } from '../config/database.js';
import productMatcher from '../utils/productMatcher.js';

/**
 * Search Service - Handles product search across multiple platforms.
 *
 * CRITICAL RULES:
 *   1. Only allow 5 websites: Amazon, Flipkart, Myntra, Croma, Reliance Digital
 *   2. Maximum 5 results TOTAL (1 per website max)
 *   3. Apply strict relevance filtering (reject unrelated products)
 *   4. Deduplicate products per website (keep lowest price)
 *   5. Normalize & sort results (price → availability → source priority)
 *   6. Null/invalid prices filtered (must be > ₹100)
 *
 * Key responsibilities:
 *   1. Orchestrate scraper searches
 *   2. Apply strict product matching & deduplication
 *   3. Enforce website and result limits
 *   4. Apply strict relevance filtering
 *   5. Normalize & sort results
 *   6. Cache results (optional, DB-backed)
 *   7. Log all filtering decisions for debugging
 */
class SearchService {
  constructor() {
    // ── ALLOWED WEBSITES (limit to 5) ─────────────────────────────────────
    this.allowedWebsites = new Set([
      'amazon',
      'flipkart',
      'myntra',
      'croma',
      'reliance',
    ]);

    // ── Stop words: removed during tokenization ───────────────────────────
    this.stopWords = new Set([
      'for', 'with', 'and', 'the', 'a', 'an', 'of', 'to', 'in', 'on', 'by',
      'from', 'new', 'latest', 'best', 'buy', 'online', 'india', 'price',
      'sale', 'deal', 'offer', 'discount', 'combo', 'pack', 'set', 'piece',
      'is', 'it', 'at', 'or', 'be', 'this', 'that', 'was', 'are', 'were',
      'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'can', 'shall', 'get', 'got', 'make',
    ]);

    // ── Known product brands (electronics, fashion, etc.) ─────────────────
    this.knownBrands = new Set([
      // Phone brands
      'iphone', 'apple', 'samsung', 'oneplus', 'xiaomi', 'redmi', 'realme',
      'oppo', 'vivo', 'pixel', 'google', 'motorola', 'nothing', 'poco',
      'iqoo', 'nokia', 'huawei', 'honor', 'asus', 'rog',
      // Laptop / tech brands
      'dell', 'hp', 'lenovo', 'acer', 'msi', 'macbook', 'thinkpad',
      'surface', 'microsoft', 'intel', 'amd', 'nvidia',
      // Fashion brands
      'nike', 'adidas', 'puma', 'reebok', 'skechers', 'levis', 'zara',
      'hm', 'uniqlo', 'gucci', 'prada', 'louis', 'vuitton',
      // Others
      'sony', 'lg', 'bosch', 'philips', 'dyson', 'jbl', 'bose',
      'boat', 'fire', 'boltt', 'fossil', 'titan', 'casio', 'timex',
    ]);

    // ── Accessory keywords: reject these when searching for main products ─
    this.accessoryKeywords = [
      'case', 'cover', 'back cover', 'tempered', 'screen guard', 'screen protector',
      'protector', 'charger', 'cable', 'adapter', 'earbuds', 'earphones',
      'headphones', 'power bank', 'holder', 'stand', 'tripod', 'watch strap',
      'skin', 'sticker', 'decal', 'pouch', 'sleeve', 'cleaning kit', 'stylus',
      'film', 'mount', 'grip', 'ring holder', 'pop socket', 'armband',
      'car mount', 'dock', 'hub', 'dongle', 'otg', 'memory card',
    ];

    // ── Apparel keywords: reject when searching for electronics ───────────
    this.apparelKeywords = [
      'dress', 'top', 'shirt', 'tshirt', 't-shirt', 'kurta', 'saree', 'sari',
      'jeans', 'jacket', 'hoodie', 'bra', 'pant', 'trouser', 'skirt', 'shoe',
      'sandal', 'heels', 'blouse', 'lehenga', 'dupatta', 'palazzo', 'shorts',
      'trackpant', 'track pant', 'jogger', 'sweatshirt', 'sweater', 'cardigan',
      'blazer', 'suit', 'tie', 'belt', 'scarf', 'shawl', 'stole', 'lingerie',
      'underwear', 'boxers', 'socks', 'cap', 'hat', 'beanie', 'watch band',
      'handbag', 'purse', 'wallet', 'clutch', 'tote', 'backpack',
      'printed', 'cotton', 'polyester', 'silk', 'chiffon', 'georgette',
    ];

    // ── Electronics keywords: indicates an electronics search ─────────────
    this.electronicsKeywords = [
      'phone', 'mobile', 'smartphone', 'laptop', 'tablet', 'camera', 'tv',
      'television', 'monitor', 'speaker', 'headphone', 'earphone', 'earbud',
      'smartwatch', 'watch', 'console', 'gaming', 'processor', 'gpu', 'ssd',
      'hdd', 'ram', 'router', 'printer', 'scanner', 'projector', 'drone',
      'gb', 'tb', '5g', '4g', 'wifi', 'bluetooth', 'amoled', 'oled', 'lcd',
    ];

    // ── Source priority for sorting (lower = higher priority) ─────────────
    this.sourcePriority = { amazon: 1, flipkart: 2, myntra: 3 };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC METHODS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Search all platforms for a product
   */
  async searchAll(searchQuery, maxResults = 10) {
    console.log(`\n[SearchService] searchAll: "${searchQuery}" (limit ${maxResults})`);
    try {
      const results = await scraperRegistry.searchAll(searchQuery, maxResults);
      this.applyRelevanceFilter(results, searchQuery, maxResults);

      // Sort the combined results inside each platform
      this.applySorting(results);

      // Cache results (non-blocking, best-effort)
      this.cacheSearchResults(searchQuery, results).catch(() => {});

      return results;
    } catch (error) {
      console.error('[SearchService] searchAll error:', error);
      throw error;
    }
  }

  /**
   * Search specific platform
   */
  async searchPlatform(platform, searchQuery, maxResults = 10) {
    console.log(`[SearchService] searchPlatform: ${platform} — "${searchQuery}"`);
    try {
      const rawResults = await scraperRegistry.searchPlatform(platform, searchQuery, maxResults);
      const results = this.filterAndRankProducts(rawResults, searchQuery, maxResults);
      return {
        platform,
        query: searchQuery,
        results,
        searchedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[SearchService] searchPlatform error (${platform}):`, error);
      throw error;
    }
  }

  getAvailablePlatforms() {
    return scraperRegistry.getAvailablePlatforms();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RELEVANCE FILTERING (core logic)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Apply relevance filtering to aggregated results (mutates in-place).
   * 
   * CRITICAL FILTERS APPLIED:
   * 1. Only allowed websites (5 max: Amazon, Flipkart, Myntra, Croma, Reliance Digital)
   * 2. Remove invalid prices (must be > ₹100)
   * 3. Deduplicate per website (keep lowest price)
   * 4. Up to 5 products per website (best matches)
   * 5. Relevance scoring (reject unrelated products)
   * 
   * Recalculates totalResults and lowestPrice after filtering.
   */
  applyRelevanceFilter(aggregatedResults, searchQuery, maxResults) {
    let totalResults = 0;
    let lowestPrice = null;
    let totalRejected = 0;
    let totalWebsiteRejected = 0; // Count of non-allowed websites

    Object.keys(aggregatedResults.platforms).forEach((platform) => {
      // ── RULE 1: Filter by allowed websites ────────────────────────────
      if (!this.allowedWebsites.has(platform.toLowerCase())) {
        console.log(`[SearchService] WEBSITE REJECTED: "${platform}" (not in allowed list)`);
        totalWebsiteRejected++;
        delete aggregatedResults.platforms[platform];
        return;
      }

      const platformData = aggregatedResults.platforms[platform];
      let rawResults = platformData.results || [];
      const rawCount = rawResults.length;

      // ── RULE 2: Filter by valid price (must be > ₹100) ──────────────────
      rawResults = rawResults.filter((product) => {
        if (!product.price || product.price < 100) {
          console.log(`[SearchService] PRICE REJECTED on ${platform}: "${product.title?.substring(0, 50)}" (price: ${product.price})`);
          return false;
        }
        return true;
      });
      const priceFilteredCount = rawCount - rawResults.length;

      // ── RULE 3: Deduplicate products within website ────────────────────
      rawResults = productMatcher.deduplicateByWebsite(rawResults);
      const deduplicatedCount = rawResults.length;

      // ── RULE 4: Apply relevance filter & ranking ──────────────────────
      const filtered = this.filterAndRankProducts(rawResults, searchQuery, maxResults);
      const relevanceRejected = deduplicatedCount - filtered.length;

      if (relevanceRejected > 0) {
        console.log(`[SearchService] ${platform}: ${relevanceRejected}/${deduplicatedCount} products rejected by relevance`);
      }

      // ── RULE 5: Keep top 5 products per website ─────────────────────
      const finalResults = filtered.slice(0, 5);

      totalRejected += rawCount - finalResults.length;
      totalRejected += priceFilteredCount;

      platformData.results = finalResults;
      platformData.count = finalResults.length;
      platformData.rejectedCount = rawCount - finalResults.length;

      // Track lowest price across all platforms
      for (const product of finalResults) {
        if (product.price && (!lowestPrice || product.price < lowestPrice.price)) {
          lowestPrice = { ...product, platform };
        }
      }

      totalResults += finalResults.length;
    });

    aggregatedResults.totalResults = totalResults;
    aggregatedResults.lowestPrice = lowestPrice;

    console.log(`[SearchService] FINAL: ${totalResults} products kept (rejected: ${totalRejected}, websites rejected: ${totalWebsiteRejected})`);
    console.log(`[SearchService] Result structure: up to 5 results per allowed website`);
  }

  /**
   * Filter and rank products by relevance score. Reject score <= 0.
   */
  filterAndRankProducts(products, searchQuery, maxResults) {
    if (!products || products.length === 0) return [];

    return products
      .map((product) => {
        const title = product.title || product.product_name || '';
        const score = this.scoreRelevance(searchQuery, title);
        return { product, score };
      })
      .filter((item) => {
        if (item.score <= 0) {
          const title = item.product.title || item.product.product_name || '';
          console.log(`[SearchService] REJECTED: "${title.substring(0, 70)}" (score: ${item.score})`);
          return false;
        }
        return true;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map((item) => item.product);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RELEVANCE SCORING
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Compute relevance score for a product title against a search query.
   * Returns:
   *   > 0  → relevant (higher = better match)
   *   <= 0 → not relevant (should be rejected)
   *
   * Scoring strategy:
   *   1. Tokenize & normalize both query and title
   *   2. Require ALL numeric tokens (model numbers, storage sizes) to match
   *   3. Require ALL brand tokens to match
   *   4. Require minimum keyword overlap ratio (Jaccard-like)
   *   5. Reject accessories/apparel when searching for electronics
   *   6. Bonus for exact phrase / substring match
   */
  scoreRelevance(searchQuery, title) {
    const queryNorm = this.normalizeText(searchQuery);
    const titleNorm = this.normalizeText(title);
    if (!queryNorm || !titleNorm) return -1;

    const queryTokens = this.tokenize(queryNorm);
    const titleTokens = this.tokenize(titleNorm);
    if (queryTokens.length === 0) return -1;
    if (titleTokens.length === 0) return -1;

    const queryTokenSet = new Set(queryTokens);
    const titleTokenSet = new Set(titleTokens);

    // ── Classify query intent ─────────────────────────────────────────
    const brandTokens = queryTokens.filter((t) => this.knownBrands.has(t));
    const numericTokens = queryTokens.filter((t) => /\d/.test(t));
    const colorTokens = queryTokens.filter((t) => this.isColor(t));
    const keywordTokens = queryTokens.filter(
      (t) => !this.knownBrands.has(t) && !/\d/.test(t) && !this.isColor(t)
    );

    const isElectronicsQuery = queryTokens.some((t) =>
      this.electronicsKeywords.includes(t) || this.knownBrands.has(t)
    );

    // ── Rule 1: ALL brand tokens must appear in title ─────────────────
    if (brandTokens.length > 0) {
      const allBrandsMatch = brandTokens.every((brand) =>
        titleTokenSet.has(brand) || titleNorm.includes(brand)
      );
      if (!allBrandsMatch) return -1;
    }

    // ── Rule 2: ALL numeric tokens must appear in title ───────────────
    // This ensures model numbers (e.g., "14", "128gb") are strictly matched
    if (numericTokens.length > 0) {
      const allNumericMatch = numericTokens.every((num) => titleNorm.includes(num));
      if (!allNumericMatch) return -1;
    }

    // ── Rule 3: Brand + model contiguous phrase check ─────────────────
    // For queries like "iphone 16", check if the title contains the product name.
    // We check multiple brand aliases (iphone → also check apple iphone)
    if (brandTokens.length > 0 && numericTokens.length > 0) {
      // Build all possible brand+model combinations
      const brandAliases = new Map([
        ['iphone', ['iphone', 'apple iphone']],
        ['apple', ['apple', 'iphone']],
        ['samsung', ['samsung', 'galaxy']],
        ['oneplus', ['oneplus', 'one plus']],
        ['redmi', ['redmi', 'xiaomi redmi']],
        ['pixel', ['pixel', 'google pixel']],
      ]);
      
      let foundPhrase = false;
      for (const brand of brandTokens) {
        const aliases = brandAliases.get(brand) || [brand];
        for (const alias of aliases) {
          for (const num of numericTokens) {
            if (
              titleNorm.includes(`${alias} ${num}`) ||
              titleNorm.includes(`${alias}${num}`) ||
              titleNorm.includes(`${brand} ${num}`) ||
              titleNorm.includes(`${brand}${num}`)
            ) {
              foundPhrase = true;
              break;
            }
          }
          if (foundPhrase) break;
        }
        if (foundPhrase) break;
      }
      if (!foundPhrase) return -1;
    }

    // ── Rule 4: Reject accessories when looking for main product ──────
    if (isElectronicsQuery) {
      const isAccessory = this.accessoryKeywords.some((kw) => titleNorm.includes(kw));
      if (isAccessory) return -1;

      const isApparel = this.apparelKeywords.some((kw) => titleNorm.includes(kw));
      if (isApparel) return -1;
    }

    // ── Rule 5: Minimum keyword overlap ratio ─────────────────────────
    // All meaningful query tokens (non-stop) should have high overlap with title
    let matchedCount = 0;
    queryTokenSet.forEach((token) => {
      if (titleTokenSet.has(token) || titleNorm.includes(token)) {
        matchedCount++;
      }
    });

    const overlapRatio = matchedCount / queryTokenSet.size;

    // Require at least 50% overlap for short queries, 40% for long ones
    const minOverlap = queryTokenSet.size <= 3 ? 0.5 : 0.4;
    if (overlapRatio < minOverlap) return -1;

    // For queries with 1-2 small tokens, require ALL tokens to match
    if (queryTokenSet.size <= 2 && matchedCount < queryTokenSet.size) return -1;

    // ── Scoring ───────────────────────────────────────────────────────
    let score = matchedCount;

    // Bonus: exact phrase in title
    if (titleNorm.includes(queryNorm)) score += 5;

    // Bonus: color match
    if (colorTokens.length > 0) {
      const colorMatched = colorTokens.filter((c) => titleNorm.includes(c)).length;
      score += colorMatched * 1.5;
    }

    // Bonus: high overlap ratio
    score += overlapRatio * 3;

    // Bonus: brand match
    if (brandTokens.length > 0) score += 2;

    // Bonus: numeric/model match (already required, but reward it)
    if (numericTokens.length > 0) score += 2;

    return score;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SORTING
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Sort results within each platform by: price ASC → availability → source priority.
   * Also adds a `sortedAllProducts` array to the aggregated results.
   */
  applySorting(aggregatedResults) {
    const allProducts = [];

    Object.entries(aggregatedResults.platforms).forEach(([platform, data]) => {
      if (data.results && data.results.length > 0) {
        // Sort within platform
        data.results.sort((a, b) => this.compareProducts(a, b));
        // Collect for cross-platform sort
        allProducts.push(...data.results);
      }
    });

    // Cross-platform sorted list
    allProducts.sort((a, b) => this.compareProducts(a, b));
    aggregatedResults.sortedAllProducts = allProducts;
  }

  /**
   * Compare two products for sorting: price → availability → source priority
   */
  compareProducts(a, b) {
    // 1. Price ascending
    const priceA = a.price ?? Infinity;
    const priceB = b.price ?? Infinity;
    if (priceA !== priceB) return priceA - priceB;

    // 2. Availability (available first)
    const availA = a.availability === true || a.availability === 'available' ? 0 : 1;
    const availB = b.availability === true || b.availability === 'available' ? 0 : 1;
    if (availA !== availB) return availA - availB;

    // 3. Source priority
    const srcA = this.sourcePriority[a.platform || a.source] ?? 99;
    const srcB = this.sourcePriority[b.platform || b.source] ?? 99;
    return srcA - srcB;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TEXT UTILITIES
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Normalize text: lowercase, remove special chars, collapse whitespace
   */
  normalizeText(text) {
    return String(text)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Tokenize text: normalize, split, remove stop words and 1-char tokens
   */
  tokenize(text) {
    return this.normalizeText(text)
      .split(' ')
      .filter((token) => token.length > 1 && !this.stopWords.has(token));
  }

  /**
   * Check if a token is a color name
   */
  isColor(token) {
    const colors = new Set([
      'red', 'blue', 'green', 'black', 'white', 'gold', 'silver', 'grey',
      'gray', 'pink', 'purple', 'orange', 'yellow', 'brown', 'beige', 'navy',
      'teal', 'coral', 'maroon', 'cream', 'ivory', 'lavender', 'midnight',
      'space', 'starlight', 'titanium', 'graphite', 'sierra', 'alpine',
    ]);
    return colors.has(token);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HELPER: sortByPrice (for API consumers)
  // ═══════════════════════════════════════════════════════════════════════

  sortByPrice(results) {
    const allProducts = [];
    Object.entries(results.platforms).forEach(([, data]) => {
      if (data.results) allProducts.push(...data.results);
    });
    return allProducts.sort((a, b) => this.compareProducts(a, b));
  }

  filterByPriceRange(results, minPrice, maxPrice) {
    const filtered = { ...results };
    Object.keys(filtered.platforms).forEach((platform) => {
      filtered.platforms[platform].results = filtered.platforms[platform].results.filter(
        (product) => product.price >= minPrice && product.price <= maxPrice
      );
    });
    return filtered;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CACHING (optional, DB-backed)
  // ═══════════════════════════════════════════════════════════════════════

  async getCachedResults(searchQuery, maxAgeMinutes = 30) {
    try {
      const sql = `
        SELECT * FROM search_cache
        WHERE query = $1 
          AND created_at > NOW() - INTERVAL '${maxAgeMinutes} minutes'
        ORDER BY created_at DESC
      `;
      const result = await query(sql, [searchQuery.toLowerCase()]);
      if (result.rows.length > 0) {
        const cached = {};
        result.rows.forEach((row) => { cached[row.platform] = row.results; });
        return { query: searchQuery, platforms: cached, cached: true, cachedAt: result.rows[0].created_at };
      }
    } catch (error) {
      console.warn('[SearchService] Cache read error (non-fatal):', error.message);
    }
    return null;
  }

  async cacheSearchResults(searchQuery, results) {
    try {
      for (const [platform, data] of Object.entries(results.platforms)) {
        const sql = `INSERT INTO search_cache (query, platform, results) VALUES ($1, $2, $3)`;
        await query(sql, [searchQuery.toLowerCase(), platform, JSON.stringify(data.results)]);
      }
      await this.cleanupOldCache(24);
    } catch (error) {
      // Caching is optional — don't throw
      console.warn('[SearchService] Cache write error (non-fatal):', error.message);
    }
  }

  async cleanupOldCache(hours = 24) {
    try {
      await query(`DELETE FROM search_cache WHERE created_at < NOW() - INTERVAL '${hours} hours'`);
    } catch (_) { /* ignore */ }
  }
}

export default new SearchService();
