# Heal Backend — Frontend Integration Guide

## Quick Start for React Projects

### 1. Install HTTP Client (if not already using one)
```bash
# Using Axios (recommended for this guide)
npm install axios

# Or use built-in fetch (no install needed)
```

### 2. Create Backend API Client

Create `src/lib/api.ts` in your React project:

```typescript
import axios, { AxiosError } from "axios";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: BACKEND_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ── Request Interceptor: Attach auth token ──────────────────────────────

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("heal_access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response Interceptor: Handle 401, refresh token ────────────────────

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;

    // If 401 and we haven't tried refresh yet
    if (error.response?.status === 401 && !originalRequest?._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem("heal_refresh_token");
        if (!refreshToken) {
          // No refresh token — redirect to login
          window.location.href = "/login";
          return Promise.reject(error);
        }

        // Try to refresh
        const { data } = await axios.put(`${BACKEND_URL}/api/auth/login`, {
          refresh_token: refreshToken,
        });

        // Store new tokens
        localStorage.setItem("heal_access_token", data.data.access_token);
        localStorage.setItem("heal_refresh_token", data.data.refresh_token);

        // Retry original request with new token
        if (originalRequest?.headers) {
          originalRequest.headers.Authorization = `Bearer ${data.data.access_token}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed — force logout
        localStorage.removeItem("heal_access_token");
        localStorage.removeItem("heal_refresh_token");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// ── Auth Endpoints ─────────────────────────────────────────────────────

export async function signup(payload: {
  email: string;
  password: string;
  role: "doctor" | "pharmacist" | "regulator";
  display_name?: string;
  wallet_address?: string;
}) {
  const { data } = await apiClient.post("/api/auth/signup", payload);
  return data.data;
}

export async function login(email: string, password: string) {
  const { data } = await apiClient.post("/api/auth/login", {
    email,
    password,
  });

  // Store tokens
  localStorage.setItem("heal_access_token", data.data.access_token);
  localStorage.setItem("heal_refresh_token", data.data.refresh_token);
  localStorage.setItem("heal_user_role", data.data.user.role);
  localStorage.setItem("heal_user_id", data.data.user.id);

  return data.data;
}

export function logout() {
  localStorage.removeItem("heal_access_token");
  localStorage.removeItem("heal_refresh_token");
  localStorage.removeItem("heal_user_role");
  localStorage.removeItem("heal_user_id");
}

export function getStoredToken() {
  return localStorage.getItem("heal_access_token");
}

export function getStoredRole() {
  return localStorage.getItem("heal_user_role") as "doctor" | "pharmacist" | "regulator" | null;
}

// ── User Profile ───────────────────────────────────────────────────────

export async function getProfile() {
  const { data } = await apiClient.get("/api/me");
  return data.data;
}

export async function updateProfile(updates: { display_name?: string; wallet_address?: string }) {
  const { data } = await apiClient.patch("/api/me", updates);
  return data.data;
}

// ── Doctor Endpoints ───────────────────────────────────────────────────

export async function registerDoctor(payload: {
  wallet_address: string;
  license_number: string;
  full_name: string;
  specialty: string;
  nft_token_id?: string;
}) {
  const { data } = await apiClient.post("/api/doctors", payload);
  return data.data;
}

export async function listDoctors(page = 1, limit = 20, activeOnly = true, search = "") {
  const { data } = await apiClient.get("/api/doctors", {
    params: { page, limit, active_only: activeOnly, search },
  });
  return data;
}

export async function getDoctorById(id: string) {
  const { data } = await apiClient.get(`/api/doctors/${id}`);
  return data.data;
}

export async function verifyDoctorByWallet(wallet: string) {
  const { data } = await apiClient.get("/api/doctors/verify", {
    params: { wallet },
  });
  return data.data;
}

export async function verifyDoctorByNFT(nftTokenId: string) {
  const { data } = await apiClient.get("/api/doctors/verify", {
    params: { nft_token_id: nftTokenId },
  });
  return data.data;
}

export async function revokeDoctor(id: string, reason: string) {
  const { data } = await apiClient.patch(`/api/doctors/${id}`, { reason });
  return data.data;
}

// ── Prescription Endpoints ────────────────────────────────────────────

export async function submitPrescription(payload: {
  prescription_hash: string;
  patient_identifier: string;
  medicine: string;
  dosage: string;
  expiry_date: string;
  signature: string;
  nft_doctor_id: string;
  doctor_wallet: string;
}) {
  const { data } = await apiClient.post("/api/prescriptions", payload);
  return data.data;
}

export async function listPrescriptions(page = 1, limit = 20, status?: string) {
  const { data } = await apiClient.get("/api/prescriptions", {
    params: { page, limit, ...(status && { status }) },
  });
  return data;
}

