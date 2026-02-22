import BaseScraper from './BaseScraper.js';

/**
 * FlipkartScraper - Scrapes product data from Flipkart
 *
 * Strategy:
 *   1. Puppeteer-first (Flipkart blocks plain HTTP requests)
 *   2. Extract from embedded NEXT_DATA / page JSON when available
 *   3. DOM parsing with multiple selector strategies (class names are obfuscated)
 *   4. Fallback to axios + cheerio
 */
class FlipkartScraper extends BaseScraper {
  constructor() {
    super('flipkart');
    this.baseUrl = 'https://www.flipkart.com';
    this.searchUrl = `${this.baseUrl}/search`;
  }

  /**
   * Search Flipkart for products matching query
   */
  async search(query, maxResults = 10) {
    const searchUrl = `${this.searchUrl}?q=${encodeURIComponent(query)}`;
    console.log(`[Flipkart] Starting search for: "${query}"`);
    console.log(`[Flipkart] URL: ${searchUrl}`);

    let html;
    try {
      html = await this.fetchWithBrowser(searchUrl, {
        waitSelector: '[data-id], .cPHDOP, ._75nlfW, .tUxRFH',
        waitTime: 5000,
      });
    } catch (puppeteerErr) {
      console.warn(`[Flipkart] Puppeteer failed: ${puppeteerErr.message}. Trying axios...`);
      try {
        html = await this.makeRequest(searchUrl, { timeout: 15000, maxRetries: 2 });
      } catch (axiosErr) {
        console.error(`[Flipkart] All fetch methods failed. axios: ${axiosErr.message}`);
        throw new Error(`Flipkart search failed: could not fetch search page (${axiosErr.message})`);
      }
    }

    if (!html || html.length < 1000) {
      console.error(`[Flipkart] Received small HTML (${html?.length || 0} bytes). Possible bot block.`);
      throw new Error('Flipkart returned empty/blocked response');
    }

    // Strategy 1: Try embedded JSON data
    let results = this.extractFromEmbeddedData(html, maxResults);
    console.log(`[Flipkart] Embedded JSON extraction: ${results.length} products`);

    // Strategy 2: DOM parsing with multiple selectors
    if (results.length === 0) {
      results = this.parseSearchResultsDOM(html, maxResults);
      console.log(`[Flipkart] DOM parsing: ${results.length} products`);
    }

    console.log(`[Flipkart] Final result count for "${query}": ${results.length}`);
    if (results.length === 0) {
      console.warn(`[Flipkart] 0 results parsed. HTML length: ${html.length}. Possible selector mismatch or access issue.`);
    }

    return this.normalizeResults(results);
  }

  /**
   * Extract products from Flipkart's embedded JSON data.
   * Flipkart sometimes stores search data in __NEXT_DATA__ or inline scripts.
   */
  extractFromEmbeddedData(html, maxResults) {
    const results = [];

    // Approach 1: __NEXT_DATA__ (newer Flipkart pages)
    const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const slots = nextData?.props?.pageProps?.initialData?.searchResult?.paginationData?.slots || [];
        for (const slot of slots) {
          if (results.length >= maxResults) break;
          const widget = slot?.widget;
          if (!widget || !widget.data) continue;
          const products = widget.data.products || widget.data.data || [];
          for (const p of products) {
            if (results.length >= maxResults) break;
            const productInfo = p.productInfo?.value || p;
            const title = productInfo.title || productInfo.name || '';
            const priceObj = productInfo.price || productInfo.pricing || {};
            const price = this.extractPrice(priceObj.sellingPrice || priceObj.finalPrice || priceObj.mrp || priceObj.value);
            const relUrl = productInfo.smartUrl || productInfo.url || productInfo.baseUrl || '';
            const imageUrl = productInfo.imageUrl || (productInfo.media?.images?.[0]?.url) || '';

            if (!title || !price) continue;

            // Extract specs from embedded data
            const specsArr = [];
            if (productInfo.keySpecs) specsArr.push(...productInfo.keySpecs);
            if (productInfo.highlights) specsArr.push(...productInfo.highlights);
            if (productInfo.attributes) {
              for (const [key, val] of Object.entries(productInfo.attributes)) {
                if (typeof val === 'string' && val.length < 80) specsArr.push(`${key}: ${val}`);
              }
            }
            // Extract storage, color, RAM from title
            const storageMatch = title.match(/(\d+\s*(?:GB|TB|MB))/gi);
            if (storageMatch) specsArr.push(...storageMatch.map(s => `Storage: ${s}`));
            const colorMatch = title.match(/\((\w+(?:\s+\w+)?),/i);
            if (colorMatch) specsArr.push(`Color: ${colorMatch[1]}`);

            results.push({
              title,
              price,
              url: relUrl.startsWith('http') ? relUrl : `${this.baseUrl}${relUrl}`,
              imageUrl,
              availability: 'available',
              specs: specsArr.slice(0, 6).join(' | '),
              description: title,
            });
          }
        }
        console.log(`[Flipkart] __NEXT_DATA__ extraction: ${results.length} products`);
      } catch (e) {
        console.warn(`[Flipkart] __NEXT_DATA__ parse failed: ${e.message}`);
      }
    }

