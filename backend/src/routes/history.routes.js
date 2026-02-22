import express from 'express';
import trackingService from '../services/trackingService.js';

const router = express.Router();

/**
 * GET /api/history/:productId
 * Get price history for a product
 * Query params: limit (number of records)
 */
router.get('/:productId', async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { limit = 100 } = req.query;
    
    console.log(`📊 Price history request: Product ${productId}`);
    
    const history = await trackingService.getPriceHistory(
      parseInt(productId),
      parseInt(limit)
    );
    
    res.json({
      success: true,
      data: history,
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/history/:productId/changes
 * Get price changes for a product
 */
router.get('/:productId/changes', async (req, res, next) => {
  try {
    const { productId } = req.params;
    
    console.log(`📈 Price changes request: Product ${productId}`);
    
    const changes = await trackingService.getPriceChanges(parseInt(productId));
    
    res.json({
      success: true,
      data: {
        productId: parseInt(productId),
        changes,
        count: changes.length,
      },
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/history/:productId/stats
 * Get price statistics for a product
 */
router.get('/:productId/stats', async (req, res, next) => {
  try {
    const { productId } = req.params;
    
    const history = await trackingService.getPriceHistory(parseInt(productId), 1000);
    
    res.json({
      success: true,
      data: history.stats,
    });
    
  } catch (error) {
    next(error);
  }
});

export default router;
