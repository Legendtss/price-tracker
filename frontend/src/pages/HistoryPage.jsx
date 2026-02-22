import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PriceChart from '../components/PriceChart';
import { trackingAPI, historyAPI } from '../services/api';
import { ArrowLeft, ExternalLink } from 'lucide-react';

function HistoryPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  
  const [product, setProduct] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [productId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load product details and history in parallel
      const [productRes, historyRes] = await Promise.all([
        trackingAPI.getTrackedProduct(productId),
        historyAPI.getPriceHistory(productId, 50),
      ]);
      
      setProduct(productRes.data);
      setHistory(historyRes.data.history);
    } catch (error) {
      console.error('Failed to load data:', error);
      alert('Failed to load product history');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Loading price history...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="card text-center py-12">
          <p className="text-gray-600 text-lg">Product not found</p>
          <button onClick={() => navigate('/tracking')} className="btn btn-primary mt-4">
            Back to Tracked Products
          </button>
        </div>
      </div>
    );
  }

  const platformColors = {
    amazon: 'bg-orange-100 text-orange-800',
    flipkart: 'bg-blue-100 text-blue-800',
    myntra: 'bg-pink-100 text-pink-800',
  };

  const platformColor = platformColors[product.platform] || 'bg-gray-100 text-gray-800';

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Back Button */}
      <button
        onClick={() => navigate('/tracking')}
        className="btn btn-secondary mb-6 flex items-center gap-2"
      >
        <ArrowLeft size={16} /> Back to Tracked Products
      </button>

      {/* Product Header */}
      <div className="card mb-8">
        <div className="flex gap-4">
          {product.image_url && (
            <div className="flex-shrink-0 w-32 h-32 bg-gray-100 rounded-lg overflow-hidden">
              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>
            <div className="flex items-center gap-3 mb-3">
              <span className={`px-3 py-1 rounded text-sm font-medium ${platformColor} uppercase`}>
                {product.platform}
              </span>
              {product.latest_price && (
                <span className="text-2xl font-bold text-blue-600">
                  ₹{parseFloat(product.latest_price).toLocaleString('en-IN')}
                </span>
              )}
            </div>
            <a
              href={product.product_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary flex items-center gap-2 inline-flex"
            >
              View on {product.platform} <ExternalLink size={16} />
            </a>
          </div>
        </div>
      </div>

      {/* Price Chart */}
      <PriceChart history={history} />
    </div>
  );
}

export default HistoryPage;
