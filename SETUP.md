# Heal Backend — Complete Setup & Deployment Guide

## Local Development Setup

### Prerequisites
- Node.js 18+ (recommended 20+)
- npm or yarn package manager
- Git
- A Supabase account (free tier available)
- Google Gemini API key

### Step-by-Step Local Setup

#### 1. Clone/Setup Project
```bash
# Create and enter project directory
mkdir heal-backend && cd heal-backend

# Copy all project files into this directory
# (from the ZIP or git clone)

# Install dependencies
npm install

# Verify installation
npm run type-check
```

#### 2. Create Supabase Project
1. Go to [https://supabase.com](https://supabase.com)
2. Sign in or create account
3. Click "New Project"
   - Organization: create or select
   - Project name: `heal-dev` (or your choice)
   - Database password: generate strong password
   - Region: closest to you
4. Wait for project to initialize (~2 min)

#### 3. Get Supabase Credentials
1. Go to your project dashboard
2. Click "Settings" → "API"
3. Copy these values:
   - **Project URL** (under "API")
   - **anon public key** (under "Project API keys")
   - **service_role key** (under "Project API keys" → "Service role")

#### 4. Set Up Database Schema
1. In Supabase dashboard, click "SQL Editor"
2. Click "New Query"
3. Copy entire contents of `supabase/schema.sql`
4. Paste into the SQL editor
5. Click "Run"
6. Wait for completion (should see "success" message)

#### 5. Get Gemini API Key
1. Go to [https://makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)
2. Click "Create API Key"
3. Choose existing or create new Google Cloud project
4. Copy the generated key

#### 6. Create Environment File
```bash
# Copy the example file
cp .env.example .env.local

# Edit with your credentials
nano .env.local
# or use your editor: code .env.local
```

Fill in `.env.local`:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...

# Gemini
GEMINI_API_KEY=AIzaSy...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

#### 7. Run Development Server
```bash
npm run dev
```

Output should show:
```
> ready - started server on 0.0.0.0:3000, url: http://localhost:3000
```

#### 8. Test Backend Health
Open in browser or curl:
```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-16T12:00:00Z",
  "services": {
    "database": { "status": "ok" },
    "gemini_ai": { "status": "configured" }
  }
}
```

#### 9. Test Auth Flow
```bash
# Signup
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!",
    "role": "pharmacist"
  }'

# You should get: { "success": true, "data": { "user_id": "..." } }

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!"
  }'

# You should get an access_token
```

✅ **Backend is now ready for development!**

---

## Production Deployment

### Option 1: Vercel (Recommended for Next.js)

#### 1. Create Vercel Account & Project
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy (from project root)
vercel
```

#### 2. Configure Environment Variables
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click your project
3. Settings → Environment Variables
4. Add all variables from `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`
   - `ALLOWED_ORIGINS` (add your frontend URL)
   - `NODE_ENV=production`

#### 3. Configure Allowed Origins
In `.env.local` or Vercel env vars:
```
ALLOWED_ORIGINS=https://your-frontend.vercel.app,https://your-domain.com
```

#### 4. Deploy
```bash
# Automatic deploys when you push to main:
git push origin main

# Or manual deploy:
vercel --prod
```

Your API will be at: `https://heal-backend-xxx.vercel.app`

---

### Option 2: Docker Deployment

#### 1. Create Dockerfile
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy dependency files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build
RUN npm run build

# Expose port
EXPOSE 3000

# Start
CMD ["npm", "start"]
```

#### 2. Create Docker Compose (Optional)
```yaml
version: '3.8'
services:
  heal-backend:
    build: .
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}
      SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY}
      GEMINI_API_KEY: ${GEMINI_API_KEY}
      NODE_ENV: production
    restart: unless-stopped
```

#### 3. Build and Run
```bash
# Build image
docker build -t heal-backend:latest .

# Run container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=... \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  -e GEMINI_API_KEY=... \
  heal-backend:latest

# Or with Docker Compose:
docker-compose up -d
```

---

### Option 3: Self-Hosted (AWS, GCP, DigitalOcean, etc.)

#### General Steps
1. Provision a Linux server (Ubuntu 22.04 recommended)
2. Install Node.js and npm
3. Clone repository
4. Install dependencies: `npm install`
5. Create `.env.local` with production values
6. Build: `npm run build`
7. Start: `npm start`
8. Use PM2 or systemd to keep process running
9. Put behind Nginx reverse proxy
10. Enable HTTPS with Let's Encrypt

#### Example Nginx Config
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xyz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | `eyJhbGc...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) | `eyJhbGc...` |
| `GEMINI_API_KEY` | Google Gemini API key | `AIzaSy...` |

### Optional Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `NEXT_PUBLIC_APP_URL` | Backend base URL | `http://localhost:3000` | `https://api.heal.io` |
| `NODE_ENV` | Environment mode | `development` | `production` |
| `ALLOWED_ORIGINS` | CORS-allowed frontend URLs | `*` in dev, required in prod | `https://app.heal.io,https://admin.heal.io` |

