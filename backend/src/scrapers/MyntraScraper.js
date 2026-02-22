import BaseScraper from './BaseScraper.js';

/**
 * MyntraScraper - Scrapes product data from Myntra
 *
 * Strategy:
 *   1. Puppeteer-first (Myntra is a React SPA with strong anti-bot)
 *   2. Extract from embedded window.__myx JSON (most reliable)
 *   3. Fallback to DOM selectors
 *   4. Detailed logging for every step
 */
class MyntraScraper extends BaseScraper {
  constructor() {
    super('myntra');
    this.baseUrl = 'https://www.myntra.com';
  }

  /**
   * Search Myntra for products matching query
   */
  async search(query, maxResults = 10) {
    // Myntra's search URL encodes spaces as hyphens for the path segment
    const querySlug = query.toLowerCase().replace(/\s+/g, '-');
    const searchUrl = `${this.baseUrl}/${encodeURIComponent(querySlug)}?rawQuery=${encodeURIComponent(query)}`;
    console.log(`[Myntra] Starting search for: "${query}"`);
    console.log(`[Myntra] URL: ${searchUrl}`);

    let html;
    try {
      // Myntra is a full SPA — Puppeteer is practically required
      html = await this.fetchWithBrowser(searchUrl, {
        waitSelector: '.product-base, .search-searchProductsContainer',
        waitTime: 5000,
      });
    } catch (puppeteerErr) {
      console.warn(`[Myntra] Puppeteer failed: ${puppeteerErr.message}. Trying axios...`);
      try {
        html = await this.makeRequest(searchUrl, {
          timeout: 30000,
          maxRetries: 2,
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Referer': this.baseUrl,
          },
        });
      } catch (axiosErr) {
        console.error(`[Myntra] All fetch methods failed. axios: ${axiosErr.message}`);
        throw new Error(`Myntra search failed: could not fetch search page (${axiosErr.message})`);
      }
    }

    if (!html || html.length < 500) {
      console.error(`[Myntra] Received small HTML (${html?.length || 0} bytes). Possible bot block.`);
      throw new Error('Myntra returned empty/blocked response');
    }

    // Strategy 1: Embedded JSON (window.__myx or similar)
    let results = this.extractFromEmbeddedSearchData(html, maxResults);
    console.log(`[Myntra] Embedded JSON extraction: ${results.length} products`);

    // Strategy 2: DOM parsing
    if (results.length === 0) {
      results = this.parseSearchResultsDOM(html, maxResults);
      console.log(`[Myntra] DOM parsing: ${results.length} products`);
    }

    console.log(`[Myntra] Final result count for "${query}": ${results.length}`);
    if (results.length === 0) {
      console.warn(`[Myntra] 0 results parsed. HTML length: ${html.length}. Possible selector mismatch.`);
    }

