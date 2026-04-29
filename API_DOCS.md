## Heal Backend — Complete API Documentation

### Base URL
```
http://localhost:3000  (development)
https://your-domain.com (production)
```

### Authentication
All protected endpoints require:
```http
Authorization: Bearer <JWT_ACCESS_TOKEN>
```

Obtain tokens via `/api/auth/login` or `/api/auth/signup`.

---

## 1. Health & Status

### GET `/api/health`
**Public endpoint. No authentication required.**

Check backend health and service availability.

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-16T12:34:56.789Z",
  "version": "1.0.0",
  "uptime_ms": 123456,
  "services": {
    "database": {
      "status": "ok",
      "latency_ms": 45
    },
    "gemini_ai": {
      "status": "configured"
    }
  }
}
```

**Response (503) - Degraded:**
```json
{
  "status": "degraded",
  "timestamp": "2025-01-16T12:34:56.789Z",
  "services": {
    "database": { "status": "error" },
    "gemini_ai": { "status": "missing_api_key" }
  }
}
```

---

## 2. Authentication

### POST `/api/auth/signup`
**Public endpoint.**

Create a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "role": "pharmacist",
  "display_name": "City Pharmacy",
  "wallet_address": "0x1234567890123456789012345678901234567890"
}
```

**Fields:**
- `email` (required, string): Valid email
- `password` (required, string): Min 8, max 72 characters
- `role` (required, enum): `doctor`, `pharmacist`, or `regulator`
- `display_name` (optional, string): 2-100 characters
- `wallet_address` (optional, string): EVM address (0x + 40 hex chars)

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "role": "pharmacist",
    "message": "Account created successfully. You can now sign in."
  }
}
```

**Error (409) - Email Exists:**
```json
{
  "success": false,
  "error": "An account with this email address already exists.",
  "code": "CONFLICT"
}
```

---

### POST `/api/auth/login`
**Public endpoint.**

Authenticate and receive access token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "v1.abcdef123456...",
    "expires_at": 1735689600,
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "role": "pharmacist",
      "display_name": "City Pharmacy",
      "wallet_address": null
    }
  }
}
```

**Error (401) - Invalid Credentials:**
```json
{
  "success": false,
  "error": "Invalid email or password.",
  "code": "UNAUTHORIZED"
}
```

---

### PUT `/api/auth/login`
**Public endpoint.**

Refresh expired access token using refresh token.

**Request Body:**
```json
{
  "refresh_token": "v1.abcdef123456..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "v1.xyz789...",
    "expires_at": 1735776000
  }
}
```

---

## 3. User Profile

### GET `/api/me`
**Protected endpoint. All authenticated users.**

Get current user's profile.

**Headers:**
```http
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "role": "pharmacist",
    "display_name": "City Pharmacy",
    "wallet_address": null,
    "created_at": "2025-01-15T10:00:00Z",
    "updated_at": "2025-01-16T12:00:00Z",
    "doctor": null
  }
}
```

For doctors, includes:
```json
{
  "doctor": {
    "id": "7f8a9b0c-1d2e-3f4a-5b6c-7d8e9f0a1b2c",
    "wallet_address": "0x...",
    "license_number": "MED-2024-001",
    "full_name": "Dr. Sarah Smith",
    "specialty": "Cardiologist",
    "nft_token_id": "1",
    "is_active": true,
    "registered_at": "2025-01-15T09:00:00Z"
  }
}
```

---

### PATCH `/api/me`
**Protected endpoint. All authenticated users.**

Update current user's profile.

**Request Body:**
```json
{
  "display_name": "New Display Name",
  "wallet_address": "0x..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "role": "pharmacist",
    "display_name": "New Display Name",
    "wallet_address": "0x...",
    "updated_at": "2025-01-16T13:30:00Z"
  }
}
```

---

## 4. Doctors

### POST `/api/doctors`
**Protected endpoint. Doctor role only.**

Register a doctor account (after user signup).

**Request Body:**
```json
{
  "wallet_address": "0xAbCd1234567890AbCd1234567890AbCd12345678",
  "license_number": "MED-2024-001",
  "full_name": "Dr. Sarah Smith",
  "specialty": "Cardiologist",
  "nft_token_id": "1"
}
```

**Fields:**
- `wallet_address` (required, string): EVM wallet
- `license_number` (required, string): 3-50 chars, alphanumeric + hyphens
- `full_name` (required, string): 2-150 chars
- `specialty` (required, string): 2-100 chars
- `nft_token_id` (optional, string): Soulbound NFT token ID

