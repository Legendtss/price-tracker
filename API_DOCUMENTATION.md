# 📡 API Documentation

Base URL: `http://localhost:5000/api`

## Authentication

Currently, no authentication is required. For production, implement JWT or OAuth.

---

## 🔍 Search Endpoints

### Search All Platforms

**GET** `/search`

Search for products across all e-commerce platforms.

**Query Parameters:**
- `q` (required): Search query
- `limit` (optional): Max results per platform (default: 10)

**Example Request:**
```bash
curl "http://localhost:5000/api/search?q=iphone%2015&limit=5"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "query": "iphone 15",
    "platforms": {
      "amazon": {
        "success": true,
        "count": 5,
        "results": [
          {
            "platform": "amazon",
            "title": "Apple iPhone 15 (128GB) - Black",
            "price": 79900,
            "url": "https://amazon.in/...",
            "imageUrl": "https://...",
            "availability": "available"
          }
        ]
      },
      "flipkart": { /* ... */ },
      "myntra": { /* ... */ }
    },
    "totalResults": 15,
    "lowestPrice": {
      "platform": "amazon",
      "title": "Apple iPhone 15 (128GB)",
      "price": 79900,
      "url": "https://..."
    },
    "searchedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### Search Specific Platform

**GET** `/search/:platform`

Search a specific e-commerce platform.

**Path Parameters:**
- `platform`: Platform name (amazon, flipkart, myntra)

**Query Parameters:**
- `q` (required): Search query
- `limit` (optional): Max results (default: 10)

**Example Request:**
```bash
curl "http://localhost:5000/api/search/amazon?q=laptop&limit=10"
```

---

### Get Available Platforms

**GET** `/search/meta/platforms`

Get list of all available e-commerce platforms.

**Example Response:**
```json
{
  "success": true,
  "data": {
    "platforms": ["amazon", "flipkart", "myntra"],
    "count": 3
  }
}
```

---

## 📌 Tracking Endpoints

### Get All Tracked Products

**GET** `/track`

Retrieve all products being tracked.

**Example Response:**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": 1,
        "name": "Apple iPhone 15 (128GB) - Black",
        "platform": "amazon",
        "product_url": "https://amazon.in/...",
        "image_url": "https://...",
        "is_active": true,
        "created_at": "2024-01-10T08:00:00.000Z",
        "latest_price": 79900,
        "latest_availability": "available",
        "last_checked": "2024-01-15T10:00:00.000Z"
      }
    ],
    "count": 1
  }
}
```

---

### Get Specific Tracked Product

**GET** `/track/:id`

Get details of a specific tracked product.

**Path Parameters:**
- `id`: Product ID

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Apple iPhone 15 (128GB) - Black",
    "platform": "amazon",
    "product_url": "https://amazon.in/...",
    "latest_price": 79900,
    "last_checked": "2024-01-15T10:00:00.000Z"
  }
}
```

---

### Start Tracking Product

**POST** `/track`

Add a product to tracking list.

**Request Body:**
```json
{
  "name": "Apple iPhone 15 (128GB) - Black",
  "platform": "amazon",
  "url": "https://www.amazon.in/...",
  "imageUrl": "https://..."
}
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Apple iPhone 15 (128GB) - Black",
    "platform": "amazon",
    "product_url": "https://amazon.in/...",
    "latest_price": 79900
  },
  "message": "Product tracking started"
}
```

---

### Stop Tracking Product

**DELETE** `/track/:id`

Remove a product from tracking.

**Path Parameters:**
- `id`: Product ID

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "is_active": false
  },
  "message": "Product tracking stopped"
}
```

---

### Update Product Price

**POST** `/track/:id/update`

Manually trigger price update for a specific product.

**Path Parameters:**
- `id`: Product ID

**Example Response:**
```json
{
  "success": true,
  "data": {
    "platform": "amazon",
    "title": "Apple iPhone 15 (128GB) - Black",
    "price": 79900,
    "availability": "available"
  },
  "message": "Price updated successfully"
}
```

---

### Update All Prices

**POST** `/track/update-all`

