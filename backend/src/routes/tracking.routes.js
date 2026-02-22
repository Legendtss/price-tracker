import express from 'express';
import trackingService from '../services/trackingService.js';

const router = express.Router();

/**
 * POST /api/track
 * Start tracking a product
 * Body: { name, platform, url, imageUrl }
 */
router.post('/', async (req, res, next) => {
  try {
    const { name, platform, url, imageUrl } = req.body;
    
    // Validation
    if (!name || !platform || !url) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, platform, url',
      });
    }
    
    console.log(`📌 Track product request: ${name} (${platform})`);
    
    const product = await trackingService.trackProduct({
      name,
      platform,
      url,
      imageUrl,
    });
    
    res.status(201).json({
      success: true,
      data: product,
      message: 'Product tracking started',
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/track
 * Get all tracked products
 */
router.get('/', async (req, res, next) => {
  try {
    const products = await trackingService.getTrackedProducts();
    
    res.json({
      success: true,
      data: {
        products,
        count: products.length,
      },
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/track/:id
 * Get specific tracked product
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await trackingService.getTrackedProduct(parseInt(id));
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }
    
    res.json({
      success: true,
      data: product,
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/track/:id
 * Stop tracking a product
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    console.log(`🗑️ Untrack product: ${id}`);
    
    const product = await trackingService.untrackProduct(parseInt(id));
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }
    
    res.json({
      success: true,
      data: product,
      message: 'Product tracking stopped',
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/track/:id/update
 * Manually update price for a product
 */
router.post('/:id/update', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    console.log(`🔄 Manual price update: ${id}`);
    
    const result = await trackingService.updateProductPrice(parseInt(id));
    
    res.json({
      success: true,
      data: result,
      message: 'Price updated successfully',
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/track/update-all
 * Update prices for all tracked products
 */
router.post('/update-all', async (req, res, next) => {
  try {
    console.log('🔄 Updating all product prices...');
    
    const results = await trackingService.updateAllPrices();
    
    res.json({
      success: true,
      data: results,
      message: 'All prices updated',
    });
    
  } catch (error) {
    next(error);
  }
});

export default router;
