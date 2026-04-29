import { z } from "zod";

// ── Reusable field schemas ──────────────────────────────────────────────────

export const walletAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid Ethereum/EVM wallet address (0x + 40 hex chars)");

export const uuidSchema = z
  .string()
  .uuid("Must be a valid UUID");

export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => Math.max(1, parseInt(v ?? "1"))),
  limit: z
    .string()
    .optional()
    .transform((v) => Math.min(100, Math.max(1, parseInt(v ?? "20")))),
});

// ── Auth schemas ────────────────────────────────────────────────────────────

export const signUpSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters"),
  role: z.enum(["doctor", "pharmacist", "regulator"], {
    errorMap: () => ({ message: "Role must be doctor, pharmacist, or regulator" }),
  }),
  display_name: z.string().min(2, "Display name must be at least 2 characters").max(100).optional(),
  wallet_address: walletAddressSchema.optional(),
});

export const updateProfileSchema = z.object({
  display_name: z.string().min(2).max(100).optional(),
  wallet_address: walletAddressSchema.optional(),
});

// ── Doctor schemas ──────────────────────────────────────────────────────────

export const registerDoctorSchema = z.object({
  wallet_address: walletAddressSchema,
  license_number: z
    .string()
    .min(3, "License number must be at least 3 characters")
    .max(50)
    .regex(/^[A-Z0-9\-]+$/i, "License number may only contain letters, numbers, and hyphens"),
  full_name: z.string().min(2, "Full name required").max(150),
  specialty: z.string().min(2, "Specialty required").max(100),
  nft_token_id: z.string().max(100).optional(),
});

export const revokeDoctorSchema = z.object({
  reason: z.string().min(10, "Please provide a reason (min 10 characters)").max(500),
});

// ── Prescription schemas ────────────────────────────────────────────────────

export const submitPrescriptionSchema = z.object({
  prescription_hash: z
    .string()
    .min(1, "Prescription hash is required")
    .max(200),
  patient_identifier: z
    .string()
    .min(1, "Patient identifier is required")
    .max(100),
  medicine: z.string().min(1, "Medicine name is required").max(200),
  dosage: z.string().min(1, "Dosage is required").max(200),
  expiry_date: z.string().datetime("Expiry date must be ISO 8601 format (e.g. 2025-12-31T00:00:00Z)"),
  signature: z.string().min(1, "MetaMask signature is required"),
  nft_doctor_id: z.string().min(1, "NFT doctor token ID is required").max(100),
  doctor_wallet: walletAddressSchema,
});

export const fillPrescriptionSchema = z.object({
  pharmacy_wallet: walletAddressSchema,
  chain_verified: z.boolean().optional().default(true),
});

// ── Fraud check schemas ─────────────────────────────────────────────────────

export const fraudCheckSchema = z.object({
  prescription_hash: z.string().max(200).optional(),
  pharmacy_wallet: walletAddressSchema,
  patient_identifier: z.string().max(100).optional(),
  doctor_wallet: walletAddressSchema.optional(),
  medicine: z.string().max(200).optional(),
  expiry_date: z.string().optional(),
  smart_contract_reason: z.string().min(1, "Smart contract reason is required").max(500),
  smart_contract_response: z.record(z.unknown()).optional(),
});

export const resolveFraudAlertSchema = z.object({
  resolution_notes: z.string().min(10, "Resolution notes required (min 10 characters)").max(1000),
});

// ── Type exports ────────────────────────────────────────────────────────────

export type SignUpInput = z.infer<typeof signUpSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type RegisterDoctorInput = z.infer<typeof registerDoctorSchema>;
export type RevokeDoctorInput = z.infer<typeof revokeDoctorSchema>;
export type SubmitPrescriptionInput = z.infer<typeof submitPrescriptionSchema>;
export type FillPrescriptionInput = z.infer<typeof fillPrescriptionSchema>;
export type FraudCheckInput = z.infer<typeof fraudCheckSchema>;
export type ResolveFraudAlertInput = z.infer<typeof resolveFraudAlertSchema>;
