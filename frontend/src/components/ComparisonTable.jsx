import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

function ComparisonTable({ results, onTrack }) {
  if (!results || !results.platforms) {
    return null;
  }

  // ── Platform status summary ──────────────────────────────────────────
  const platformStatuses = Object.entries(results.platforms).map(([platform, data]) => ({
    platform,
    success: data.success,
    checked: data.checked !== false,
    count: data.count || 0,
    error: data.error || null,
    durationMs: data.durationMs || null,
    rejectedCount: data.rejectedCount || 0,
  }));

  // ── Collect all products sorted by price → availability → source ────
  const allProducts = [];
  Object.entries(results.platforms).forEach(([platform, data]) => {
    if (data.results && data.results.length > 0) {
      allProducts.push(...data.results);
    }
  });

  // Sort: lowest price first → available first → Amazon > Flipkart > Myntra
  const sourcePriority = { amazon: 1, flipkart: 2, myntra: 3 };
  allProducts.sort((a, b) => {
    const priceA = a.price ?? Infinity;
    const priceB = b.price ?? Infinity;
    if (priceA !== priceB) return priceA - priceB;

    const availA = a.availability === true || a.availability === 'available' ? 0 : 1;
    const availB = b.availability === true || b.availability === 'available' ? 0 : 1;
    if (availA !== availB) return availA - availB;

    const srcA = sourcePriority[a.platform || a.source] ?? 99;
    const srcB = sourcePriority[b.platform || b.source] ?? 99;
    return srcA - srcB;
  });

  const lowestPrice = allProducts.length > 0 ? allProducts[0].price : null;

  // ── Platform status badges ───────────────────────────────────────────
  const platformColors = {
    amazon: 'border-orange-300 bg-orange-50',
    flipkart: 'border-blue-300 bg-blue-50',
    myntra: 'border-pink-300 bg-pink-50',
    croma: 'border-teal-300 bg-teal-50',
    reliance: 'border-purple-300 bg-purple-50',
  };

  return (
    <div>
      {/* Platform Status Panel */}
      <div className="mb-6 card">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Websites Checked</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {platformStatuses.map(({ platform, success, count, error, durationMs }) => {
            const colorClass = platformColors[platform] || 'border-gray-300 bg-gray-50';
            return (
              <div
                key={platform}
                className={`border rounded-lg p-3 flex items-center gap-3 ${colorClass}`}
              >
                {success ? (
                  <CheckCircle2 className="text-green-600 flex-shrink-0" size={20} />
                ) : error ? (
                  <XCircle className="text-red-500 flex-shrink-0" size={20} />
                ) : (
                  <AlertTriangle className="text-yellow-500 flex-shrink-0" size={20} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold capitalize text-gray-900">{platform}</p>
                  {success ? (
                    <p className="text-sm text-green-700">
                      {count} result{count !== 1 ? 's' : ''}
                      {durationMs != null && <span className="text-gray-500 ml-1">({(durationMs / 1000).toFixed(1)}s)</span>}
                    </p>
                  ) : (
                    <p className="text-sm text-red-600 truncate" title={error}>
                      Not available — {error || 'unknown error'}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* No results case */}
      {allProducts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-600 text-lg">No matching products found. Try a different search term.</p>
          <p className="text-sm text-gray-500 mt-2">
            All {platformStatuses.length} platforms were checked.
            {platformStatuses.filter((p) => !p.success).length > 0 &&
              ` ${platformStatuses.filter((p) => !p.success).length} platform(s) failed to respond.`}
          </p>
        </div>
      )}

      {/* Results - HORIZONTAL LAYOUT */}
      {allProducts.length > 0 && (
        <>
          {/* Summary */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Search Results for &quot;{results.query}&quot;
            </h2>
            <p className="text-gray-600 mt-1">
              Found {allProducts.length} product{allProducts.length !== 1 ? 's' : ''}
              {' '}&bull; Lowest price: <span className="font-semibold text-green-600">₹{lowestPrice.toLocaleString('en-IN')}</span>
            </p>
          </div>

          {/* Results grouped by platform — up to 5 per platform */}
          <div className="space-y-8">
            {Object.entries(results.platforms).map(([platform, data]) => {
              const products = data.results && data.results.length > 0 ? data.results : [];

              return (
                <div key={platform}>
                  {/* Platform Header */}
                  <div className="border-b-2 pb-3 mb-4 border-gray-300 flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-800 capitalize">
                        {platform}
                      </h3>
                      {!data.success && (
                        <p className="text-sm text-red-600 mt-1">
                          ❌ {data.error || 'Not available'}
                        </p>
                      )}
                      {data.success && data.count === 0 && (
                        <p className="text-sm text-yellow-600 mt-1">
                          ⚠️ No matching products
                        </p>
                      )}
                      {data.success && data.count > 0 && (
                        <p className="text-sm text-green-600 mt-1">
                          ✓ Found {data.count} result{data.count !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Product Cards (horizontal scroll) */}
                  {products.length > 0 ? (
                    <div className="overflow-x-auto pb-2">
                      <div className="flex gap-4" style={{ minWidth: 'min-content' }}>
                        {products.map((product, idx) => {
                          const isLowest = product.price === lowestPrice;
                          return (
                            <div
                              key={idx}
                              className="flex-shrink-0"
                              style={{ width: '280px', minWidth: '280px' }}
                            >
                              <div
                                className={`card border-2 h-full relative ${
                                  isLowest
                                    ? 'border-green-500 ring-2 ring-green-500'
                                    : 'border-gray-200'
                                }`}
                              >
                                {isLowest && (
                                  <div className="absolute top-0 right-0 bg-green-500 text-white px-3 py-1 rounded-bl-lg text-xs font-bold z-10">
                                    🏆 BEST PRICE
                                  </div>
                                )}

                                {/* Product Image */}
                                <div className="w-full h-36 bg-gray-100 rounded-lg overflow-hidden mb-3 flex items-center justify-center">
                                  {product.imageUrl ? (
                                    <img
                                      src={product.imageUrl}
                                      alt={product.title}
                                      className="max-w-full max-h-full object-contain p-2"
                                    />
                                  ) : (
                                    <div className="text-gray-400 text-4xl">📦</div>
                                  )}
                                </div>

                                {/* Product Title */}
                                <h4 className="font-semibold text-gray-900 text-sm line-clamp-2 mb-2">
                                  {product.title || product.product_name}
                                </h4>

                                {/* Specs / Description */}
                                {(product.specs || product.description) && (
                                  <div className="mb-3 bg-gray-50 rounded-lg p-2">
                                    {product.specs && (
                                      <div className="text-xs text-gray-600">
                                        {product.specs.split(' | ').slice(0, 4).map((spec, i) => (
                                          <span key={i} className="inline-block bg-gray-200 rounded px-2 py-0.5 mr-1 mb-1">
                                            {spec}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                    {!product.specs && product.description && product.description !== (product.title || product.product_name) && (
                                      <p className="text-xs text-gray-500 line-clamp-2">
                                        {product.description}
                                      </p>
                                    )}
                                  </div>
                                )}

                                {/* Price */}
                                <div className="mb-3">
                                  <p className="text-2xl font-bold text-gray-900">
                                    ₹{product.price?.toLocaleString('en-IN') ?? 'N/A'}
                                  </p>
                                  <p
                                    className={`text-sm font-semibold mt-1 ${
                                      product.availability === true ||
                                      product.availability === 'available'
                                        ? 'text-green-600'
                                        : 'text-red-600'
                                    }`}
                                  >
                                    {product.availability === true ||
                                    product.availability === 'available'
                                      ? '✓ In Stock'
                                      : '✗ Out of Stock'}
                                  </p>
                                </div>

                                {/* Action Buttons */}
                                <div className="space-y-2">
                                  <a
                                    href={product.url || product.product_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-primary w-full text-center text-sm block"
                                  >
                                    View on {platform}
                                  </a>
                                  <button
                                    onClick={() => onTrack(product)}
                                    className="btn btn-secondary w-full text-sm"
                                  >
                                    Track Price
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="card flex items-center justify-center min-h-32 text-center">
                      {data.success ? (
                        <div>
                          <p className="text-3xl mb-2">🔍</p>
                          <p className="text-gray-600 text-sm">No matching products found</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-3xl mb-2">❌</p>
                          <p className="text-gray-600 text-sm font-semibold">{data.error || 'Unable to fetch'}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer Note */}
          <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            <strong>💡 Note:</strong> Showing up to 5 results per platform. Scroll horizontally to see all products.
            Prices are fetched in real-time and may vary. Always verify on the actual website before purchasing.
          </div>
        </>
      )}
    </div>
  );
}

export default ComparisonTable;
