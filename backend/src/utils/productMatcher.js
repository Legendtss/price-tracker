/**
 * ProductMatcher - Ensures strict product matching and deduplication
 * 
 * Rules:
 * - Brand must match (Apple → Apple, Samsung → Samsung)
 * - Model must match (iPhone 15 ≠ iPhone 15 Pro)
 * - Remove duplicates per website
 * - Keep best match per website
 */

class ProductMatcher {
  constructor() {
    this.brandMap = new Map([
      // Electronics
      ['apple', ['iphone', 'macbook', 'ipad', 'airpods', 'apple watch']],
      ['samsung', ['galaxy', 'samsung']],
      ['oneplus', ['oneplus']],
      ['xiaomi', ['xiaomi', 'redmi', 'poco']],
      ['realme', ['realme']],
      ['oppo', ['oppo']],
      ['vivo', ['vivo']],
      ['google', ['pixel']],
      ['motorola', ['moto', 'motorola']],
      ['nothing', ['nothing']],
      ['asus', ['asus', 'rog']],
      // Laptop
      ['dell', ['dell', 'xps', 'inspiron']],
      ['hp', ['hp', 'pavilion', 'omen']],
      ['lenovo', ['lenovo', 'thinkpad', 'yoga']],
      ['acer', ['acer', 'aspire']],
      ['msi', ['msi']],
      ['microsoft', ['surface']],
      // Wearables / Accessories
      ['sony', ['sony', 'wh-', 'wf-']],
      ['jbl', ['jbl']],
      ['bose', ['bose']],
      ['boat', ['boat']],
      ['skullcandy', ['skullcandy']],
    ]);
  }

  /**
   * Normalize product title for matching
   * - Lowercase
   * - Remove special characters
   * - Remove extra whitespace
   * - Remove common filler words
   */
  normalizeTitle(title) {
    if (!title) return '';
    return title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, '') // Remove special chars
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/\b(in|for|with|and|the|a|an|of|to|official)\b/g, '') // Remove fillers
      .trim();
  }

  /**
   * Extract brand from title
   */
  extractBrand(title) {
    const normalized = this.normalizeTitle(title);
    for (const [brand, keywords] of this.brandMap) {
      for (const keyword of keywords) {
        if (normalized.includes(keyword)) {
          return brand;
        }
      }
    }
    return null;
  }

  /**
   * Extract model identifier from title
   * Examples: "iPhone 15", "Galaxy S24", "Pixel 8 Pro"
   */
  extractModel(title) {
    const normalized = this.normalizeTitle(title);
    // Extract model patterns like "15", "s24", "8 pro", "14 plus"
    const modelMatch = normalized.match(/\b([a-z0-9]+\s+(?:pro|max|plus|ultra|standard)?)\b/);
    return modelMatch ? modelMatch[1].trim() : null;
  }

  /**
   * Score similarity between two titles (0-100)
   * Used for deduplication
   */
  calculateTitleSimilarity(title1, title2) {
    const norm1 = this.normalizeTitle(title1);
    const norm2 = this.normalizeTitle(title2);

    if (norm1 === norm2) return 100;

    // Levenshtein-like check: how many words match
    const words1 = new Set(norm1.split(' ').filter(w => w.length > 2));
    const words2 = new Set(norm2.split(' ').filter(w => w.length > 2));

    if (words1.size === 0 || words2.size === 0) return 0;

    let matches = 0;
    for (const word of words1) {
      if (words2.has(word)) matches++;
    }

    const similarity = (matches / Math.max(words1.size, words2.size)) * 100;
    return similarity;
  }

  /**
   * Check if two products are TRUE duplicates (same product listed twice).
   * Different color or storage variants are NOT duplicates.
   */
  doProductsMatch(product1, product2) {
    const title1 = product1.title || product1.product_name || '';
    const title2 = product2.title || product2.product_name || '';

    // Must have sufficient similarity in text
    const similarity = this.calculateTitleSimilarity(title1, title2);
    if (similarity < 70) return false;

    // Brand must match
    const brand1 = this.extractBrand(title1);
    const brand2 = this.extractBrand(title2);
    if (brand1 && brand2 && brand1 !== brand2) return false;

    // If titles differ in color or storage, they are DIFFERENT variants, not duplicates
    const color1 = this.extractColor(title1);
    const color2 = this.extractColor(title2);
    if (color1 && color2 && color1 !== color2) return false;

    const storage1 = this.extractStorage(title1);
    const storage2 = this.extractStorage(title2);
    if (storage1 && storage2 && storage1 !== storage2) return false;

    // Model should match (if extractable)
    const model1 = this.extractModel(title1);
    const model2 = this.extractModel(title2);
    if (model1 && model2 && model1 !== model2) return false;

    return true;
  }

  /**
   * Extract color from a product title. Returns lowercase color or null.
   */
  extractColor(title) {
    const colorPattern = /\((\w[\w\s]*?)(?:,|\))/i;
    const match = title.match(colorPattern);
    if (match) {
      const candidate = match[1].trim().toLowerCase();
      const knownColors = new Set([
        'black', 'white', 'blue', 'red', 'green', 'gold', 'silver', 'grey', 'gray',
        'pink', 'purple', 'orange', 'yellow', 'teal', 'coral', 'ultramarine',
        'midnight', 'starlight', 'titanium', 'graphite', 'sierra', 'alpine',
        'natural', 'desert', 'cream', 'ivory', 'lavender', 'bronze', 'navy',
        'space gray', 'space grey', 'rose gold',
      ]);
      if (knownColors.has(candidate)) return candidate;
    }
    return null;
  }

  /**
   * Extract storage size from a product title. Returns normalized string like "128gb" or null.
   */
  extractStorage(title) {
    const storageMatch = title.match(/(\d+)\s*(gb|tb|mb)/i);
    if (storageMatch) {
      return `${storageMatch[1]}${storageMatch[2].toLowerCase()}`;
    }
    return null;
  }

  /**
   * Deduplicate products within a website's results
   * Keeps the lower-priced option
   */
  deduplicateByWebsite(products) {
    if (!products || products.length <= 1) return products;

    const seen = [];
    const deduplicated = [];

    for (const product of products) {
      let isDuplicate = false;

      for (let i = 0; i < seen.length; i++) {
        if (this.doProductsMatch(product, seen[i])) {
          // Found a duplicate! Keep the cheaper one
          if (product.price && seen[i].price && product.price < seen[i].price) {
            deduplicated[i] = product;
            seen[i] = product;
          }
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        seen.push(product);
        deduplicated.push(product);
      }
    }

    return deduplicated;
  }

  /**
   * Get best match from multiple products
   * - Must match search query
   * - Prefer lower price
   * - Prefer in-stock
   */
  selectBestMatch(products, searchQuery) {
    if (!products || products.length === 0) return null;
    if (products.length === 1) return products[0];

    // Filter by relevance (very loose check)
    const queryWords = searchQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const titleLower = (products[0].title || '').toLowerCase();
    const hasMatch = queryWords.some(word => titleLower.includes(word));

    if (!hasMatch) return null;

    // Sort by: price (lower first) → availability (in stock first)
    return products.sort((a, b) => {
      const priceA = a.price || Infinity;
      const priceB = b.price || Infinity;
      if (priceA !== priceB) return priceA - priceB;

      const availA = (a.availability === true || a.availability === 'available') ? 0 : 1;
      const availB = (b.availability === true || b.availability === 'available') ? 0 : 1;
      return availA - availB;
    })[0];
  }
}

export default new ProductMatcher();