**Response (201):**
```json
{
  "success": true,
  "data": {
    "doctor_id": "7f8a9b0c-1d2e-3f4a-5b6c-7d8e9f0a1b2c",
    "message": "Dr. Sarah Smith registered successfully."
  }
}
```

**Error (409) - Duplicate License:**
```json
{
  "success": false,
  "error": "A doctor with this license number already exists.",
  "code": "CONFLICT"
}
```

---

### GET `/api/doctors`
**Protected endpoint. Doctor, Pharmacist, Regulator.**

List all doctors with pagination and filters.

**Query Parameters:**
- `page` (optional, number): Default 1
- `limit` (optional, number): Default 20, max 100
- `active_only` (optional, boolean): Filter to active doctors only
- `search` (optional, string): Search by name or license number

**Example:**
```
GET /api/doctors?page=1&limit=20&active_only=true&search=smith
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "7f8a9b0c-1d2e-3f4a-5b6c-7d8e9f0a1b2c",
      "wallet_address": "0xAbCd1234567890AbCd1234567890AbCd12345678",
      "license_number": "MED-2024-001",
      "full_name": "Dr. Sarah Smith",
      "specialty": "Cardiologist",
      "nft_token_id": "1",
      "is_active": true,
      "registered_at": "2025-01-15T09:00:00Z",
      "revoked_at": null,
      "revoked_by": null
    }
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "pages": 3
  }
}
```

---

### GET `/api/doctors/verify?wallet=0x...`
**Protected endpoint. Pharmacist, Regulator.**

Verify a doctor's wallet address and retrieve details.

**Query Parameters:**
- `wallet` (required if nft_token_id not provided): Doctor's EVM wallet
- `nft_token_id` (required if wallet not provided): Doctor's NFT token ID

**Response (200) - Verified:**
```json
{
  "success": true,
  "data": {
    "verified": true,
    "doctor": {
      "id": "7f8a9b0c-1d2e-3f4a-5b6c-7d8e9f0a1b2c",
      "full_name": "Dr. Sarah Smith",
      "license_number": "MED-2024-001",
      "specialty": "Cardiologist",
      "nft_token_id": "1",
      "wallet_address": "0xAbCd1234567890AbCd1234567890AbCd12345678",
      "is_active": true,
      "registered_at": "2025-01-15T09:00:00Z"
    }
  }
}
```

**Response (200) - Not Verified:**
```json
{
  "success": true,
  "data": {
    "verified": false,
    "reason": "Doctor not found in registry or license revoked."
  }
}
```

---

### GET `/api/doctors/[id]`
**Protected endpoint. Doctor, Pharmacist, Regulator.**

Get a specific doctor's details.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "7f8a9b0c-1d2e-3f4a-5b6c-7d8e9f0a1b2c",
    "wallet_address": "0xAbCd1234567890AbCd1234567890AbCd12345678",
    "license_number": "MED-2024-001",
    "full_name": "Dr. Sarah Smith",
    "specialty": "Cardiologist",
    "nft_token_id": "1",
    "is_active": true,
    "registered_at": "2025-01-15T09:00:00Z",
    "revoked_at": null,
    "revoked_by": null
  }
}
```

---

### PATCH `/api/doctors/[id]`
**Protected endpoint. Regulator only.**

Revoke a doctor's license.

**Request Body:**
```json
{
  "reason": "Prescribing controlled substances without proper authorization."
}
```

**Fields:**
- `reason` (required, string): Min 10, max 500 characters

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "7f8a9b0c-1d2e-3f4a-5b6c-7d8e9f0a1b2c",
    "full_name": "Dr. Sarah Smith",
    "is_active": false,
    "revoked_at": "2025-01-16T14:00:00Z",
    "revoked_by": "regulator-user-id",
    "message": "License for Dr. Sarah Smith has been revoked."
  }
}
```

---

## 5. Prescriptions

### POST `/api/prescriptions`
**Protected endpoint. Doctor role only.**

Submit a new prescription.

**Request Body:**
```json
{
  "prescription_hash": "0xdeadbeef1234567890abcdef",
  "patient_identifier": "PAT-ANON-4821",
  "medicine": "Amoxicillin",
  "dosage": "500mg twice daily for 7 days",
  "expiry_date": "2025-03-01T00:00:00Z",
  "signature": "0x4a5b6c7d8e9f...",
  "nft_doctor_id": "1",
  "doctor_wallet": "0xAbCd1234567890AbCd1234567890AbCd12345678"
}
```

