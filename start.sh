#!/bin/bash
set -e

echo "Installing backend dependencies..."
cd backend
npm ci --only=production
echo "Starting backend server..."
npm start