Trigger price update for all tracked products.

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "productId": 1,
      "success": true,
      "price": 79900
    },
    {
      "productId": 2,
      "success": true,
      "price": 45000
    }
  ],
  "message": "All prices updated"
}
```

---

## 📊 History Endpoints

### Get Price History

**GET** `/history/:productId`

Get price history for a product.

**Path Parameters:**
- `productId`: Product ID

**Query Parameters:**
- `limit` (optional): Number of records (default: 100)

**Example Response:**
```json
{
  "success": true,
  "data": {
    "productId": 1,
    "history": [
      {
        "id": 1,
        "product_id": 1,
        "price": 79900,
        "availability": "available",
        "scraped_at": "2024-01-15T10:00:00.000Z"
      },
      {
        "id": 2,
        "product_id": 1,
        "price": 81900,
        "availability": "available",
        "scraped_at": "2024-01-14T10:00:00.000Z"
      }
    ],
    "stats": {
      "lowest_price": 79900,
      "highest_price": 85900,
      "average_price": 82400,
      "total_records": 10,
      "first_tracked": "2024-01-10T08:00:00.000Z",
      "last_tracked": "2024-01-15T10:00:00.000Z"
    }
  }
}
```

---

### Get Price Changes

**GET** `/history/:productId/changes`

Get only the records where price changed.

**Path Parameters:**
- `productId`: Product ID

**Example Response:**
```json
{
  "success": true,
  "data": {
    "productId": 1,
    "changes": [
      {
        "price": 79900,
        "previous_price": 81900,
        "scraped_at": "2024-01-15T10:00:00.000Z"
      }
    ],
    "count": 1
  }
}
```

---

### Get Price Statistics

**GET** `/history/:productId/stats`

Get statistical summary of price history.

**Path Parameters:**
- `productId`: Product ID

**Example Response:**
```json
{
  "success": true,
  "data": {
    "lowest_price": 79900,
    "highest_price": 85900,
    "average_price": 82400,
    "total_records": 10,
    "first_tracked": "2024-01-10T08:00:00.000Z",
    "last_tracked": "2024-01-15T10:00:00.000Z"
  }
}
```

---

## ⚙️ Scheduler Endpoints

### Get Scheduler Status

**GET** `/scheduler/status`

Get current status of the price update scheduler.

**Example Response:**
```json
{
  "success": true,
  "data": {
    "running": true,
    "jobCount": 2,
    "jobs": ["priceUpdate", "cacheCleanup"]
  }
}
```

---

### Trigger Price Update

**POST** `/scheduler/trigger`

Manually trigger the automated price update process.

**Rate Limited:** 10 requests per 15 minutes

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "productId": 1,
      "success": true,
      "price": 79900
    }
  ],
  "message": "Price update triggered"
}
```

---

## ⚠️ Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message here",
  "stack": "Stack trace (development only)"
}
```

### Common HTTP Status Codes

- `200` - Success
- `201` - Resource created
- `400` - Bad request (invalid parameters)
- `404` - Resource not found
- `429` - Too many requests (rate limit)
- `500` - Internal server error

---

## 🔒 Rate Limiting

Rate limits are applied per IP address:

- **General API**: 100 requests per 15 minutes
- **Search**: 30 requests per 15 minutes
- **Scheduler Trigger**: 10 requests per 15 minutes

Headers included in response:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset time

---

## 🧪 Testing with cURL

### Search
```bash
curl "http://localhost:5000/api/search?q=laptop"
```

### Track Product
```bash
curl -X POST http://localhost:5000/api/track \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Product",
    "platform": "amazon",
    "url": "https://amazon.in/test"
  }'
```

### Get Tracked Products
```bash
curl http://localhost:5000/api/track
```

### Get Price History
```bash
curl http://localhost:5000/api/history/1
```

---

## 📝 Notes

1. All timestamps are in ISO 8601 format (UTC)
2. Prices are in Indian Rupees (₹) as integers (e.g., 79900 = ₹79,900)
3. The API does not require authentication in development mode
4. CORS is enabled for `http://localhost:3000` by default
