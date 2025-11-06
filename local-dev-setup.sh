#!/bin/bash

# Simple Local Development Setup Script
# No S3 or Redis required - just for testing improvements

set -e

echo "🚀 Mentingo LMS - Simple Local Setup"
echo "====================================="
echo ""

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm
fi

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

echo "1️⃣ Installing dependencies..."
pnpm install

echo ""
echo "2️⃣ Setting up environment files..."

# Create API .env if it doesn't exist
if [ ! -f apps/api/.env ]; then
    cat > apps/api/.env << 'EOF'
# Database (required)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mentingo

# Redis (OPTIONAL - commented out for local testing)
# REDIS_URL=redis://localhost:6379

# JWT (required)
JWT_SECRET=local-dev-secret-key-change-in-production
JWT_REFRESH_SECRET=local-dev-refresh-secret-key
JWT_EXPIRATION_TIME=24h

# Master Key (required for encryption)
MASTER_KEY=dGVzdC1tYXN0ZXIta2V5LWZvci1sb2NhbC1kZXZlbG9wbWVudAo=

# S3 (OPTIONAL - leave empty for local testing)
S3_ENDPOINT=
S3_REGION=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=

# Email (uses Mailhog in docker)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=

# App Config
NODE_ENV=development
PORT=3000
EOF
    echo "✅ Created apps/api/.env"
else
    echo "⏭️  apps/api/.env already exists, skipping"
fi

# Create Web .env if it doesn't exist
if [ ! -f apps/web/.env ]; then
    cat > apps/web/.env << 'EOF'
VITE_API_URL=http://localhost:3000
VITE_APP_URL=http://localhost:5173
EOF
    echo "✅ Created apps/web/.env"
else
    echo "⏭️  apps/web/.env already exists, skipping"
fi

echo ""
echo "3️⃣ Starting PostgreSQL..."
docker-compose up postgres -d

# Wait for postgres to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 3

echo ""
echo "4️⃣ Running database migrations..."
cd apps/api
pnpm db:migrate
cd ../..

echo ""
echo "5️⃣ (Optional) Seeding database..."
read -p "Do you want to seed the database with test data? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd apps/api
    pnpm db:seed
    cd ../..
    echo "✅ Database seeded"
else
    echo "⏭️  Skipping database seed"
fi

echo ""
echo "✅ Setup Complete!"
echo ""
echo "======================================"
echo "🎉 You can now start the app with:"
echo "   pnpm dev"
echo ""
echo "Then open:"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:3000"
echo "   Mailhog:  http://localhost:8025"
echo ""
echo "📝 Note: Running without Redis and S3"
echo "   - S3 caching improvements won't be visible"
echo "   - Image uploads will show placeholders"
echo "   - All other improvements will work!"
echo "======================================"
