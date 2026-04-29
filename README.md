supabasepas
AIzaSyCwZ6AOIpBpWEMq1vOompI8rtjtjaV1OMs

# Heal Backend — Blockchain Prescription Fraud Prevention System

A production-ready Next.js 14 backend for prescription fraud detection using AI (Google Gemini) and smart contracts (Hedera/Solidity).

## 🎯 Features

- ✅ **User Authentication** — Email/password signup, JWT tokens, role-based access control
- ✅ **Doctor Management** — Register, verify, and revoke medical licenses
- ✅ **Prescription Issuance** — Doctors submit prescriptions with digital signatures
- ✅ **Fraud Detection** — AI-powered explanations of smart contract fraud flags
- ✅ **Analytics Dashboard** — Regulator monitoring with daily breakdowns
- ✅ **Rate Limiting** — Per-IP request throttling, Gemini quota protection
- ✅ **CORS & Security** — Production-grade headers, RLS, input validation
- ✅ **Database** — Supabase PostgreSQL with Row-Level Security

## 📋 Project Structure

```
heal-backend/
├── src/
│   ├── app/api/
│   │   ├── health/              # System health check
│   │   ├── auth/
│   │   │   ├── signup/          # User registration
│   │   │   └── login/           # Authentication
│   │   ├── me/                  # Current user profile
│   │   ├── doctors/             # Doctor management
│   │   │   ├── [id]/            # Get/revoke specific doctor
│   │   │   └── verify/          # Verify doctor by wallet/NFT
│   │   ├── prescriptions/       # Prescription submission & filling
│   │   │   └── [id]/            # Get/fill specific prescription
│   │   ├── fraud-check/         # AI fraud explanations
│   │   │   └── [id]/            # Get/resolve specific alert
│   │   └── analytics/           # Regulator dashboard
│   ├── lib/
│   │   ├── cors.ts              # CORS + security headers
│   │   ├── database.types.ts    # TypeScript database types
│   │   ├── gemini.ts            # Gemini AI integration
│   │   ├── rate-limit.ts        # Rate limiting logic
│   │   ├── response.ts          # Standard response helpers
│   │   ├── schemas.ts           # Zod validation schemas
│   │   └── supabase.ts          # Supabase clients
│   └── middleware.ts            # Auth + rate limit middleware
├── supabase/
│   └── schema.sql               # Database schema
├── .env.example                 # Environment variables template
├── .gitignore                   # Git ignore rules
├── API_DOCS.md                  # Complete API reference
├── FRONTEND_INTEGRATION.md      # React client setup guide
├── SETUP.md                     # Local & production deployment
├── next.config.ts               # Next.js configuration
├── package.json                 # Dependencies
├── README.md                    # This file
└── tsconfig.json                # TypeScript config
```

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account (free tier)
- Google Gemini API key

### 2. Clone & Install
```bash
npm install
```

### 3. Set Up Environment
```bash
cp .env.example .env.local
# Edit .env.local with your credentials
```

See [SETUP.md](SETUP.md) for detailed instructions.

### 4. Initialize Database
```bash
# In Supabase SQL Editor, paste supabase/schema.sql and run
```

### 5. Run Locally
```bash
npm run dev
# http://localhost:3000
```

### 6. Test Health Check
```bash
curl http://localhost:3000/api/health
```

## 📚 Documentation

- **[API_DOCS.md](API_DOCS.md)** — Complete API reference with examples
- **[SETUP.md](SETUP.md)** — Local dev, Vercel, Docker, self-hosted deployment
- **[FRONTEND_INTEGRATION.md](FRONTEND_INTEGRATION.md)** — React client integration guide

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/signup` — Create account
- `POST /api/auth/login` — Sign in, get JWT
- `PUT /api/auth/login` — Refresh token

### User Profile
- `GET /api/me` — Current user profile
- `PATCH /api/me` — Update profile

### Doctors
- `POST /api/doctors` — Register doctor (doctor role)
- `GET /api/doctors` — List all doctors
- `GET /api/doctors/[id]` — Get doctor details
- `GET /api/doctors/verify?wallet=0x...` — Verify doctor
- `PATCH /api/doctors/[id]` — Revoke license (regulator only)

### Prescriptions
- `POST /api/prescriptions` — Submit prescription (doctor)
- `GET /api/prescriptions` — List prescriptions
- `GET /api/prescriptions/[id]` — Get prescription details
- `PATCH /api/prescriptions/[id]` — Fill prescription (pharmacist)

### Fraud Detection
- `POST /api/fraud-check` — Report fraud flag + get AI explanation
- `GET /api/fraud-check` — List fraud alerts
- `GET /api/fraud-check/[id]` — Get alert details
- `PATCH /api/fraud-check/[id]` — Resolve alert (regulator)

### Analytics
- `GET /api/analytics?days=7` — Dashboard stats (regulator)

### Health
- `GET /api/health` — System status (public)

## 🔐 Environment Variables

### Required
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Public anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Server-only service role key
- `GEMINI_API_KEY` — Google Gemini API key

### Optional
- `NEXT_PUBLIC_APP_URL` — Backend base URL (default: http://localhost:3000)
- `ALLOWED_ORIGINS` — CORS origins (default: localhost)
- `NODE_ENV` — Environment (development/production)

See [.env.example](.env.example) for defaults.

## 🎯 Fraud Detection Reasons

When smart contract rejects a prescription:

1. **doctor_daily_limit_exceeded** (HIGH) — Doctor issued >30 prescriptions today
2. **patient_pharmacy_limit_exceeded** (MEDIUM) — Patient visited >3 pharmacies today
3. **doctor_license_revoked** (HIGH) — Doctor's license has been revoked
4. **prescription_expired** (LOW) — Prescription past expiry date
5. **invalid_signature** (HIGH) — Digital signature verification failed
6. **doctor_not_registered** (HIGH) — Doctor not in verified registry

Backend uses Google Gemini to generate plain-English explanations for pharmacists.

## 🧬 Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Runtime:** Node.js with TypeScript
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth (JWT)
- **AI:** Google Gemini 1.5 Flash
- **Validation:** Zod
- **Security:** CORS, RLS, Rate Limiting, Input Validation
- **Deployment:** Vercel, Docker, Self-hosted

## 🧪 Testing

### Manual Testing with cURL
```bash
# Health check
curl http://localhost:3000/api/health