**Fields:**
- `prescription_hash` (required, string): Unique hash of the prescription
- `patient_identifier` (required, string): Anonymized patient ID
- `medicine` (required, string): Drug name
- `dosage` (required, string): Dosing instructions
- `expiry_date` (required, string): ISO 8601 datetime, must be future date
- `signature` (required, string): MetaMask signature
- `nft_doctor_id` (required, string): Doctor's NFT token ID
- `doctor_wallet` (required, string): Doctor's EVM wallet address

**Response (201):**
```json
{
  "success": true,
  "data": {
    "prescription_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "prescription_hash": "0xdeadbeef1234567890abcdef",
    "message": "Prescription for Amoxicillin submitted successfully."
  }
}
```

**Error (409) - Duplicate Hash:**
```json
{
  "success": false,
  "error": "A prescription with this hash already exists.",
  "code": "CONFLICT"
}
```

---

### GET `/api/prescriptions`
**Protected endpoint. Doctor, Pharmacist, Regulator.**

List prescriptions with pagination and filters.

**Query Parameters:**
- `page` (optional, number): Default 1
- `limit` (optional, number): Default 20, max 100
- `status` (optional, enum): `active`, `filled`, `expired`, `revoked`

**Note:** Doctors only see their own prescriptions. Pharmacists and regulators see all.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "prescription_hash": "0xdeadbeef1234567890abcdef",
      "patient_identifier": "PAT-ANON-4821",
      "medicine": "Amoxicillin",
      "dosage": "500mg twice daily for 7 days",
      "issued_at": "2025-01-16T10:00:00Z",
      "expiry_date": "2025-03-01T00:00:00Z",
      "status": "active",
      "filled_at": null,
      "chain_verified": false,
      "doctors": {
        "full_name": "Dr. Sarah Smith",
        "license_number": "MED-2024-001",
        "specialty": "Cardiologist",
        "wallet_address": "0x..."
      }
    }
  ],
  "meta": {
    "total": 142,
    "page": 1,
    "limit": 20,
    "pages": 8
  }
}
```

---

### GET `/api/prescriptions/[id]`
**Protected endpoint. Doctor, Pharmacist, Regulator.**

Get a specific prescription's details.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "prescription_hash": "0xdeadbeef1234567890abcdef",
    "patient_identifier": "PAT-ANON-4821",
    "medicine": "Amoxicillin",
    "dosage": "500mg twice daily for 7 days",
    "issued_at": "2025-01-16T10:00:00Z",
    "expiry_date": "2025-03-01T00:00:00Z",
    "status": "active",
    "filled_at": null,
    "filled_by_pharmacy": null,
    "chain_verified": false,
    "doctors": {
      "id": "7f8a9b0c-1d2e-3f4a-5b6c-7d8e9f0a1b2c",
      "full_name": "Dr. Sarah Smith",
      "license_number": "MED-2024-001",
      "specialty": "Cardiologist",
      "wallet_address": "0x..."
    }
  }
}
```

---

### PATCH `/api/prescriptions/[id]`
**Protected endpoint. Pharmacist, Regulator.**

Mark a prescription as filled.

**Request Body:**
```json
{
  "pharmacy_wallet": "0xPhArMaCy1234567890AbCd1234567890AbCd1234",
  "chain_verified": true
}
```

