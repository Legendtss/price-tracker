import { ExternalLink, Star, Package } from 'lucide-react';

function ProductCard({ product, onTrack, isLowest = false }) {
  // Support both old schema (title, url, imageUrl) and new schema (product_name, product_url, image_url)
  const platform = product.platform || product.source || 'unknown';
  const title = product.title || product.product_name || '';
  const price = product.price;
  const currency = product.currency || 'INR';
  const url = product.url || product.product_url || '#';
  const imageUrl = product.imageUrl || product.image_url || null;
  const rawAvail = product.availability;
  const isAvailable = rawAvail === true || rawAvail === 'available';

  const platformColors = {
    amazon: 'bg-orange-100 text-orange-800',
    flipkart: 'bg-blue-100 text-blue-800',
    myntra: 'bg-pink-100 text-pink-800',
  };

  const platformColor = platformColors[platform] || 'bg-gray-100 text-gray-800';
  const currencySymbol = currency === 'INR' ? '₹' : currency;

  return (
    <div className={`card hover:shadow-lg transition-shadow duration-200 relative ${isLowest ? 'ring-2 ring-green-500' : ''}`}>
      {isLowest && (
        <div className="absolute top-0 right-0 bg-green-500 text-white px-3 py-1 rounded-bl-lg rounded-tr-lg text-sm font-semibold">
          <Star className="inline mr-1" size={14} />
          Best Price
        </div>
      )}
      
      <div className="flex gap-4">
        {/* Product Image */}
        <div className="flex-shrink-0 w-24 h-24 bg-gray-100 rounded-lg overflow-hidden">
          {imageUrl ? (
            <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="text-gray-400" size={32} />
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0 mr-2">
              <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 mb-1">
                {title}
              </h3>
              <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${platformColor} uppercase`}>
                {platform}
              </span>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">
                {currencySymbol}{price?.toLocaleString('en-IN') ?? 'N/A'}
              </p>
              <p className={`text-xs mt-1 ${isAvailable ? 'text-green-600' : 'text-red-600'}`}>
                {isAvailable ? 'In Stock' : 'Out of Stock'}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-3">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary text-sm flex items-center gap-1"
            >
              View Product <ExternalLink size={14} />
            </a>
            <button
              onClick={() => onTrack(product)}
              className="btn btn-secondary text-sm"
            >
              Track Price
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductCard;