# Signup
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","role":"pharmacist"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'

# Use returned access_token in Authorization header
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/me
```

### Testing with Postman
See [SETUP.md](SETUP.md) for importing the Postman collection.

## 📊 Database Schema

### Core Tables
- **users** (via Supabase Auth) — Authentication
- **user_profiles** — User roles and metadata
- **doctors** — Licensed physicians
- **prescriptions** — Issued medications
- **fraud_alerts** — Detected suspicious attempts
- **verification_logs** — Pharmacy verification records

### Analytics Views
- `prescription_analytics` — Daily aggregates
- `fraud_analytics` — Fraud breakdown by reason

See `supabase/schema.sql` for complete schema.

## 🚨 Rate Limiting

Per IP address:
- **Auth endpoints** — 10 req/min
- **Fraud/AI endpoints** — 20 req/min (Gemini quota)
- **Read endpoints** — 120 req/min
- **Default** — 60 req/min

Configure in `src/lib/rate-limit.ts`.

## 🔗 Frontend Integration

Complete guide: [FRONTEND_INTEGRATION.md](FRONTEND_INTEGRATION.md)

Quick setup for React:
```typescript
import { login, reportFraudFlag } from "@/lib/api";

// Sign in
const { access_token } = await login("user@example.com", "password");
localStorage.setItem("token", access_token);

// Report fraud with AI explanation
const { explanation, severity, action_required } = await reportFraudFlag({
  prescription_hash: "0x...",
  pharmacy_wallet: "0x...",
  smart_contract_reason: "Doctor exceeded 30 prescriptions",
});
```

## 🚀 Deployment

### Vercel (Recommended)
```bash
vercel --prod
```
See [SETUP.md](SETUP.md) for detailed steps.

### Docker
```bash
docker build -t heal-backend .
docker run -p 3000:3000 -e GEMINI_API_KEY=... heal-backend
```

### Self-Hosted
See [SETUP.md](SETUP.md) for Nginx, PM2, and systemd setup.

## 📋 Assumptions & Limitations

### Assumptions
- Wallet addresses use Ethereum/EVM format (0x + 40 hex chars)
- Smart contract called by frontend first; backend receives result
- One doctor account per Supabase user account
- Prescriptions expire within 90 days

### Limitations
- Rate limiting is in-memory (resets on server restart)
- Gemini free tier: 15 RPM, 1M tokens/day
- Production should use Redis for distributed rate limiting
- Max 100 items per page in list endpoints

## 🛡️ Security

- [x] JWT authentication with refresh tokens
- [x] Row-Level Security (RLS) on all tables
- [x] Rate limiting per IP
- [x] CORS validation
- [x] Zod input validation
- [x] SQL injection prevention (Supabase prepared statements)
- [x] XSS prevention (no raw HTML)
- [x] HTTPS in production
- [x] Secure headers (CSP, X-Frame-Options, etc.)

## 📈 Monitoring

Health endpoint:
```bash
curl http://localhost:3000/api/health
```

Vercel Logs:
- Dashboard → Project → Deployments → Logs

Supabase:
- Dashboard → Logs → Recent Activity

## 🤝 Support & Integration

- **Doctor Management** — Register/revoke via API
- **Fraud Alerts** — Real-time AI explanations from smart contract
- **Analytics** — Daily dashboard for regulators
- **Webhook Ready** — Extend to notify external systems

## 📝 License

Proprietary — Heal Team

## 🔄 Version History

- v1.0.0 (Jan 2025) — Initial release

---

## Next Steps

1. ✅ [SETUP.md](SETUP.md) — Local development setup
2. ✅ [API_DOCS.md](API_DOCS.md) — API reference
3. ✅ [FRONTEND_INTEGRATION.md](FRONTEND_INTEGRATION.md) — Connect your React app
4. ✅ Run locally and test health endpoint
5. ✅ Deploy to Vercel or self-hosted environment

**Questions?** Check the documentation files or review API examples in [API_DOCS.md](API_DOCS.md).
