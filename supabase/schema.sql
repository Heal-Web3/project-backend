-- ============================================================
-- Heal Blockchain Prescription Verification — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE user_role AS ENUM ('doctor', 'pharmacist', 'regulator');
CREATE TYPE prescription_status AS ENUM ('active', 'filled', 'expired', 'revoked');
CREATE TYPE fraud_severity AS ENUM ('low', 'medium', 'high');
CREATE TYPE fraud_reason AS ENUM (
  'doctor_daily_limit_exceeded',
  'patient_pharmacy_limit_exceeded',
  'doctor_license_revoked',
  'prescription_expired',
  'invalid_signature',
  'doctor_not_registered'
);

-- ============================================================
-- DOCTORS TABLE
-- ============================================================

CREATE TABLE doctors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address TEXT UNIQUE NOT NULL,
  license_number TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  nft_token_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_doctors_wallet ON doctors(wallet_address);
CREATE INDEX idx_doctors_license ON doctors(license_number);
CREATE INDEX idx_doctors_active ON doctors(is_active);

-- ============================================================
-- PATIENTS TABLE
-- (No PII stored — only anonymous identifiers from QR data)
-- ============================================================

CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_identifier TEXT UNIQUE NOT NULL, -- hashed or anonymous ID from QR
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patients_identifier ON patients(patient_identifier);

-- ============================================================
-- PRESCRIPTIONS TABLE
-- ============================================================

CREATE TABLE prescriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prescription_hash TEXT UNIQUE NOT NULL, -- on-chain hash
  doctor_id UUID NOT NULL REFERENCES doctors(id),
  patient_identifier TEXT NOT NULL,
  medicine TEXT NOT NULL,
  dosage TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expiry_date TIMESTAMPTZ NOT NULL,
  signature TEXT NOT NULL, -- MetaMask signature
  nft_doctor_id TEXT NOT NULL, -- on-chain NFT token ID
  status prescription_status NOT NULL DEFAULT 'active',
  filled_at TIMESTAMPTZ,
  filled_by_pharmacy TEXT, -- pharmacy wallet address
  chain_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prescriptions_hash ON prescriptions(prescription_hash);
CREATE INDEX idx_prescriptions_doctor ON prescriptions(doctor_id);
CREATE INDEX idx_prescriptions_patient ON prescriptions(patient_identifier);
CREATE INDEX idx_prescriptions_status ON prescriptions(status);
CREATE INDEX idx_prescriptions_issued_at ON prescriptions(issued_at);

-- ============================================================
-- FRAUD ALERTS TABLE
-- ============================================================

CREATE TABLE fraud_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prescription_hash TEXT, -- may be null if prescription not found
  doctor_id UUID REFERENCES doctors(id),
  patient_identifier TEXT,
  pharmacy_wallet TEXT NOT NULL,
  reason fraud_reason NOT NULL,
  severity fraud_severity NOT NULL,
  ai_explanation TEXT NOT NULL, -- Gemini-generated plain-English explanation
  action_required TEXT NOT NULL,
  smart_contract_response JSONB, -- raw response from Hedera smart contract
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fraud_alerts_prescription ON fraud_alerts(prescription_hash);
CREATE INDEX idx_fraud_alerts_doctor ON fraud_alerts(doctor_id);
CREATE INDEX idx_fraud_alerts_severity ON fraud_alerts(severity);
CREATE INDEX idx_fraud_alerts_resolved ON fraud_alerts(resolved);
CREATE INDEX idx_fraud_alerts_created_at ON fraud_alerts(created_at);

-- ============================================================
-- USER PROFILES TABLE
-- (Extends Supabase auth.users with role information)
-- ============================================================

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  wallet_address TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_wallet ON user_profiles(wallet_address);

-- ============================================================
-- VERIFICATION LOGS TABLE
-- (Audit trail of every verification attempt)
-- ============================================================

