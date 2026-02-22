import express from 'express';
import searchService from '../services/searchService.js';

const router = express.Router();

/**
 * GET /api/search
 * Search for products across all platforms
 * Query params: q (search query), limit (max results per platform)
 */
router.get('/', async (req, res, next) => {
  try {
    const { q, limit = 10 } = req.query;
    
    if (!q || q.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Search query is required',
      });
    }
    
    console.log(`[Search Route] Query received: "${q}" (limit: ${limit})`);
    
    // Search all platforms
    const results = await searchService.searchAll(q.trim(), parseInt(limit));

    // Log summary
    const platformSummary = Object.entries(results.platforms || {}).map(
      ([p, d]) => `${p}: ${d.success ? d.count + ' results' : 'FAILED'}`
    ).join(', ');
    console.log(`[Search Route] Response: ${results.totalResults} total results — ${platformSummary}`);
    
    res.json({
      success: true,
      data: results,
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/search/meta/platforms
 * Get list of available platforms
 */
router.get('/meta/platforms', async (req, res, next) => {
  try {
    const platforms = searchService.getAvailablePlatforms();
    
    res.json({
      success: true,
      data: {
        platforms,
        count: platforms.length,
      },
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/search/:platform
 * Search specific platform
 * Query params: q (search query), limit (max results)
 */
router.get('/:platform', async (req, res, next) => {
  try {
    const { platform } = req.params;
    const { q, limit = 10 } = req.query;
    
    if (!q || q.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Search query is required',
      });
    }
    
    console.log(`🔍 Platform search: ${platform} - "${q}"`);
    
    const results = await searchService.searchPlatform(platform, q.trim(), parseInt(limit));
    
    res.json({
      success: true,
      data: results,
    });
    
  } catch (error) {
    next(error);
  }
});

export default router;
