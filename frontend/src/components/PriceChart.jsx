import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function PriceChart({ history }) {
  if (!history || history.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-600">No price history available yet.</p>
      </div>
    );
  }

  // Prepare data for chart (reverse to show oldest first)
  const chartData = [...history].reverse().map((entry) => ({
    date: new Date(entry.scraped_at).toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
    }),
    price: parseFloat(entry.price),
    fullDate: new Date(entry.scraped_at).toLocaleString('en-IN'),
  }));

  // Calculate stats
  const prices = history.map(h => parseFloat(h.price));
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const avgPrice = (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2);
  const currentPrice = prices[0];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-sm text-gray-600 mb-1">Current Price</p>
          <p className="text-2xl font-bold text-blue-600">₹{currentPrice.toLocaleString('en-IN')}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-600 mb-1">Lowest Price</p>
          <p className="text-2xl font-bold text-green-600">₹{minPrice.toLocaleString('en-IN')}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-600 mb-1">Highest Price</p>
          <p className="text-2xl font-bold text-red-600">₹{maxPrice.toLocaleString('en-IN')}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-600 mb-1">Average Price</p>
          <p className="text-2xl font-bold text-gray-700">₹{parseFloat(avgPrice).toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="card">
        <h3 className="text-xl font-semibold mb-4">Price History</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              domain={['dataMin - 500', 'dataMax + 500']}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white p-3 border border-gray-200 rounded shadow-lg">
                      <p className="text-sm text-gray-600">{payload[0].payload.fullDate}</p>
                      <p className="text-lg font-bold text-blue-600">
                        ₹{payload[0].value.toLocaleString('en-IN')}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line 
              type="monotone" 
              dataKey="price" 
              stroke="#3b82f6" 
              strokeWidth={2}
              dot={{ fill: '#3b82f6', r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default PriceChart;
