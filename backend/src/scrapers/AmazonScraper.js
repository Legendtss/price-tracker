import BaseScraper from './BaseScraper.js';

/**
 * AmazonScraper - Scrapes product data from Amazon India
 *
 * Strategy:
 *   1. Puppeteer-first for search (Amazon blocks plain HTTP aggressively)
 *   2. Parse DOM with multiple selector strategies
 *   3. Fallback to axios + cheerio if Puppeteer unavailable
 *   4. Detailed logging for every step
 */
class AmazonScraper extends BaseScraper {
  constructor() {
    super('amazon');
    this.baseUrl = 'https://www.amazon.in';
    this.searchUrl = `${this.baseUrl}/s`;
  }

  /**
   * Search Amazon for products matching query.
   * Includes bot-block detection and retry logic.
   */
  async search(query, maxResults = 10) {
    // For phone/electronics queries, add category filter for better results
    const electronicsKeywords = ['iphone', 'samsung', 'galaxy', 'oneplus', 'pixel', 'redmi', 'realme', 'oppo', 'vivo', 'phone', 'mobile', 'laptop', 'tablet'];
    const isElectronics = electronicsKeywords.some(kw => query.toLowerCase().includes(kw));
    const deptParam = isElectronics ? '&i=electronics' : '';
    const searchUrl = `${this.searchUrl}?k=${encodeURIComponent(query)}${deptParam}`;
    console.log(`[Amazon] Starting search for: "${query}"${isElectronics ? ' (electronics dept)' : ''}`);
    console.log(`[Amazon] URL: ${searchUrl}`);

    let html;
    const maxAttempts = 3;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Primary: Puppeteer (bypasses anti-bot)
        html = await this.fetchWithBrowser(searchUrl, {
          waitSelector: '[data-component-type="s-search-result"], .s-result-item',
          waitTime: 5000,
        });
      } catch (puppeteerErr) {
        console.warn(`[Amazon] Puppeteer failed (attempt ${attempt}): ${puppeteerErr.message}. Trying axios...`);
        try {
          html = await this.makeRequest(searchUrl, { timeout: 15000, maxRetries: 2 });
        } catch (axiosErr) {
          console.error(`[Amazon] All fetch methods failed for search. axios: ${axiosErr.message}`);
          if (attempt >= maxAttempts) {
            throw new Error(`Amazon search failed: could not fetch search page (${axiosErr.message})`);
          }
        }
      }

