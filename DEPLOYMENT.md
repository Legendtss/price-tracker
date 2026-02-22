# Deployment Guide

## Backend Deployment (Render)

### Steps to deploy backend on Render:

1. **Create a Render account** at https://render.com

2. **Connect your GitHub repository**
   - Go to Dashboard → New → Web Service
   - Select "Build and deploy from a Git repository"
   - Connect your GitHub account and select this repo

3. **Render will auto-detect `render.yaml`**
   - The service will be named `price-tracker-backend`
   - Environment: Node.js
   - Build command: `cd backend && npm install`
   - Start command: `cd backend && npm start`

4. **After deployment**, Render will provide a URL like:
   ```
   https://price-tracker-backend.onrender.com
   ```

5. **Update frontend to use your backend URL**:
   - Update the GitHub Actions workflow (`.github/workflows/deploy.yml`) to set the `VITE_API_URL` environment variable during the frontend build
   - Or manually update `frontend/src/services/api.js` line 3:
     ```javascript
     const API_BASE_URL = 'https://price-tracker-backend.onrender.com/api';
     ```

## Frontend Deployment (GitHub Pages)

Frontend is already deployed at: https://legendtss.github.io/price-tracker/

It **automatically redeploys** whenever you push to the `master` branch.

### To link frontend to backend:

Option 1: Update workflow environment variable
- Edit `.github/workflows/deploy.yml`
- Add: `VITE_API_URL: https://your-render-url.onrender.com/api`

Option 2: Create a `.env.production` file in frontend folder:
```
VITE_API_URL=https://your-render-url.onrender.com/api
```

Then push to GitHub and the frontend will rebuild with the correct backend URL.

## Database Setup

PostgreSQL is optional. The backend works in "degraded mode" without it:
- ✅ Search works (Amazon, Flipkart, Myntra)
- ❌ Price tracking requires database
- ❌ Price history requires database

To add database on Render:
1. Create a PostgreSQL instance on Render
2. Add the connection string as an environment variable:
   ```
   DATABASE_URL=postgresql://user:pass@db.onrender.com:5432/dbname
   ```
