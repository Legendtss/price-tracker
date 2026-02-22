# 🛒 Price Tracker & Comparison App

A full-stack web application that allows users to search for products and compare prices across multiple Indian e-commerce platforms (Amazon, Flipkart, Myntra). Track products and monitor price changes over time.

## ✨ Features

### 🔍 Product Search
- Search products across Amazon, Flipkart, and Myntra simultaneously
- Real-time price comparison
- Automatic lowest price detection
- Clean, responsive UI

### 📊 Price Tracking
- Track products of interest
- Automatic price updates via scheduled jobs
- Price history visualization with charts
- Price statistics (min, max, average)

### 📈 Price History
- View historical price trends
- Interactive charts using Recharts
- Identify price drops and increases
- Make informed purchasing decisions

## 🏗️ Architecture

### Backend (Node.js + Express + PostgreSQL)
```
backend/
├── src/
│   ├── config/          # Database and configuration
│   ├── models/          # Database models
│   ├── scrapers/        # Platform-specific scrapers
│   ├── services/        # Business logic
│   ├── routes/          # API endpoints
│   ├── middleware/      # Error handling, rate limiting
│   └── server.js        # Main server file
├── migrations/          # Database schema
└── package.json
```

### Frontend (React + Vite + Tailwind CSS)
```
frontend/
├── src/
│   ├── components/      # Reusable UI components
│   ├── pages/           # Page components
│   ├── services/        # API client
│   ├── App.jsx          # Main app component
│   └── main.jsx         # Entry point
├── index.html
└── package.json
```

## 🚀 Setup & Installation

### Prerequisites
- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)
- npm or yarn

### 1. Clone the Repository
```bash
git clone <repository-url>
cd price-tracker
```

### 2. Backend Setup

#### Install Dependencies
```bash
cd backend
npm install
```

#### Configure Environment Variables
```bash
cp .env.example .env
```

Edit `.env` file:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=price_tracker
DB_USER=postgres
DB_PASSWORD=your_password_here

PORT=5000
NODE_ENV=development

SCRAPER_TIMEOUT=30000
MAX_RETRIES=3
USER_AGENT=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

PRICE_UPDATE_SCHEDULE=0 */6 * * *
```

#### Setup Database

1. Create PostgreSQL database:
```bash
createdb price_tracker
```

2. Run migrations:
```bash
psql -U postgres -d price_tracker -f migrations/init.sql
```

Or using psql:
```bash
psql -U postgres
CREATE DATABASE price_tracker;
\c price_tracker
\i migrations/init.sql
```

#### Start Backend Server
```bash
npm run dev
```

Server will start on `http://localhost:5000`

### 3. Frontend Setup

#### Install Dependencies
```bash
cd frontend
npm install
```

#### Start Development Server
```bash
npm run dev
```

Frontend will start on `http://localhost:3000`

## 📡 API Endpoints

### Search
- `GET /api/search?q={query}&limit={limit}` - Search all platforms
- `GET /api/search/:platform?q={query}` - Search specific platform
- `GET /api/search/meta/platforms` - Get available platforms

### Tracking
- `GET /api/track` - Get all tracked products
- `GET /api/track/:id` - Get specific tracked product
- `POST /api/track` - Start tracking a product
- `DELETE /api/track/:id` - Stop tracking a product
- `POST /api/track/:id/update` - Update product price
- `POST /api/track/update-all` - Update all tracked products

### History
- `GET /api/history/:productId` - Get price history
- `GET /api/history/:productId/changes` - Get price changes
- `GET /api/history/:productId/stats` - Get price statistics

### Scheduler
- `GET /api/scheduler/status` - Get scheduler status
- `POST /api/scheduler/trigger` - Manually trigger price update

## 🔧 Configuration

### Adding New Platforms

1. Create a new scraper in `backend/src/scrapers/`:

```javascript
import BaseScraper from './BaseScraper.js';

class NewPlatformScraper extends BaseScraper {
  constructor() {
    super('newplatform');
    this.baseUrl = 'https://www.newplatform.com';
  }

  async search(query, maxResults = 10) {
    // Implement search logic
  }

  async getProductDetails(url) {
    // Implement product details fetching
  }
}

export default NewPlatformScraper;
```