**Fields:**
- `pharmacy_wallet` (required, string): Pharmacy's EVM wallet
- `chain_verified` (optional, boolean): Whether contract verified this fill. Default: true

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "prescription_hash": "0xdeadbeef1234567890abcdef",
    "status": "filled",
    "filled_at": "2025-01-16T12:00:00Z",
    "filled_by_pharmacy": "0xPhArMaCy1234567890AbCd1234567890AbCd1234",
    "chain_verified": true
  }
}
```

---

## 6. Fraud Detection

### POST `/api/fraud-check`
**Protected endpoint. Pharmacist, Regulator.**

Report a prescription fraud flag (called after smart contract rejects).

**Request Body:**
```json
{
  "prescription_hash": "0xdeadbeef1234567890abcdef",
  "pharmacy_wallet": "0xPhArMaCy1234567890AbCd1234567890AbCd1234",
  "patient_identifier": "PAT-ANON-4821",
  "doctor_wallet": "0xAbCd1234567890AbCd1234567890AbCd12345678",
  "medicine": "Amoxicillin",
  "expiry_date": "2025-03-01T00:00:00Z",
  "smart_contract_reason": "Doctor exceeded 30 prescriptions today",
  "smart_contract_response": { "verified": false, "reason": "Doctor daily limit exceeded" }
}
```

**Fields:**
- `prescription_hash` (optional, string): Hash of the prescription
- `pharmacy_wallet` (required, string): Pharmacy wallet
- `patient_identifier` (optional, string): Anonymized patient ID
- `doctor_wallet` (optional, string): Doctor's wallet (for context enrichment)
- `medicine` (optional, string): Drug name
- `expiry_date` (optional, string): Prescription expiry date
- `smart_contract_reason` (required, string): Raw error message from smart contract
- `smart_contract_response` (optional, object): Full contract response object

**Response (200):**
```json
{
  "success": true,
  "data": {
    "stored": true,
    "alert_id": "f1e2d3c4-b5a6-7890-abcd-ef0987654321",
    "fraud_reason": "doctor_daily_limit_exceeded",
    "severity": "high",
    "explanation": "Dr. Sarah Smith has already issued 30 prescriptions today, which is the maximum allowed limit. This security measure helps prevent prescription abuse and ensures patient safety.",
    "action_required": "Do not fill this prescription. Contact your supervisor and report the issuing doctor."
  }
}
```

**Fraud Reasons Detected:**
- `doctor_daily_limit_exceeded` - Doctor issued >30 prescriptions today (Severity: high)
- `patient_pharmacy_limit_exceeded` - Patient visited >3 pharmacies today (Severity: medium)
- `doctor_license_revoked` - Doctor's license is revoked (Severity: high)
- `prescription_expired` - Prescription past expiry date (Severity: low)
- `invalid_signature` - Digital signature validation failed (Severity: high)
- `doctor_not_registered` - Doctor not in verified registry (Severity: high)

---

### GET `/api/fraud-check`
**Protected endpoint. Pharmacist, Regulator.**

List fraud alerts with pagination and filters.

**Query Parameters:**
- `page` (optional, number): Default 1
- `limit` (optional, number): Default 20, max 100
- `resolved` (optional, boolean): Filter to resolved/unresolved
- `severity` (optional, enum): `low`, `medium`, `high`

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "f1e2d3c4-b5a6-7890-abcd-ef0987654321",
      "prescription_hash": "0xdeadbeef1234567890abcdef",
      "patient_identifier": "PAT-ANON-4821",
      "pharmacy_wallet": "0xPhArMaCy1234567890AbCd1234567890AbCd1234",
      "reason": "doctor_daily_limit_exceeded",
      "severity": "high",
      "ai_explanation": "Dr. Sarah Smith has already issued 30 prescriptions...",
      "action_required": "Do not fill this prescription...",
      "resolved": false,
      "resolved_at": null,
      "resolution_notes": null,
      "created_at": "2025-01-16T11:30:00Z",
      "doctors": {
        "full_name": "Dr. Sarah Smith",
        "license_number": "MED-2024-001",
        "wallet_address": "0x..."
      }
    }
  ],
  "meta": {
    "total": 8,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

---

### GET `/api/fraud-check/[id]`
**Protected endpoint. Pharmacist, Regulator.**

Get details of a specific fraud alert.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "f1e2d3c4-b5a6-7890-abcd-ef0987654321",
    "prescription_hash": "0xdeadbeef1234567890abcdef",
    "patient_identifier": "PAT-ANON-4821",
    "pharmacy_wallet": "0xPhArMaCy1234567890AbCd1234567890AbCd1234",
    "reason": "doctor_daily_limit_exceeded",
    "severity": "high",
    "ai_explanation": "Dr. Sarah Smith has already issued 30 prescriptions today...",
    "action_required": "Do not fill this prescription. Contact your supervisor...",
    "smart_contract_response": { "verified": false, "reason": "..." },
    "resolved": false,
    "resolved_at": null,
    "resolution_notes": null,
    "created_at": "2025-01-16T11:30:00Z",
    "doctors": {
      "id": "7f8a9b0c-1d2e-3f4a-5b6c-7d8e9f0a1b2c",
      "full_name": "Dr. Sarah Smith",
      "license_number": "MED-2024-001",
      "wallet_address": "0x..."
    }
  }
}
```

---

### PATCH `/api/fraud-check/[id]`
**Protected endpoint. Regulator only.**

Resolve a fraud alert (mark as reviewed).