      // Bot-block detection: if HTML is very small, Amazon likely returned CAPTCHA
      if (html && html.length < 5000) {
        console.warn(`[Amazon] Bot-block detected (attempt ${attempt}): only ${html.length} bytes. ` +
          (attempt < maxAttempts ? 'Retrying with fresh session...' : 'All retries exhausted.'));
        if (attempt < maxAttempts) {
          await this.delay(2000 + Math.random() * 3000); // Random delay 2-5s
          continue;
        }
      } else {
        break; // Got good response
      }
    }

    if (!html || html.length < 5000) {
      console.error(`[Amazon] Received small HTML (${html?.length || 0} bytes). Amazon is blocking automated requests.`);
      return []; // Return empty instead of throwing — other platforms can still work
    }

    const results = this.parseSearchResults(html, maxResults);
    console.log(`[Amazon] Parsed ${results.length} products for query: "${query}"`);

    if (results.length === 0) {
      console.warn(`[Amazon] 0 results parsed. HTML length: ${html.length}. Possible selector mismatch or CAPTCHA page.`);
    }

    return this.normalizeResults(results);
  }

  /**
   * Parse search results from HTML using multiple selector strategies.
   * 
   * IMPORTANT: Always parse MORE cards internally (up to 20) to ensure we find
   * relevant products. The first few cards are often sponsored/promoted items
   * that don't match the search query. Filtering happens later in SearchService.
   */
  parseSearchResults(html, maxResults) {
    const $ = this.loadHTML(html);
    const results = [];

    // Parse MORE results than requested — the relevance filter will select the best ones
    const internalLimit = Math.max(maxResults, 20);

    // Strategy 1: data-component-type="s-search-result" (standard Amazon)
    const searchCards = $('[data-component-type="s-search-result"]');
    console.log(`[Amazon] Strategy 1 (data-component-type): ${searchCards.length} cards found (parsing up to ${internalLimit})`);

    searchCards.each((index, element) => {
      if (results.length >= internalLimit) return false;

      const $el = $(element);

      // Skip sponsored/ad results that are not actual products
      const isAdOnly = $el.find('.puis-label-popover-default').length > 0 && $el.find('h2').length === 0;
      if (isAdOnly) return;

      // Title: multiple selector approaches
      const title = $el.find('h2 a span').first().text().trim() ||
                    $el.find('h2 span').first().text().trim() ||
                    $el.find('[data-cy="title-recipe"] span').first().text().trim();

      // Price: multiple approaches
      const priceOffscreen = $el.find('.a-price .a-offscreen').first().text();
      const priceWhole = $el.find('.a-price-whole').first().text();
      const priceFraction = $el.find('.a-price-fraction').first().text();
      const priceText = priceOffscreen || `${priceWhole}${priceFraction || ''}`;

      // URL
      const rawUrl = $el.find('h2 a').attr('href') ||
                     $el.find('a.a-link-normal.s-no-outline').attr('href') ||
                     $el.find('a.a-link-normal[href*="/dp/"]').attr('href');

      // Image
      const imageUrl = $el.find('img.s-image').attr('src') ||
                       $el.find('.s-image').attr('src');

      // Specs: extract from feature bullets or description
      const specs = [];
      $el.find('.a-text-bold, .a-size-base-plus').each((_, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 2 && text.length < 80 && !text.includes('\u20b9') && !/sponsored/i.test(text)) {
          specs.push(text);
        }
      });
      // Also try key-value spec pairs
      $el.find('.a-row .a-text-bold').each((_, el) => {
        const label = $(el).text().trim();
        const value = $(el).next().text().trim();
        if (label && value && label.length < 30) {
          specs.push(`${label} ${value}`);
        }
      });

      if (!title || title.length < 15 || !priceText || !rawUrl) {
        console.log(`[Amazon] Skipping card ${index}: ${!title ? 'missing title' : title.length < 15 ? `short title "${title}"` : !priceText ? 'missing price' : 'missing url'}`);
        return;
      }

      const url = this.normalizeProductUrl(rawUrl);
      const price = this.extractPrice(priceText);

      if (!price) {
        console.log(`[Amazon] Skipping "${title.substring(0, 50)}...": could not parse price from "${priceText}"`);
        return;
      }

      results.push({
        title,
        price,
        url,
        imageUrl,
        availability: 'available',
        specs: specs.slice(0, 6).join(' | '),
        description: title,
      });
    });

    // Strategy 2: Fallback to .s-result-item if Strategy 1 yields nothing
    if (results.length === 0) {
      console.log(`[Amazon] Strategy 1 yielded 0 results. Trying Strategy 2 (.s-result-item)...`);
      $('.s-result-item[data-asin]').each((index, element) => {
        if (results.length >= internalLimit) return false;
        const $el = $(element);
        const asin = $el.attr('data-asin');
        if (!asin) return;

        const title = $el.find('h2 span, h2 a span').first().text().trim();
        const priceText = $el.find('.a-price .a-offscreen, .a-price-whole').first().text();
        const rawUrl = $el.find('h2 a, a[href*="/dp/"]').attr('href');
        const imageUrl = $el.find('img').attr('src');

        if (!title || !priceText || !rawUrl) return;

        const url = this.normalizeProductUrl(rawUrl);
        const price = this.extractPrice(priceText);
        if (!price) return;

        results.push({ title, price, url, imageUrl, availability: 'available' });
      });
      console.log(`[Amazon] Strategy 2 yielded ${results.length} results`);
    }

    return results;
  }

  /**
   * Normalize Amazon links, handling sponsored/ad redirect URLs
   */
  normalizeProductUrl(rawUrl) {
    if (!rawUrl) return rawUrl;

    try {
      // Handle sponsored ad click-through URLs
      if (rawUrl.includes('/sspa/click')) {
        const fullUrl = rawUrl.startsWith('http') ? rawUrl : `${this.baseUrl}${rawUrl}`;
        const parsed = new URL(fullUrl);
        const target = parsed.searchParams.get('url');
        if (target) {
          return target.startsWith('http') ? target : `${this.baseUrl}${target}`;
        }
      }
    } catch (_) { /* fall through */ }

    if (rawUrl.startsWith('http')) return rawUrl;
    return `${this.baseUrl}${rawUrl}`;
  }

  /**
   * Get detailed product information from a product page.
   * Uses Puppeteer first, falls back to axios.
   */
  async getProductDetails(url) {
    console.log(`[Amazon] Fetching product details: ${url}`);
    let html;
    try {
      html = await this.fetchWithBrowser(url, {
        waitSelector: '#productTitle, #title',
        waitTime: 4000,
      });
    } catch (_) {
      console.warn('[Amazon] Puppeteer product fetch failed. Trying axios...');
      html = await this.makeRequest(url, { maxRetries: 2 });
    }

    const $ = this.loadHTML(html);

    const title = $('#productTitle').text().trim() ||
                  $('#title span').text().trim();
    const priceWhole = $('.a-price-whole').first().text();
    const priceFraction = $('.a-price-fraction').first().text();
    const priceOffscreen = $('span.a-price .a-offscreen').first().text();
    const imageUrl = $('#landingImage').attr('src') || $('#imgBlkFront').attr('src');
    const availability = $('#availability span').text().trim();

    const priceText = priceOffscreen || `${priceWhole}${priceFraction || ''}`;
    const price = this.extractPrice(priceText);

    console.log(`[Amazon] Product details: title="${title?.substring(0, 60)}", price=${price}, avail="${availability}"`);

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
      availability: availability.toLowerCase().includes('in stock') || availability.toLowerCase().includes('available')
        ? 'available' : 'out_of_stock',
    };
  }
}

export default AmazonScraper;