2. Register in `backend/src/scrapers/index.js`:

```javascript
import NewPlatformScraper from './NewPlatformScraper.js';

initializeScrapers() {
  this.register('newplatform', new NewPlatformScraper());
  // ... existing scrapers
}
```

### Scheduler Configuration

Cron schedule format (in `.env`):
```
# Every 6 hours
PRICE_UPDATE_SCHEDULE=0 */6 * * *

# Daily at 2 AM
PRICE_UPDATE_SCHEDULE=0 2 * * *

# Every hour
PRICE_UPDATE_SCHEDULE=0 * * * *
```

## ⚠️ Important Notes

### Web Scraping Ethics & Limitations

1. **Respect robots.txt**: Always check and follow the platform's robots.txt
2. **Rate Limiting**: Implement delays between requests to avoid overloading servers
3. **Terms of Service**: Be aware of ToS violations
4. **Anti-Bot Measures**: Sites may block scrapers; consider:
   - Using Puppeteer for JavaScript-rendered content
   - Rotating user agents
   - Adding random delays
   - Using proxies (carefully)

### Current Limitations

1. **Selector Fragility**: Website HTML structures change frequently
2. **Anti-Scraping**: Platforms have anti-bot measures
3. **No Authentication**: Cannot access logged-in user data
4. **Rate Limits**: Aggressive scraping may result in IP blocks
5. **Legal Considerations**: This is an educational demo

### Recommended Improvements for Production

1. **Use Official APIs**: If available (preferred method)
2. **Headless Browsers**: Puppeteer/Playwright for better reliability
3. **Proxy Rotation**: Distribute requests across multiple IPs
4. **Error Recovery**: More robust error handling
5. **Caching**: Reduce redundant scraping
6. **User Authentication**: Add user accounts
7. **Email Notifications**: Alert on price drops
8. **Mobile App**: React Native version

## 🐛 Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL is running
sudo service postgresql status

# Restart PostgreSQL
sudo service postgresql restart
```

### Scraping Fails
- Check internet connection
- Verify website is accessible
- Check if selectors have changed
- Increase timeout in `.env`

### Port Already in Use
```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9

# Or change PORT in .env
```

## 📦 Build for Production

### Backend
```bash
cd backend
npm start
```

### Frontend
```bash
cd frontend
npm run build
npm run preview
```

## 🧪 Testing

```bash
# Test search endpoint
curl "http://localhost:5000/api/search?q=iphone"

# Test tracked products
curl "http://localhost:5000/api/track"
```

## 📝 License

MIT License - Educational purposes only

## 🤝 Contributing

This is an educational project. Feel free to fork and modify for learning purposes.

## ⚡ Performance Tips

1. **Database Indexing**: Already implemented on frequently queried columns
2. **Connection Pooling**: Configured in database.js
3. **Rate Limiting**: Prevents API abuse
4. **Caching**: Search results cached for 30 minutes
5. **Parallel Scraping**: All platforms scraped simultaneously

## 🔐 Security Considerations

1. **Input Validation**: Implemented on all endpoints
2. **SQL Injection**: Using parameterized queries
3. **Rate Limiting**: Prevents DoS attacks
4. **CORS**: Configured for frontend domain
5. **Environment Variables**: Sensitive data in .env

## 📚 Tech Stack

**Backend:**
- Node.js + Express
- PostgreSQL
- Cheerio (HTML parsing)
- Axios (HTTP requests)
- node-cron (Scheduling)

**Frontend:**
- React 18
- Vite
- Tailwind CSS
- Recharts (Charts)
- React Router
- Lucide Icons

## 🎯 Future Enhancements

- [ ] User authentication
- [ ] Email price alerts
- [ ] More e-commerce platforms
- [ ] Mobile app
- [ ] Chrome extension
- [ ] Price prediction using ML
- [ ] Wishlist management
- [ ] Comparison exports (PDF/Excel)

---

**⚠️ Disclaimer**: This is an educational project demonstrating web scraping and full-stack development. Always respect website terms of service and implement proper rate limiting and ethical scraping practices.