---

## Database Migrations

### Adding a New Table
```sql
-- 1. Add table via SQL Editor in Supabase
-- 2. Enable RLS and set policies
-- 3. Update supabase/schema.sql with new definition
-- 4. Update src/lib/database.types.ts with new types
-- 5. Restart backend: npm run dev
```

### Updating Existing Table
```sql
-- Make changes in SQL Editor
-- Verify changes with a SELECT query
-- Test affected API routes
-- Document changes in CHANGELOG.md
```

---

## Monitoring & Logs

### Local Logs
```bash
# Terminal where `npm run dev` is running shows all logs
# Search for [api-route-name] prefix in logs
```

### Vercel Logs
1. Go to vercel.com/dashboard
2. Click project → Deployments
3. Click most recent deployment
4. View "Logs" tab

### Check Supabase Health
1. Go to Supabase dashboard
2. Database → Migrations — view all applied migrations
3. Logs — view recent database activity

### Monitor Rate Limits
```bash
# Watch rate limit headers in responses
curl -i http://localhost:3000/api/health

# Look for:
# X-RateLimit-Limit: 120
# X-RateLimit-Remaining: 119
# X-RateLimit-Reset: 1705432500
```

---

## Troubleshooting

### "SUPABASE_SERVICE_ROLE_KEY is not set"
✅ **Solution:** Ensure `.env.local` has the key and restart server (`Ctrl+C`, then `npm run dev`)

### "Invalid or expired token"
✅ **Solution:** 
- Token may have expired (1 hour default)
- Use refresh token endpoint to get new token
- Clear browser storage and sign in again

### "Rate limited" (429 error)
✅ **Solution:**
- Wait 60 seconds before retrying
- Check if running load test
- For production, upgrade Gemini API tier
- Edit rate limits in `src/lib/rate-limit.ts`

### Supabase connection timeouts
✅ **Solution:**
- Check internet connection
- Verify Supabase project is active (not paused)
- Go to supabase.com dashboard and check status
- Restart backend

### "Doctor license revoked" when filling prescription
✅ **Solution:**
- Expected behavior! Regulator must revoke license through PATCH `/api/doctors/[id]`
- Or doctor is already revoked in database

### Gemini API errors
✅ **Solutions:**
- Check API key is correct and has quota remaining
- Visit https://makersuite.google.com/app/monitoring
- Fallback responses will be used if Gemini is unavailable
- Check rate limits (15 RPM free tier)

---

## Performance Optimization

### Database Query Optimization
```typescript
// ✅ Good: Select only needed columns
.select('id, name, email')

// ❌ Bad: Select everything
.select('*')
```

### Rate Limiting Configuration
```typescript
// In src/lib/rate-limit.ts
export const RATE_LIMITS = {
  AUTH: { limit: 10, windowMs: 60_000 },        // 10 req/min
  DEFAULT: { limit: 60, windowMs: 60_000 },     // 60 req/min
  READ: { limit: 120, windowMs: 60_000 },       // 120 req/min
  AI: { limit: 20, windowMs: 60_000 },          // 20 req/min (Gemini cost)
};
```

### Gemini Caching
- Free tier: 15 requests/minute, 1M tokens/day
- Fallback responses kick in automatically if quota exceeded
- No additional caching needed

### Database Indexing
Indices already created for:
- `doctors.wallet_address` — lookup by address
- `doctors.license_number` — uniqueness
- `prescriptions.prescription_hash` — uniqueness
- `prescriptions.doctor_id` — filtering
- `fraud_alerts.resolved` — filtering unresolved

---

## Security Checklist

- [x] Environment variables in `.env.local` (never committed)
- [x] Service role key server-side only
- [x] All API routes protected by auth middleware
- [x] Row-level security (RLS) enabled on database
- [x] Rate limiting enabled
- [x] CORS validation enabled
- [x] Input validation with Zod schemas
- [x] SQL injection prevention (Supabase prepared statements)
- [x] XSS prevention (no raw HTML injection)
- [x] HTTPS enforced in production

---

## Useful Commands

```bash
# Development
npm run dev              # Start dev server
npm run type-check      # TypeScript type checking
npm run build           # Build for production
npm start               # Start production server
npm run lint            # ESLint check

# Database
# (in Supabase SQL Editor)
# SELECT * FROM user_profiles LIMIT 5;  # Check users
# SELECT COUNT(*) FROM prescriptions;   # Count prescriptions

# Debugging
NODE_DEBUG=* npm run dev           # Verbose logging
# Check error messages in terminal

# Deploy
vercel --prod                      # Deploy to Vercel
docker build -t heal-backend .     # Build Docker image
```

---

## Next Steps

1. **Connect Frontend:** Configure your React app to call this backend
2. **Test Full Flow:** Doctor signup → register → issue prescription → pharmacy fill
3. **Monitor:** Set up alerts in Vercel/Supabase for errors
4. **Load Test:** Use tools like Apache Bench or k6 before production
5. **Security Audit:** Review all environment variables, keys, and secrets