    // Approach 2: window.__INITIAL_STATE__ or similar inline JSON
    if (results.length === 0) {
      const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});?\s*<\/script>/);
      if (stateMatch) {
        try {
          const state = JSON.parse(stateMatch[1]);
          // Navigate the state tree to find products
          const searchResponse = state?.searchResponse?.results || state?.pageDataV4?.page?.data || [];
          for (const item of Object.values(searchResponse).flat()) {
            if (results.length >= maxResults) break;
            if (!item || typeof item !== 'object') continue;
            const title = item.title || item.productName || '';
            const price = this.extractPrice(item.sellingPrice || item.finalPrice || item.mrp);
            const url = item.url || item.smartUrl || '';
            const imageUrl = item.imageUrl || item.image || '';
            if (title && price) {
              results.push({
                title,
                price,
                url: url.startsWith('http') ? url : `${this.baseUrl}${url}`,
                imageUrl,
                availability: 'available',
              });
            }
          }
        } catch (e) {
          console.warn(`[Flipkart] __INITIAL_STATE__ parse failed: ${e.message}`);
        }
      }
    }

    return results;
  }

  /**
   * Parse search results from DOM using a STRUCTURAL approach.
   * Does NOT depend on obfuscated class names which change frequently.
   * 
   * Strategy: Find product links (a[href*="/p/"]), walk UP the DOM to find
   * the product card container, then extract title and price from within.
   */
  parseSearchResultsDOM(html, maxResults) {
    const $ = this.loadHTML(html);
    const results = [];
    const seenUrls = new Set();

    // UI text that should never be a product title
    const uiTextBlacklist = /^(add to|compare|view|buy now|shop|see all|more|show|log\s*in|sign\s*up|filters?|sort|wishlist|cart)/i;

    // ── Step 1: Collect ALL unique product links ─────────────────────
    const allProductLinks = $('a[href*="/p/"], a[href*="/dl/"]');
    console.log(`[Flipkart] DOM: Found ${allProductLinks.length} product links`);

    allProductLinks.each((_, linkEl) => {
      if (results.length >= maxResults) return false;

      const $link = $(linkEl);
      const href = $link.attr('href');
      if (!href) return;
      const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

      // Skip duplicate URLs
      const urlKey = fullUrl.replace(/\?.*$/, ''); // strip query params for dedup
      if (seenUrls.has(urlKey)) return;
      seenUrls.add(urlKey);

      // ── TITLE: Try multiple sources ─────────────────────────────────
      let title = '';

      // Source 1: link's title attribute
      const titleAttr = $link.attr('title') || '';
      if (titleAttr.length > 5 && !uiTextBlacklist.test(titleAttr)) {
        title = titleAttr;
      }

      // Source 2: text in the link itself (often the product name)
      if (!title) {
        const linkText = $link.text().trim();
        // Only use if it looks like a product name, not a price or UI element
        if (linkText.length > 5 && linkText.length < 300 
            && !uiTextBlacklist.test(linkText)
            && !/^₹/.test(linkText)) {
          // If link text is too long (contains ratings, prices, etc), try to extract just the first line
          const firstLine = linkText.split('\n')[0].trim();
          if (firstLine.length > 5 && firstLine.length < 200) {
            title = firstLine;
          } else {
            title = linkText.substring(0, 200);
          }
        }
      }

      // Source 3: img alt text inside the link
      if (!title) {
        const imgAlt = $link.find('img').attr('alt') || '';
        if (imgAlt.length > 5 && !uiTextBlacklist.test(imgAlt)) {
          title = imgAlt;
        }
      }

      // Skip if no usable title
      if (!title || title.length < 5 || uiTextBlacklist.test(title)) return;

      // ── PRICE: Walk UP the DOM to find the card container with ₹ ───
      let priceText = '';
      let $card = null;
      let $current = $link.parent();

      for (let depth = 0; depth < 10; depth++) {
        if (!$current.length || $current.is('body')) break;
        const containerText = $current.text();
        if (containerText.includes('₹')) {
          $card = $current;
          break;
        }
        $current = $current.parent();
      }

      if (!$card) return;

      // Find the SMALLEST/most-specific element containing a ₹ price
      // This avoids grabbing the entire card text
      const priceCandidates = [];
      $card.find('*').each((_, el) => {
        const $el = $(el);
        // Get only THIS element's own text (not children)
        const ownText = $el.clone().children().remove().end().text().trim();
        if (!ownText || !ownText.includes('₹') || ownText.length > 40) return;
        const priceMatch = ownText.match(/₹\s*([\d,]+(?:\.\d{1,2})?)/);
        if (priceMatch) {
          const val = parseFloat(priceMatch[1].replace(/,/g, ''));
          if (!isNaN(val) && val >= 100) {
            priceCandidates.push({ text: ownText, value: val, length: ownText.length });
          }
        }
      });

      if (priceCandidates.length === 0) return;

      // Sort by length (smallest = most specific), then by value (lowest = selling price)
      priceCandidates.sort((a, b) => a.length - b.length || a.value - b.value);
      priceText = priceCandidates[0].text;

      // ── IMAGE ──────────────────────────────────────────────────────
      const imageUrl =
        $card.find('img[src*="rukminim"]').attr('src') ||
        $card.find('img[src*="img"]').attr('src') ||
        $link.find('img').attr('src') ||
        $card.find('img').first().attr('src') ||
        '';

      // ── SPECS ──────────────────────────────────────────────────────
      const specs = this.extractSpecs($, $card);

      // ── PRICE PARSING ──────────────────────────────────────────────
      const price = this.extractPrice(priceText);
      if (!price) return;

      // ── TITLE CLEANUP ──────────────────────────────────────────────
      const cleanedTitle = title
        .replace(/\d+\.\d+\s*★.*$/i, '')
        .replace(/\d+\s*ratings?.*$/i, '')
        .replace(/\d+\s*reviews?.*$/i, '')
        .replace(/₹[\d,]+.*$/i, '')
        .replace(/\d+%\s*off.*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (cleanedTitle.length < 5) return;

      console.log(`[Flipkart] ✓ Parsed: "${cleanedTitle.substring(0, 60)}" @ ₹${price}`);

      results.push({
        title: cleanedTitle.substring(0, 500),
        price,
        url: fullUrl,
        imageUrl,
        availability: 'available',
        specs: specs || '',
        description: cleanedTitle,
      });
    });

    return results;
  }

  /**
   * Extract product data from a single DOM element.
   * 
   * CRITICAL: Must extract price from ONLY the price node, not from 
   * parent containers that include ratings, reviews, and discount text.
   * Must extract title from ONLY the title node, not the entire card text.
   */
  extractFromElement($, $el) {
    // ── TITLE EXTRACTION ────────────────────────────────────────────
    // Use the most specific selector first. NEVER use .text() on the entire card.
    let title = '';
    
    // Strategy 1: Title from anchor's title attribute (most reliable)
    const titleAttr = $el.find('a[title]').attr('title');
    if (titleAttr && titleAttr.length > 5) {
      title = titleAttr;
    }
    
    // Strategy 2: Known Flipkart title class selectors (specific to title element only)
    if (!title) {
      const titleSelectors = [
        '._4rR01T',     // Standard product title
        '.s1Q9rs',      // Alternate product title
        '.WKTcLC',      // Grid product title  
        '.wjcEIp',      // Another title variant
        '.KzDlHZ',      // 2025+ title class
        '.Xpx0MJ',      // New layout title
      ];
      for (const sel of titleSelectors) {
        const found = $el.find(sel).first().text().trim();
        if (found && found.length > 5) {
          title = found;
          break;
        }
      }
    }
    
    // Strategy 3: Look for a product link that has meaningful text
    if (!title) {
      const productLink = $el.find('a[href*="/p/"]').first();
      if (productLink.length) {
        // Get ONLY the direct text children of the link, not nested elements
        const linkTitle = productLink.attr('title') || '';
        if (linkTitle.length > 5) {
          title = linkTitle;
        } else {
          // Try getting text from span children only (not the full subtree)
          const spans = productLink.find('span, div').filter((_, el) => {
            const text = $(el).text().trim();
            // Must look like a product name: > 10 chars, no ₹ symbol, no rating patterns
            return text.length > 10 && !text.includes('₹') && !/^\d+\.\d+/.test(text) && !/rating/i.test(text);
          });
          if (spans.length > 0) {
            title = spans.first().text().trim();
          }
        }
      }
    }
    
    // Strategy 4: Generic class-based title (avoid grabbing entire card text)
    if (!title) {
      const genericTitle = $el.find('[class*="title"], [class*="Title"]').first();
      if (genericTitle.length) {
        const text = genericTitle.text().trim();
        // Only accept if it looks like a product title (no price symbols, reasonable length)
        if (text.length > 5 && text.length < 300 && !text.includes('₹') && !/\d+%\s*off/i.test(text)) {
          title = text;
        }
      }
    }

    // ── PRICE EXTRACTION ─────────────────────────────────────────────
    // CRITICAL: Extract price from ONLY the dedicated price element.
    // NEVER use div:contains("₹") as it matches parent containers with all text.
    let priceText = '';
    
    // Strategy 1: Known Flipkart price class selectors (most reliable)
    const priceSelectors = [
      '._30jeq3',              // Standard price element
      '.Nx9bqj',              // 2025+ price class  
      '._1_WHN1',             // Alternate price
      '[class*="sellingPrice"]', // Selling price
    ];
    
    for (const sel of priceSelectors) {
      const found = $el.find(sel).first().text().trim();
      if (found && found.includes('₹')) {
        priceText = found;
        break;
      }
    }
    
    // Strategy 2: Find the most specific element containing ₹ sign
    // Walk the DOM to find the SMALLEST element with a ₹ price
    if (!priceText) {
      const priceElements = [];
      $el.find('*').each((_, el) => {
        const $child = $(el);
        const text = $child.clone().children().remove().end().text().trim();
        // Must be a leaf-ish element with just a price
        if (text && text.includes('₹') && text.length < 30) {
          // Verify it looks like a price (₹ followed by digits)
          const priceMatch = text.match(/₹[\s]*([\d,]+(?:\.\d{1,2})?)/)
          if (priceMatch) {
            priceElements.push({ text, length: text.length });
          }
        }
      });
      // Pick the shortest (most specific) price element
      if (priceElements.length > 0) {
        priceElements.sort((a, b) => a.length - b.length);
        priceText = priceElements[0].text;
      }
    }

    // ── URL ───────────────────────────────────────────────────────────
    const rawUrl =
      $el.find('a[href*="/p/"]').attr('href') ||
      $el.find('a[href*="/dl/"]').attr('href') ||
      $el.find('a').first().attr('href') ||
      '';

    // ── IMAGE ─────────────────────────────────────────────────────────
    const imageUrl =
      $el.find('img[src*="img"]').attr('src') ||
      $el.find('img').first().attr('src') ||
      '';

    // ── SPECS EXTRACTION ──────────────────────────────────────────────
    const specs = this.extractSpecs($, $el);

    // ── VALIDATION ────────────────────────────────────────────────────
    if (!title || title.length < 5) {
      console.log(`[Flipkart] Skipping element: title too short ("${title?.substring(0, 30)}")`);  
      return null;
    }
    if (!priceText) {
      console.log(`[Flipkart] Skipping "${title.substring(0, 40)}": no price found`);
      return null;
    }
    if (!rawUrl) {
      console.log(`[Flipkart] Skipping "${title.substring(0, 40)}": no URL found`);
      return null;
    }

    const price = this.extractPrice(priceText);
    if (!price) {
      console.log(`[Flipkart] Skipping "${title.substring(0, 40)}": invalid price "${priceText}"`);
      return null;
    }

    // Clean title: remove any trailing junk like ratings or discount text
    const cleanedTitle = title
      .replace(/\d+\.\d+\s*★.*$/i, '')        // Remove "4.6 ★ ..." trailing text
      .replace(/\d+\s*ratings?.*$/i, '')       // Remove "4,397 Ratings..."
      .replace(/\d+\s*reviews?.*$/i, '')       // Remove "229 Reviews..."
      .replace(/₹[\d,]+.*$/i, '')              // Remove any trailing price
      .replace(/\d+%\s*off.*$/i, '')           // Remove "6% off"
      .replace(/\s+/g, ' ')
      .trim();

    return {
      title: cleanedTitle.substring(0, 500),
      price,
      url: rawUrl.startsWith('http') ? rawUrl : `${this.baseUrl}${rawUrl}`,
      imageUrl,
      availability: 'available',
      specs: specs || '',
      description: cleanedTitle,
    };
  }

  /**
   * Extract product specs from a Flipkart search result element
   */
  extractSpecs($, $el) {
    const specs = [];
    
    // Look for spec list items (Flipkart uses li elements for specs)
    $el.find('li, [class*="spec"], [class*="feature"]').each((_, el) => {
      const text = $(el).text().trim();
      // Only include short spec-like text (not full descriptions)
      if (text && text.length > 3 && text.length < 100 && !text.includes('₹') && !/rating/i.test(text)) {
        specs.push(text);
      }
    });
    
    // Extract storage/RAM/color from title if not in specs  
    return specs.slice(0, 6).join(' | ');
  }

  /**
   * Get detailed product information from product page
   */
  async getProductDetails(url) {
    console.log(`[Flipkart] Fetching product details: ${url}`);
    let html;
    try {
      html = await this.fetchWithBrowser(url, {
        waitSelector: '.B_NuCI, .VU-ZEz, h1',
        waitTime: 4000,
      });
    } catch (_) {
      console.warn('[Flipkart] Puppeteer product fetch failed. Trying axios...');
      html = await this.makeRequest(url, { maxRetries: 2 });
    }

    const $ = this.loadHTML(html);

    const title =
      $('span.B_NuCI').first().text().trim() ||
      $('h1.yhB1nd').first().text().trim() ||
      $('h1.VU-ZEz').first().text().trim() ||
      $('h1').first().text().trim();

    const priceText =
      $('div._30jeq3').first().text() ||
      $('div[class*="price"]').first().text() ||
      '';

    const imageUrl =
      $('img._396cs4').first().attr('src') ||
      $('img._2r_T1I').first().attr('src') ||
      $('img[src*="img1a.flixcart"]').first().attr('src') ||
      '';

    const availability = $('div._16FRp0').text().trim();
    const price = this.extractPrice(priceText);

    console.log(`[Flipkart] Product details: title="${title?.substring(0, 60)}", price=${price}`);

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
      availability: availability.toLowerCase().includes('sold out') ? 'out_of_stock' : 'available',
    };
  }
}

export default FlipkartScraper;