CREATE TABLE verification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prescription_hash TEXT NOT NULL,
  pharmacy_wallet TEXT NOT NULL,
  verified BOOLEAN NOT NULL,
  fraud_alert_id UUID REFERENCES fraud_alerts(id),
  smart_contract_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_verification_logs_hash ON verification_logs(prescription_hash);
CREATE INDEX idx_verification_logs_pharmacy ON verification_logs(pharmacy_wallet);
CREATE INDEX idx_verification_logs_created_at ON verification_logs(created_at);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_doctors_updated_at
  BEFORE UPDATE ON doctors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prescriptions_updated_at
  BEFORE UPDATE ON prescriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, role, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'pharmacist')::user_role,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Doctors: doctors can see their own record; regulators see all
CREATE POLICY "doctors_select" ON doctors FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'regulator'
    )
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'pharmacist'
    )
  );

CREATE POLICY "doctors_insert" ON doctors FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "doctors_update" ON doctors FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'regulator'
    )
  );

-- Prescriptions: doctors see their own; pharmacists and regulators see all
CREATE POLICY "prescriptions_select" ON prescriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM doctors d
      WHERE d.id = prescriptions.doctor_id AND d.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('pharmacist', 'regulator')
    )
  );

CREATE POLICY "prescriptions_insert" ON prescriptions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM doctors d
      WHERE d.id = prescriptions.doctor_id AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "prescriptions_update" ON prescriptions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM doctors d
      WHERE d.id = prescriptions.doctor_id AND d.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('pharmacist', 'regulator')
    )
  );

-- Fraud alerts: pharmacists and regulators only
CREATE POLICY "fraud_alerts_select" ON fraud_alerts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('pharmacist', 'regulator')
    )
  );

CREATE POLICY "fraud_alerts_insert" ON fraud_alerts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('pharmacist', 'regulator')
    )
  );

CREATE POLICY "fraud_alerts_update" ON fraud_alerts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'regulator'
    )
  );

-- User profiles: each user can read/update their own
CREATE POLICY "user_profiles_select" ON user_profiles FOR SELECT
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'regulator'
    )
  );

CREATE POLICY "user_profiles_update" ON user_profiles FOR UPDATE
  USING (id = auth.uid());

-- Verification logs: pharmacists and regulators
CREATE POLICY "verification_logs_select" ON verification_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('pharmacist', 'regulator')
    )
  );

CREATE POLICY "verification_logs_insert" ON verification_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('pharmacist', 'regulator')
    )
  );

-- ============================================================
-- ANALYTICS VIEW
-- ============================================================

CREATE OR REPLACE VIEW prescription_analytics AS
SELECT
  DATE_TRUNC('day', p.issued_at) AS date,
  COUNT(*) AS total_prescriptions,
  COUNT(CASE WHEN p.status = 'filled' THEN 1 END) AS filled_count,
  COUNT(CASE WHEN p.status = 'expired' THEN 1 END) AS expired_count,
  COUNT(CASE WHEN p.status = 'revoked' THEN 1 END) AS revoked_count,
  COUNT(DISTINCT p.doctor_id) AS unique_doctors,
  COUNT(DISTINCT p.patient_identifier) AS unique_patients
FROM prescriptions p
GROUP BY DATE_TRUNC('day', p.issued_at)
ORDER BY date DESC;

CREATE OR REPLACE VIEW fraud_analytics AS
SELECT
  DATE_TRUNC('day', fa.created_at) AS date,
  COUNT(*) AS total_alerts,
  COUNT(CASE WHEN fa.severity = 'high' THEN 1 END) AS high_severity,
  COUNT(CASE WHEN fa.severity = 'medium' THEN 1 END) AS medium_severity,
  COUNT(CASE WHEN fa.severity = 'low' THEN 1 END) AS low_severity,
  COUNT(CASE WHEN fa.resolved THEN 1 END) AS resolved_count,
  fa.reason,
  COUNT(*) AS reason_count
FROM fraud_alerts fa
GROUP BY DATE_TRUNC('day', fa.created_at), fa.reason
ORDER BY date DESC;
