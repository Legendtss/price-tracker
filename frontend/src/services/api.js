import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

/**
 * Search API
 */
export const searchAPI = {
  // Search all platforms
  searchAll: async (query, limit = 10) => {
    const response = await api.get('/search', {
      params: { q: query, limit },
    });
    return response.data;
  },

  // Search specific platform
  searchPlatform: async (platform, query, limit = 10) => {
    const response = await api.get(`/search/${platform}`, {
      params: { q: query, limit },
    });
    return response.data;
  },

  // Get available platforms
  getPlatforms: async () => {
    const response = await api.get('/search/meta/platforms');
    return response.data;
  },
};

/**
 * Tracking API
 */
export const trackingAPI = {
  // Get all tracked products
  getTrackedProducts: async () => {
    const response = await api.get('/track');
    return response.data;
  },

  // Get specific tracked product
  getTrackedProduct: async (id) => {
    const response = await api.get(`/track/${id}`);
    return response.data;
  },

  // Start tracking a product
  trackProduct: async (product) => {
    const response = await api.post('/track', product);
    return response.data;
  },

  // Stop tracking a product
  untrackProduct: async (id) => {
    const response = await api.delete(`/track/${id}`);
    return response.data;
  },

  // Update price for a product
  updateProductPrice: async (id) => {
    const response = await api.post(`/track/${id}/update`);
    return response.data;
  },

  // Update all prices
  updateAllPrices: async () => {
    const response = await api.post('/track/update-all');
    return response.data;
  },
};

/**
 * History API
 */
export const historyAPI = {
  // Get price history
  getPriceHistory: async (productId, limit = 100) => {
    const response = await api.get(`/history/${productId}`, {
      params: { limit },
    });
    return response.data;
  },

  // Get price changes
  getPriceChanges: async (productId) => {
    const response = await api.get(`/history/${productId}/changes`);
    return response.data;
  },

  // Get price stats
  getPriceStats: async (productId) => {
    const response = await api.get(`/history/${productId}/stats`);
    return response.data;
  },
};

export default api;