export async function getPrescriptionById(id: string) {
  const { data } = await apiClient.get(`/api/prescriptions/${id}`);
  return data.data;
}

export async function fillPrescription(
  id: string,
  pharmacy_wallet: string,
  chain_verified = true
) {
  const { data } = await apiClient.patch(`/api/prescriptions/${id}`, {
    pharmacy_wallet,
    chain_verified,
  });
  return data.data;
}

// ── Fraud Detection Endpoints ───────────────────────────────────────────

/**
 * Report a prescription fraud flag
 * Called AFTER smart contract verification fails
 */
export async function reportFraudFlag(payload: {
  prescription_hash?: string;
  pharmacy_wallet: string;
  patient_identifier?: string;
  doctor_wallet?: string;
  medicine?: string;
  expiry_date?: string;
  smart_contract_reason: string; // Raw error from contract
  smart_contract_response?: Record<string, unknown>;
}) {
  const { data } = await apiClient.post("/api/fraud-check", payload);
  return data.data;
}

export async function listFraudAlerts(
  page = 1,
  limit = 20,
  resolved?: boolean,
  severity?: "low" | "medium" | "high"
) {
  const { data } = await apiClient.get("/api/fraud-check", {
    params: {
      page,
      limit,
      ...(resolved !== undefined && { resolved }),
      ...(severity && { severity }),
    },
  });
  return data;
}

export async function getFraudAlertById(id: string) {
  const { data } = await apiClient.get(`/api/fraud-check/${id}`);
  return data.data;
}

export async function resolveFraudAlert(id: string, resolution_notes: string) {
  const { data } = await apiClient.patch(`/api/fraud-check/${id}`, {
    resolution_notes,
  });
  return data.data;
}

// ── Analytics Endpoints ────────────────────────────────────────────────

export async function getAnalytics(days = 7) {
  const { data } = await apiClient.get("/api/analytics", {
    params: { days },
  });
  return data.data;
}

// ── Health Check ───────────────────────────────────────────────────────

export async function checkHealth() {
  const { data } = await axios.get(`${BACKEND_URL}/api/health`);
  return data;
}

// ── Error Handling Helper ──────────────────────────────────────────────

export function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    return error.response?.data?.error || error.message || "An error occurred";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected error occurred";
}

export default apiClient;
```

### 3. Add Environment Variable

Create or update `.env` in your React project:

```bash
VITE_BACKEND_URL=http://localhost:3000
```

For production, update to:
```bash
VITE_BACKEND_URL=https://your-backend-api.com
```

---

## Usage Examples by Role

### Doctor: Register & Issue Prescription

```typescript
import {
  registerDoctor,
  submitPrescription,
  listPrescriptions,
} from "@/lib/api";

