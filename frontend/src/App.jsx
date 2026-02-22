import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { Search, Star, TrendingUp } from 'lucide-react';
import SearchPage from './pages/SearchPage';
import TrackingPage from './pages/TrackingPage';
import HistoryPage from './pages/HistoryPage';
import './index.css';

function App() {
  return (
    <Router basename="/price-tracker">
      <div className="min-h-screen bg-gray-50">
        {/* Navigation */}
        <nav className="bg-white shadow-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-2">
                <TrendingUp className="text-blue-600" size={32} />
                <span className="text-xl font-bold text-gray-900">PriceTracker</span>
              </div>
              
              <div className="flex gap-1">
                <NavLink
                  to="/"
                  className={({ isActive }) =>
                    `px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`
                  }
                >
                  <Search size={18} /> Search
                </NavLink>
                <NavLink
                  to="/tracking"
                  className={({ isActive }) =>
                    `px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`
                  }
                >
                  <Star size={18} /> Tracked Products
                </NavLink>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main>
          <Routes>
            <Route path="/" element={<SearchPage />} />
            <Route path="/tracking" element={<TrackingPage />} />
            <Route path="/history/:productId" element={<HistoryPage />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t mt-16">
          <div className="max-w-7xl mx-auto px-4 py-8 text-center text-gray-600">
            <p>© 2024 PriceTracker - Educational Demo Project</p>
            <p className="text-sm mt-2">
              Compares prices across Amazon, Flipkart, and Myntra
            </p>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;