**Request Body:**
```json
{
  "resolution_notes": "Verified with the doctor. Prescriptions were for multiple clinic locations."
}
```

**Fields:**
- `resolution_notes` (required, string): Min 10, max 1000 characters

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "f1e2d3c4-b5a6-7890-abcd-ef0987654321",
    "reason": "doctor_daily_limit_exceeded",
    "severity": "high",
    "resolved": true,
    "resolved_at": "2025-01-16T15:00:00Z",
    "resolved_by": "regulator-user-id",
    "resolution_notes": "Verified with the doctor. Prescriptions were for multiple clinic locations.",
    "message": "Fraud alert marked as resolved."
  }
}
```

---

## 7. Analytics & Reporting

### GET `/api/analytics?days=7`
**Protected endpoint. Regulator only.**

Get healthcare system analytics and fraud monitoring dashboard.

**Query Parameters:**
- `days` (optional, number): Days to include in report. Default 7, max 90

**Response (200):**
```json
{
  "success": true,
  "data": {
    "period": {
      "days": 7,
      "from": "2025-01-09T00:00:00Z",
      "to": "2025-01-16T23:59:59Z"
    },
    "prescriptions": {
      "total": 142,
      "filled": 118,
      "expired": 12,
      "revoked": 2,
      "active": 10,
      "fill_rate": "83.10%"
    },
    "fraud": {
      "total_alerts": 8,
      "resolved": 5,
      "unresolved": 3,
      "fraud_rate": "5.63%",
      "by_severity": {
        "high": 5,
        "medium": 2,
        "low": 1
      },
      "top_reasons": [
        {
          "reason": "doctor_daily_limit_exceeded",
          "count": 4
        },
        {
          "reason": "patient_pharmacy_limit_exceeded",
          "count": 2
        }
      ]
    },
    "doctors": {
      "active": 23,
      "revoked": 1,
      "total": 24
    },
    "daily_breakdown": [
      {
        "date": "2025-01-09",
        "prescriptions": 18,
        "fraud_alerts": 0,
        "filled": 15
      },
      {
        "date": "2025-01-10",
        "prescriptions": 21,
        "fraud_alerts": 2,
        "filled": 19
      }
    ],
    "ai_summary": "This week's monitoring identified 8 suspicious prescription attempts, with excessive daily prescribing by individual doctors being the most common issue. Regulators should review the 3 unresolved high-severity alerts..."
  }
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {
    "field_name": ["Error for this field"]
  }
}
```

### Common HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Request completed |
| 201 | Created | Resource created |
| 400 | Bad Request | Validation failed, missing fields |
| 401 | Unauthorized | Missing or invalid auth token |
| 403 | Forbidden | User lacks permission for this action |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate resource |
| 429 | Rate Limited | Too many requests |
| 500 | Server Error | Unexpected backend error |
| 503 | Unavailable | Database or service offline |

### Rate Limiting Headers

All responses include:
```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1705432500
```

When rate limited (429):
```http
Retry-After: 30
```

---

## CORS & Security

- All endpoints require `Origin` header matching `ALLOWED_ORIGINS` environment variable
- API enforces RLS (Row Level Security) at database level
- Sensitive keys (service role, Gemini API) are server-only
- All requests are rate-limited per IP address
- Requests require valid JWT token (except public endpoints)

---

## Implementation Examples

### Frontend: Login Flow
```typescript
// POST /api/auth/login
const response = await fetch("http://localhost:3000/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "user@example.com",
    password: "password"
  })
});

const { data } = await response.json();
localStorage.setItem("accessToken", data.access_token);
localStorage.setItem("refreshToken", data.refresh_token);
```

### Frontend: API Call with Auth
```typescript
const token = localStorage.getItem("accessToken");

const response = await fetch("http://localhost:3000/api/prescriptions", {
  method: "GET",
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  }
});

const { data, meta } = await response.json();
```

### Smart Contract Integration
```solidity
// After verification check, if failed:
// Call backend fraud-check endpoint with contract reason

POST /api/fraud-check
{
  prescription_hash: prescriptionData.hash,
  pharmacy_wallet: msg.sender,
  smart_contract_reason: "Doctor exceeded 30 prescriptions today",
  smart_contract_response: { verified: false, reason: "..." }
}
```

The backend will:
1. Map the contract reason to a typed `FraudReason`
2. Fetch context (doctor name, prescription count) from database
3. Call Gemini AI to generate plain-English explanation
4. Store alert in database with AI explanation
5. Return severity and action instructions to pharmacy UI
