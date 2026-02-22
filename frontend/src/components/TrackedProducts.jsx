import { useState, useEffect } from 'react';
import { ExternalLink, Trash2, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { trackingAPI } from '../services/api';

function TrackedProducts({ onViewHistory }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await trackingAPI.getTrackedProducts();
      setProducts(response.data.products);
    } catch (error) {
      console.error('Failed to load tracked products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUntrack = async (id) => {
    if (!confirm('Stop tracking this product?')) return;

    try {
      await trackingAPI.untrackProduct(id);
      setProducts(products.filter(p => p.id !== id));
    } catch (error) {
      console.error('Failed to untrack product:', error);
      alert('Failed to untrack product');
    }
  };

  const handleUpdate = async (id) => {
    try {
      setUpdating(id);
      await trackingAPI.updateProductPrice(id);
      await loadProducts(); // Reload to get updated price
    } catch (error) {
      console.error('Failed to update price:', error);
      alert('Failed to update price');
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Loading tracked products...</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-600 text-lg mb-2">No products tracked yet</p>
        <p className="text-gray-500 text-sm">Start by searching for products and clicking "Track Price"</p>
      </div>
    );
  }

  const platformColors = {
    amazon: 'bg-orange-100 text-orange-800',
    flipkart: 'bg-blue-100 text-blue-800',
    myntra: 'bg-pink-100 text-pink-800',
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Tracked Products</h2>
          <p className="text-gray-600 mt-1">Monitoring {products.length} products</p>
        </div>
        <button
          onClick={loadProducts}
          className="btn btn-secondary flex items-center gap-2"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="grid gap-4">
        {products.map((product) => {
          const platformColor = platformColors[product.platform] || 'bg-gray-100 text-gray-800';
          
          return (
            <div key={product.id} className="card hover:shadow-lg transition-shadow">
              <div className="flex gap-4">
                {/* Image */}
                <div className="flex-shrink-0 w-20 h-20 bg-gray-100 rounded-lg overflow-hidden">
                  {product.image_url && (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0 mr-2">
                      <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 mb-1">
                        {product.name}
                      </h3>
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${platformColor} uppercase`}>
                        {product.platform}
                      </span>
                    </div>
                    <div className="text-right">
                      {product.latest_price ? (
                        <>
                          <p className="text-2xl font-bold text-gray-900">
                            ₹{parseFloat(product.latest_price).toLocaleString('en-IN')}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(product.last_checked).toLocaleDateString('en-IN')}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-gray-500">No price data</p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => onViewHistory(product.id)}
                      className="btn btn-primary text-sm"
                    >
                      View History
                    </button>
                    <a
                      href={product.product_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary text-sm flex items-center gap-1"
                    >
                      <ExternalLink size={14} /> View
                    </a>
                    <button
                      onClick={() => handleUpdate(product.id)}
                      disabled={updating === product.id}
                      className="btn btn-secondary text-sm flex items-center gap-1"
                    >
                      <RefreshCw size={14} className={updating === product.id ? 'animate-spin' : ''} />
                      {updating === product.id ? 'Updating...' : 'Update'}
                    </button>
                    <button
                      onClick={() => handleUntrack(product.id)}
                      className="btn btn-danger text-sm flex items-center gap-1"
                    >
                      <Trash2 size={14} /> Untrack
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TrackedProducts;
