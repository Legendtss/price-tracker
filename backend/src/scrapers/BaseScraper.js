import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';

/**
 * BaseScraper - Abstract base class for all platform scrapers
 * Provides HTTP requests, Puppeteer browser fetch, error handling, retry logic.
 * All scrapers inherit from this and must implement search() and getProductDetails().
 */

// Shared browser instance across all scrapers to avoid repeated launches
let _sharedBrowser = null;
let _browserLaunchPromise = null;

class BaseScraper {
  constructor(platformName) {
    this.platformName = platformName;
    this.timeout = parseInt(process.env.SCRAPER_TIMEOUT || '30000');
    this.maxRetries = parseInt(process.env.MAX_RETRIES || '3');
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    ];
  }

  /**
   * Get a random user-agent string
   */
  getRandomUserAgent() {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  /**
   * Get or launch a shared Puppeteer browser instance
   */
  async getBrowser() {
    if (_sharedBrowser && _sharedBrowser.connected) {
      return _sharedBrowser;
    }
    // Prevent concurrent launches
    if (_browserLaunchPromise) {
      return _browserLaunchPromise;
    }
    _browserLaunchPromise = (async () => {
      console.log(`[BaseScraper] Launching shared Puppeteer browser...`);
      _sharedBrowser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--window-size=1920,1080',
        ],
      });
      // Auto-cleanup on disconnect
      _sharedBrowser.on('disconnected', () => {
        _sharedBrowser = null;
        _browserLaunchPromise = null;
      });
      return _sharedBrowser;
    })();
    const browser = await _browserLaunchPromise;
    _browserLaunchPromise = null;
    return browser;
  }

  /**
   * Fetch page HTML using Puppeteer (bypasses anti-bot measures)
   * Uses an incognito browser context for each request to avoid session tracking.
   * Returns the full page HTML string.
   */
  async fetchWithBrowser(url, options = {}) {
    const { waitSelector = 'body', waitTime = 3000 } = options;
    const ua = this.getRandomUserAgent();
    let page = null;
    let context = null;
    try {
      const browser = await this.getBrowser();
      // Use incognito context for clean session (no cookie/cache leakage)
      context = await browser.createBrowserContext();
      page = await context.newPage();
      await page.setUserAgent(ua);
      await page.setViewport({ width: 1920, height: 1080 });
      
      // Comprehensive anti-detection evasion
      await page.evaluateOnNewDocument(() => {
        // Remove webdriver flag
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        
        // Fix navigator.plugins (real browsers have plugins)
        Object.defineProperty(navigator, 'plugins', {
          get: () => [
            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
            { name: 'Native Client', filename: 'internal-nacl-plugin' },
          ],
        });
        
        // Fix navigator.languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en', 'hi'],
        });
        
        // Fix chrome runtime (headless Chrome lacks this)
        window.chrome = { runtime: {}, loadTimes: () => {}, csi: () => {} };
        
        // Fix permissions query
        const originalQuery = window.navigator.permissions?.query;
        if (originalQuery) {
          window.navigator.permissions.query = (parameters) =>
            parameters.name === 'notifications'
              ? Promise.resolve({ state: Notification.permission })
              : originalQuery(parameters);
        }
      });
      
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
      });

      console.log(`[${this.platformName}] Puppeteer navigating: ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.timeout });

      // Wait for content to render
      try {
        await page.waitForSelector(waitSelector, { timeout: waitTime });
      } catch (_) {
        // selector not found within time — continue with whatever loaded
      }
      // Small extra delay for JS rendering
      await this.delay(2000);

      const html = await page.content();
      console.log(`[${this.platformName}] Puppeteer fetched ${html.length} bytes from ${url}`);
      return html;
    } catch (error) {
      console.error(`[${this.platformName}] Puppeteer fetch failed:`, error.message);
      throw error;
    } finally {
      if (page) {
        try { await page.close(); } catch (_) { /* ignore */ }
      }
      if (context) {
        try { await context.close(); } catch (_) { /* ignore */ }
      }
    }
  }

  /**
   * Make HTTP request with retry logic and error handling.
   * Uses axios (fast) — call fetchWithBrowser() for bot-protected pages.
   */
  async makeRequest(url, options = {}) {
    const maxRetries = options.maxRetries ?? this.maxRetries;
    const {
      maxRetries: _ignoredMaxRetries,
      headers: customHeaders = {},
      ...axiosOptions
    } = options;

    const config = {
      url,
      method: 'GET',
      timeout: this.timeout,
      headers: {
        'User-Agent': this.getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        ...customHeaders,
      },
      ...axiosOptions,
    };

    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[${this.platformName}] HTTP attempt ${attempt}/${maxRetries}: ${url}`);
        const response = await axios(config);
        console.log(`[${this.platformName}] HTTP success (${response.status}), ${String(response.data).length} bytes`);
        return response.data;
      } catch (error) {
        lastError = error;
        const status = error.response?.status || 'N/A';
        console.error(`[${this.platformName}] HTTP attempt ${attempt} failed (status ${status}):`, error.message);
        
        if (attempt < maxRetries) {
          const waitMs = 1000 * Math.pow(2, attempt - 1);
          console.log(`[${this.platformName}] Retrying in ${waitMs}ms...`);
          await this.delay(waitMs);
        }
      }
    }

    throw new Error(`Failed to fetch from ${this.platformName} after ${maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Smart fetch: tries axios first, falls back to Puppeteer on failure.
   */
  async smartFetch(url, options = {}) {
    try {
      return await this.makeRequest(url, options);
    } catch (axiosError) {
      console.warn(`[${this.platformName}] axios failed, falling back to Puppeteer for: ${url}`);
      try {
        return await this.fetchWithBrowser(url, options);
      } catch (puppeteerError) {
        console.error(`[${this.platformName}] Both axios and Puppeteer failed for: ${url}`);
        throw new Error(`All fetch methods failed for ${this.platformName}: axios(${axiosError.message}), puppeteer(${puppeteerError.message})`);
      }
    }
  }

  /**
   * Load HTML into Cheerio for parsing
   */
  loadHTML(html) {
    return cheerio.load(html);
  }

  /**
   * Extract price from text (handles ₹, Rs, commas, etc.)
   * 
   * CRITICAL VALIDATION:
   * - Minimum price must be ₹100 (reject suspicious values like ₹1, ₹0)
   * - If text contains multiple numbers, find the one that looks like a price
   * - Returns null if parsing fails or price is invalid
   * - NEVER returns a fallback/default value
   */
  extractPrice(priceText) {
    if (priceText == null) return null;
    const str = String(priceText).trim();
    
    // Reject suspiciously short strings (likely not real prices)
    if (str.length < 2) return null;

    // ── Strategy 1: Find explicit ₹ or Rs. price pattern ──────────────
    // This is most reliable — looks for ₹ followed by digits
    const rupeePatterns = [
      /₹\s*([\d,]+(?:\.\d{1,2})?)/g,
      /Rs\.?\s*([\d,]+(?:\.\d{1,2})?)/gi,
    ];
    
    const candidatePrices = [];
    for (const pattern of rupeePatterns) {
      let match;
      while ((match = pattern.exec(str)) !== null) {
        const raw = match[1].replace(/,/g, '');
        const val = parseFloat(raw);
        if (!isNaN(val) && val >= 100) {
          candidatePrices.push(val);
        }
      }
    }
    
    // If we found explicit ₹ prices, return the lowest valid one
    // (selling price is usually lower than MRP)
    if (candidatePrices.length > 0) {
      candidatePrices.sort((a, b) => a - b);
      return candidatePrices[0];
    }

    // ── Strategy 2: Plain number extraction (for pre-cleaned inputs) ─
    // Remove currency symbols, commas, spaces. Keep digits and dots.
    const cleaned = str.replace(/[₹$,\s]/g, '').replace(/Rs\.?/gi, '').trim();
    
    // Reject if cleaning removed everything
    if (!cleaned) return null;
    
    // Handle cases like "1.499" (European-style thousand separator) vs "14.99"
    // Indian prices rarely have decimals, so dots surrounded by 3 digits are thousand seps
    const normalized = cleaned.replace(/\.(\d{3})(?!\d)/g, '$1');
    const price = parseFloat(normalized);

    // CRITICAL: Validate price is realistic (minimum ₹100)
    if (isNaN(price) || price <= 0 || price < 100) {
      console.log(`[BaseScraper] Price rejected: raw="${str.substring(0, 60)}", parsed=${price} (< ₹100)`);
      return null; // Return null, NOT a fallback value
    }
    
    return price;
  }

  /**
   * Clean and normalize product title
   */
  cleanTitle(title) {
    if (!title) return '';
    return title.trim().replace(/\s+/g, ' ').substring(0, 500);
  }

  /**
   * Delay helper for retry logic
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Search products - must be implemented by child classes
   */
  async search(query) {
    throw new Error('search() method must be implemented by child class');
  }

  /**
   * Get product details - optional, can be overridden
   */
  async getProductDetails(url) {
    throw new Error('getProductDetails() method not implemented');
  }

  /**
   * Normalize search results into the canonical product schema.
   * Every result across all scrapers uses this shape.
   * 
   * DATA STRUCTURE (STRICT):
   * {
   *   siteName: string,
   *   productTitle: string,
   *   price: number | null,
   *   currency: "INR",
   *   productUrl: string,
   *   imageUrl: string,
   *   inStock: boolean,
   *   specs: string,
   *   description: string
   * }
   */
  normalizeResults(results) {
    return results
      .filter(result => {
        // Final safety check: reject any result with invalid price
        if (!result.price || result.price < 100) {
          console.log(`[${this.platformName}] normalizeResults: rejecting "${result.title?.substring(0, 50)}" — invalid price ${result.price}`);
          return false;
        }
        return true;
      })
      .map(result => ({
        source: this.platformName,
        platform: this.platformName,
        siteName: this.platformName,
        product_name: this.cleanTitle(result.title),
        title: this.cleanTitle(result.title),
        productTitle: this.cleanTitle(result.title),
        price: result.price,
        currency: 'INR',
        product_url: result.url,
        url: result.url,
        productUrl: result.url,
        image_url: result.imageUrl || null,
        imageUrl: result.imageUrl || null,
        availability: result.availability === 'out_of_stock' ? false : true,
        inStock: result.availability !== 'out_of_stock',
        specs: result.specs || '',
        description: result.description || this.cleanTitle(result.title),
      }));
  }

  /**
   * Extract JSON-LD structured data from page HTML (used by Amazon / Flipkart)
   */
  extractJsonLd(html) {
    try {
      const $ = this.loadHTML(html);
      const jsonLdScripts = [];
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const data = JSON.parse($(el).html());
          jsonLdScripts.push(data);
        } catch (_e) { /* skip malformed */ }
      });
      return jsonLdScripts;
    } catch (error) {
      console.warn(`[${this.platformName}] JSON-LD extraction failed:`, error.message);
      return [];
    }
  }
}

export default BaseScraper;