    return this.normalizeResults(results);
  }

  /**
   * Extract from Myntra's embedded search data (window.__myx).
   * Multiple regex patterns to handle variations.
   */
  extractFromEmbeddedSearchData(html, maxResults) {
    // Try multiple patterns for embedded data
    const patterns = [
      /window\.__myx\s*=\s*(\{[\s\S]*?\});\s*<\/script>/,
      /window\.__myx\s*=\s*(\{[\s\S]*?\})<\/script>/,
      /"searchData"\s*:\s*(\{[\s\S]*?"products"\s*:\s*\[[\s\S]*?\]\s*\})/,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (!match) continue;

      try {
        const payload = JSON.parse(match[1]);
        const products = payload?.searchData?.results?.products ||
                         payload?.results?.products ||
                         payload?.products ||
                         [];

        if (products.length === 0) continue;

        const results = products.slice(0, maxResults).map((product) => {
          const brand = product.brand || '';
          const name = product.productName || product.product || product.name || '';
          const title = `${brand} ${name}`.trim();
          const price = this.extractPrice(
            product.discountedPrice ?? product.price ?? product.mrp
          );
          const landingPath = product.landingPageUrl || product.url || '';
          const imageUrl = product.searchImage || product.image || product.defaultImage || null;

          return {
            title,
            price,
            url: landingPath.startsWith('http')
              ? landingPath
              : `${this.baseUrl}/${landingPath.replace(/^\/+/, '')}`,
            imageUrl,
            availability: (product.inventoryInfo?.[0]?.available !== false) ? 'available' : 'out_of_stock',
            specs: [
              product.category || '',
              product.subCategory || '',
              product.articleType || '',
              product.baseColour ? `Color: ${product.baseColour}` : '',
              product.season ? `Season: ${product.season}` : '',
            ].filter(Boolean).slice(0, 4).join(' | '),
            description: `${brand} ${name} - ${product.articleType || product.category || ''}`.trim(),
          };
        }).filter((item) => item.title && item.price && item.url);

        if (results.length > 0) {
          console.log(`[Myntra] Embedded JSON yielded ${results.length} products`);
          return results;
        }
      } catch (error) {
        console.warn(`[Myntra] Embedded JSON parse failed with pattern:`, error.message);
      }
    }

    return [];
  }

  /**
   * Parse search results from DOM with multiple selector strategies
   */
  parseSearchResultsDOM(html, maxResults) {
    const $ = this.loadHTML(html);
    const results = [];

    // Strategy A: .product-base containers (consistently used)
    const productBases = $('.product-base');
    console.log(`[Myntra] DOM .product-base elements: ${productBases.length}`);

    productBases.each((index, element) => {
      if (results.length >= maxResults) return false;

      const $el = $(element);
      const brand = $el.find('.product-brand').first().text().trim();
      const productName = $el.find('.product-productMetaInfo .product-product, .product-productName')
        .first().text().trim();
      const title = `${brand} ${productName}`.trim();

      const priceText =
        $el.find('.product-discountedPrice').first().text() ||
        $el.find('.product-price .product-discountedPrice').first().text() ||
        $el.find('.product-price').first().text();

      const rawUrl = $el.find('a').attr('href') || '';
      const imageUrl =
        $el.find('img.img-responsive').attr('src') ||
        $el.find('img').first().attr('src') || '';

      if (!title || title.length < 3 || !priceText) return;

      const price = this.extractPrice(priceText);
      if (!price) return;

      results.push({
        title,
        price,
        url: rawUrl.startsWith('http') ? rawUrl : `${this.baseUrl}/${rawUrl.replace(/^\/+/, '')}`,
        imageUrl,
        availability: 'available',
      });
    });

    // Strategy B: .product-productMetaInfo as top-level
    if (results.length === 0) {
      $('.product-productMetaInfo').each((index, element) => {
        if (results.length >= maxResults) return false;
        const $el = $(element);
        const brand = $el.find('.product-brand').text().trim();
        const name = $el.find('.product-product').text().trim();
        const title = `${brand} ${name}`.trim();
        const priceText = $el.find('.product-discountedPrice, .product-price').first().text();
        const url = $el.closest('a').attr('href') || '';
        const imageUrl = $el.closest('.product-base').find('img').attr('src') || '';

        if (!title || !priceText) return;
        const price = this.extractPrice(priceText);
        if (!price) return;

        results.push({
          title,
          price,
          url: url.startsWith('http') ? url : `${this.baseUrl}/${url.replace(/^\/+/, '')}`,
          imageUrl,
          availability: 'available',
        });
      });
    }

    return results;
  }

  /**
   * Get detailed product information from product page
   */
  async getProductDetails(url) {
    console.log(`[Myntra] Fetching product details: ${url}`);
    let html;
    try {
      html = await this.fetchWithBrowser(url, {
        waitSelector: '.pdp-title, .pdp-name',
        waitTime: 4000,
      });
    } catch (_) {
      console.warn('[Myntra] Puppeteer product fetch failed. Trying axios...');
      html = await this.makeRequest(url, {
        maxRetries: 2,
        headers: { 'Referer': this.baseUrl },
      });
    }

    const $ = this.loadHTML(html);

    const brand = $('.pdp-title').first().text().trim();
    const productName = $('.pdp-name').first().text().trim();
    const title = `${brand} ${productName}`.trim();

    const priceText =
      $('.pdp-price strong').first().text() ||
      $('.pdp-discountedPrice').first().text() ||
      $('.pdp-price').first().text();

    const imageUrl =
      $('.image-grid-image').first().attr('src') ||
      $('img.image-grid-image').first().attr('style')?.match(/url\((.+?)\)/)?.[1] ||
      '';

    const price = this.extractPrice(priceText);

    console.log(`[Myntra] Product details: title="${title?.substring(0, 60)}", price=${price}`);

    return {
      source: this.platformName,
      platform: this.platformName,
      product_name: this.cleanTitle(title),
      title: this.cleanTitle(title),
      price,
      currency: 'INR',
      product_url: url,
      url,
      image_url: imageUrl,
      imageUrl,
      availability: 'available',
    };
  }
}

export default MyntraScraper;
