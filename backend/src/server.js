import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './config/database.js';
import searchRoutes from './routes/search.routes.js';
import trackingRoutes from './routes/tracking.routes.js';
import historyRoutes from './routes/history.routes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { apiLimiter, searchLimiter, strictLimiter } from './middleware/rateLimiter.js';
import schedulerService from './services/schedulerService.js';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Apply rate limiting
app.use('/api/', apiLimiter);

// Routes
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Price Tracker API',
    version: '1.0.0',
    endpoints: {
      search: '/api/search',
      tracking: '/api/track',
      history: '/api/history',
    },
  });
});

// API Routes
app.use('/api/search', searchLimiter, searchRoutes);
app.use('/api/track', trackingRoutes);
app.use('/api/history', historyRoutes);

// Scheduler management endpoints
app.get('/api/scheduler/status', (req, res) => {
  res.json({
    success: true,
    data: schedulerService.getStatus(),
  });
});

app.post('/api/scheduler/trigger', strictLimiter, async (req, res, next) => {
  try {
    const results = await schedulerService.triggerPriceUpdate();
    res.json({
      success: true,
      data: results,
      message: 'Price update triggered',
    });
  } catch (error) {
    next(error);
  }
});

// Error handlers (must be last)
app.use(notFound);
app.use(errorHandler);

// Start server
async function startServer() {
  let databaseConnected = false;

  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    databaseConnected = true;
    console.log('Database connection established');
  } catch (error) {
    console.error('Database connection failed, starting API in degraded mode:', error.message);
  }

  if (databaseConnected) {
    // Start scheduler only when database is available
    schedulerService.start();
  }

  // Start Express server
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`http://0.0.0.0:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    if (!databaseConnected) {
      console.log('Database is unavailable. Search endpoints work, tracking/history endpoints require PostgreSQL.');
    }
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  schedulerService.stop();
  pool.end(() => {
    console.log('Database pool closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  schedulerService.stop();
  pool.end(() => {
    console.log('Database pool closed');
    process.exit(0);
  });
});

// Start the server
startServer();

export default app;

