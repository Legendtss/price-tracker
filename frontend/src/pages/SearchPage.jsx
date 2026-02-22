import { useState } from 'react';
import SearchBar from '../components/SearchBar';
import ComparisonTable from '../components/ComparisonTable';
import { searchAPI, trackingAPI } from '../services/api';
import { Search as SearchIcon } from 'lucide-react';

function SearchPage() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (query) => {
    try {
      setLoading(true);
      setError(null);
      const response = await searchAPI.searchAll(query);
      setResults(response.data);
    } catch (err) {
      setError('Failed to search products. Please try again.');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTrack = async (product) => {
    try {
      await trackingAPI.trackProduct({
        name: product.title || product.product_name,
        platform: product.platform || product.source,
        url: product.url || product.product_url,
        imageUrl: product.imageUrl || product.image_url,
      });
      alert('Product added to tracking!');
    } catch (err) {
      if (err.response?.data?.error?.includes('duplicate')) {
        alert('This product is already being tracked!');
      } else {
        alert('Failed to track product. Please try again.');
      }
      console.error('Track error:', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">
          Price Comparison & Tracker
        </h1>
        <p className="text-lg text-gray-600">
          Compare prices across Amazon, Flipkart, and Myntra
        </p>
      </div>

      {/* Search */}
      <div className="mb-12">
        <SearchBar onSearch={handleSearch} isLoading={loading} />
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 mt-4">Searching across platforms...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="card bg-red-50 border border-red-200 text-center py-8">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Results */}
      {!loading && !error && results && (
        <ComparisonTable results={results} onTrack={handleTrack} />
      )}

      {/* Empty State */}
      {!loading && !error && !results && (
        <div className="text-center py-12">
          <SearchIcon className="mx-auto text-gray-400 mb-4" size={64} />
          <p className="text-gray-600 text-lg">
            Search for products to compare prices
          </p>
        </div>
      )}
    </div>
  );
}

export default SearchPage;