export function DoctorPage() {
  const [isRegistered, setIsRegistered] = useState(false);

  // Step 1: Register doctor
  async function handleRegister(
    walletAddress: string,
    licenseNumber: string
  ) {
    try {
      await registerDoctor({
        wallet_address: walletAddress,
        license_number: licenseNumber,
        full_name: "Dr. Sarah Smith",
        specialty: "Cardiologist",
        nft_token_id: "1",
      });
      setIsRegistered(true);
      toast.success("Registered successfully!");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  // Step 2: Issue prescription
  async function handleIssuePrescription(
    prescriptionHash: string,
    patientId: string,
    medicine: string,
    signature: string
  ) {
    try {
      const result = await submitPrescription({
        prescription_hash: prescriptionHash,
        patient_identifier: patientId,
        medicine,
        dosage: "500mg twice daily for 7 days",
        expiry_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
        signature,
        nft_doctor_id: "1",
        doctor_wallet: walletAddress,
      });

      toast.success(`Prescription ${result.prescription_id} submitted!`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  // Step 3: View issued prescriptions
  async function handleLoadPrescriptions() {
    try {
      const { prescriptions, meta } = await listPrescriptions();
      console.log("Your prescriptions:", prescriptions);
      console.log("Total:", meta.total);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <div>
      {!isRegistered ? (
        <button onClick={() => handleRegister(wallet, license)}>
          Register as Doctor
        </button>
      ) : (
        <>
          <button onClick={handleLoadPrescriptions}>Load My Prescriptions</button>
          <button onClick={handleIssuePrescription}>Issue New Prescription</button>
        </>
      )}
    </div>
  );
}
```

### Pharmacist: Verify & Fill Prescription

```typescript
import {
  verifyDoctorByWallet,
  reportFraudFlag,
  fillPrescription,
  getFraudAlertById,
} from "@/lib/api";

export function PharmacyPage() {
  const [fraudExplanation, setFraudExplanation] = useState<string | null>(null);

  // Step 1: Verify doctor before filling
  async function handleVerifyDoctor(doctorWallet: string) {
    try {
      const result = await verifyDoctorByWallet(doctorWallet);

      if (result.verified) {
        console.log("Doctor verified:", result.doctor.full_name);
        return true;
      } else {
        toast.warning(result.reason);
        return false;
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
      return false;
    }
  }

  // Step 2: Smart contract verification (in your dApp code)
  // const contractResult = await verifyOnChain(prescriptionHash);
  // if (!contractResult.verified) { → call reportFraudFlag below }

  // Step 3: If smart contract rejects, get AI explanation
  async function handleSmartContractRejection(
    prescriptionHash: string,
    contractReason: string,
    contractResponse: Record<string, unknown>
  ) {
    try {
      const result = await reportFraudFlag({
        prescription_hash: prescriptionHash,
        pharmacy_wallet: userWallet,
        smart_contract_reason: contractReason,
        smart_contract_response: contractResponse,
        medicine: "Amoxicillin",
      });

      // Display AI explanation in UI
      setFraudExplanation(result.explanation);

      // Color code by severity
      const severityColor = {
        high: "red",
        medium: "yellow",
        low: "orange",
      }[result.severity];

      toast.error(
        `Fraud Alert [${result.severity.toUpperCase()}]: ${result.action_required}`,
        {
          style: { borderLeft: `4px solid ${severityColor}` },
        }
      );

      return result;
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  // Step 4: If verification succeeds, fill prescription
  async function handleFillPrescription(prescriptionId: string) {
    try {
      const result = await fillPrescription(
        prescriptionId,
        userWallet, // pharmacy_wallet
        true // chain_verified
      );

      toast.success("Prescription filled and recorded!");
      return result;
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <div>
      {fraudExplanation && (
        <Alert variant="destructive">
          <AlertTitle>Fraud Alert</AlertTitle>
          <AlertDescription>{fraudExplanation}</AlertDescription>
        </Alert>
      )}
      <button onClick={() => handleVerifyDoctor(doctorWallet)}>
        Verify Doctor
      </button>
      <button onClick={() => handleFillPrescription(prescriptionId)}>
        Fill Prescription
      </button>
    </div>
  );
}
```

### Regulator: Monitor & Manage

```typescript
import {
  listDoctors,
  revokeDoctor,
  listFraudAlerts,
  resolveFraudAlert,
  getAnalytics,
} from "@/lib/api";

export function RegulatorDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [fraudAlerts, setFraudAlerts] = useState([]);

  // Step 1: View system analytics
  async function loadAnalytics() {
    try {
      const data = await getAnalytics(7); // Last 7 days
      setAnalytics(data);
      console.log("Prescription fill rate:", data.prescriptions.fill_rate);
      console.log("AI summary:", data.ai_summary);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  // Step 2: Review unresolved fraud alerts
  async function loadFraudAlerts() {
    try {
      const result = await listFraudAlerts(1, 50, false, "high"); // Unresolved, high severity
      setFraudAlerts(result.items);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  // Step 3: Resolve a fraud alert
  async function handleResolveFraudAlert(alertId: string) {
    try {
      const resolution = await resolveFraudAlert(
        alertId,
        "Verified with doctor. Multiple clinic locations caused high volume."
      );
      toast.success("Fraud alert resolved");
      loadFraudAlerts(); // Refresh list
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  // Step 4: Revoke doctor license
  async function handleRevokeLicense(doctorId: string, doctorName: string) {
    if (!confirm(`Revoke license for ${doctorName}?`)) return;

    try {
      await revokeDoctor(
        doctorId,
        "Failed compliance audit - prescribing patterns indicate potential drug trafficking"
      );
      toast.success("License revoked");
      // Refresh doctor list
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  // Step 5: View active doctors
  async function loadDoctors() {
    try {
      const result = await listDoctors(1, 100, true); // Active doctors only
      console.log("Active doctors:", result.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <div>
      <h1>Regulator Dashboard</h1>

      {analytics && (
        <div>
          <p>Prescriptions filled: {analytics.prescriptions.fill_rate}</p>
          <p>Fraud rate: {analytics.fraud.fraud_rate}</p>
          <p>AI Summary: {analytics.ai_summary}</p>
        </div>
      )}

      <h2>Unresolved Fraud Alerts ({fraudAlerts.length})</h2>
      {fraudAlerts.map((alert) => (
        <Card key={alert.id}>
          <CardHeader>
            <CardTitle>{alert.reason}</CardTitle>
            <CardDescription>
              Doctor: {alert.doctors?.full_name || "Unknown"} |
              Severity: <span style={{ color: alert.severity === "high" ? "red" : "orange" }}>
                {alert.severity}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>{alert.ai_explanation}</p>
            <p><strong>Action:</strong> {alert.action_required}</p>
          </CardContent>
          <CardFooter>
            <button
              onClick={() => handleResolveFraudAlert(alert.id)}
              className="btn btn-primary"
            >
              Mark Resolved
            </button>
          </CardFooter>
        </Card>
      ))}

      <button onClick={loadAnalytics}>Load Analytics</button>
      <button onClick={loadFraudAlerts}>Load Fraud Alerts</button>
      <button onClick={loadDoctors}>Load Doctors</button>
    </div>
  );
}
```

---

## Authentication Flow

### Using React Context + Hooks

```typescript
// src/context/AuthContext.tsx
import { createContext, useContext, useState, useEffect } from "react";
import { login, logout as apiLogout, getProfile, getStoredToken } from "@/lib/api";

interface User {
  id: string;
  email: string;
  role: "doctor" | "pharmacist" | "regulator";
  display_name: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is already logged in (token exists)
  useEffect(() => {
    async function checkAuth() {
      const token = getStoredToken();
      if (token) {
        try {
          const profile = await getProfile();
          setUser(profile);
        } catch {
          // Token invalid, clear it
          apiLogout();
        }
      }
      setIsLoading(false);
    }

    checkAuth();
  }, []);

  async function handleLogin(email: string, password: string) {
    const result = await login(email, password);
    setUser(result.user);
  }

  function handleLogout() {
    apiLogout();
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login: handleLogin,
        logout: handleLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
```

### Usage in Components

```typescript
import { useAuth } from "@/context/AuthContext";

function LoginPage() {
  const { login, isLoading } = useAuth();

  async function handleSubmit(email: string, password: string) {
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      handleSubmit(email, password);
    }}>
      {/* form fields */}
      <button disabled={isLoading}>
        {isLoading ? "Signing in..." : "Sign In"}
      </button>
    </form>
  );
}

function ProtectedPage() {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return (
    <div>
      <h1>Welcome, {user.display_name}</h1>
      <p>Role: {user.role}</p>
    </div>
  );
}
```

---

## Error Handling Best Practices

```typescript
import { AxiosError } from "axios";

function MyComponent() {
  async function handleAction() {
    try {
      const result = await someApiCall();
      // Handle success
    } catch (error) {
      if (error instanceof AxiosError) {
        // Network or API error
        if (error.response?.status === 401) {
          // Token expired or invalid
          navigateToLogin();
        } else if (error.response?.status === 403) {
          // User lacks permission
          toast.error("You don't have permission for this action");
        } else if (error.response?.status === 429) {
          // Rate limited
          toast.warning("Too many requests. Please try again in a moment.");
        } else {
          toast.error(error.response?.data?.error || error.message);
        }
      } else {
        // Client-side error
        toast.error("An unexpected error occurred");
      }
    }
  }
}
```

---

## Environment Setup

### Development (.env)
```bash
VITE_BACKEND_URL=http://localhost:3000
```

### Production (.env.production)
```bash
VITE_BACKEND_URL=https://api.yourdomain.com
```

### Vercel Environment Variables
In Vercel dashboard, set:
```
VITE_BACKEND_URL=https://your-heal-backend.vercel.app
```

---

## Testing with cURL/Postman

### Import Postman Collection

Create `postman_collection.json`:
```json
{
  "info": { "name": "Heal API", "version": "1.0.0" },
  "items": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "url": { "raw": "{{backend}}/api/health" }
      }
    },
    {
      "name": "Sign Up",
      "request": {
        "method": "POST",
        "url": { "raw": "{{backend}}/api/auth/signup" },
        "body": {
          "mode": "raw",
          "raw": "{\"email\": \"test@example.com\", \"password\": \"Test123!\", \"role\": \"pharmacist\"}"
        }
      }
    }
  ],
  "variable": [
    { "key": "backend", "value": "http://localhost:3000" }
  ]
}
```

Import into Postman: File → Import → paste JSON

---

## Troubleshooting Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "CORS error" | Frontend origin not in backend's `ALLOWED_ORIGINS` | Add your frontend URL to backend `.env.local` |
| "401 Unauthorized" | Token missing or expired | Call refresh endpoint, re-login if refresh fails |
| "Rate limited (429)" | Too many requests in 60s | Wait or reduce request frequency |
| "Prescription hash already exists" | Same prescription submitted twice | Use unique prescription hash per prescription |
| "Doctor not found" | Wrong wallet address | Verify doctor registration and wallet address match |

---

## Next Steps

1. ✅ Copy `src/lib/api.ts` to your React project
2. ✅ Set `VITE_BACKEND_URL` in `.env`
3. ✅ Wrap app with `<AuthProvider>`
4. ✅ Use `useAuth()` hook for authentication
5. ✅ Call API functions from `src/lib/api.ts`
6. ✅ Handle errors with `getErrorMessage()`
7. ✅ Test each role flow before deployment
8. ✅ Update `VITE_BACKEND_URL` for production
