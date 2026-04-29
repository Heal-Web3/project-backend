export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "doctor" | "pharmacist" | "regulator";
export type PrescriptionStatus = "active" | "filled" | "expired" | "revoked";
export type FraudSeverity = "low" | "medium" | "high";
export type FraudReason =
  | "doctor_daily_limit_exceeded"
  | "patient_pharmacy_limit_exceeded"
  | "doctor_license_revoked"
  | "prescription_expired"
  | "invalid_signature"
  | "doctor_not_registered";

export interface Database {
  public: {
    Tables: {
      doctors: {
        Row: {
          id: string;
          user_id: string | null;
          wallet_address: string;
          license_number: string;
          full_name: string;
          specialty: string;
          nft_token_id: string | null;
          is_active: boolean;
          revoked_at: string | null;
          revoked_by: string | null;
          registered_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          wallet_address: string;
          license_number: string;
          full_name: string;
          specialty: string;
          nft_token_id?: string | null;
          is_active?: boolean;
          revoked_at?: string | null;
          revoked_by?: string | null;
          registered_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["doctors"]["Insert"]>;
      };

      prescriptions: {
        Row: {
          id: string;
          prescription_hash: string;
          doctor_id: string;
          patient_identifier: string;
          medicine: string;
          dosage: string;
          issued_at: string;
          expiry_date: string;
          signature: string;
          nft_doctor_id: string;
          status: PrescriptionStatus;
          filled_at: string | null;
          filled_by_pharmacy: string | null;
          chain_verified: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          prescription_hash: string;
          doctor_id: string;
          patient_identifier: string;
          medicine: string;
          dosage: string;
          issued_at?: string;
          expiry_date: string;
          signature: string;
          nft_doctor_id: string;
          status?: PrescriptionStatus;
          filled_at?: string | null;
          filled_by_pharmacy?: string | null;
          chain_verified?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["prescriptions"]["Insert"]>;
      };

      fraud_alerts: {
        Row: {
          id: string;
          prescription_hash: string | null;
          doctor_id: string | null;
          patient_identifier: string | null;
          pharmacy_wallet: string;
          reason: FraudReason;
          severity: FraudSeverity;
          ai_explanation: string;
          action_required: string;
          smart_contract_response: Json | null;
          resolved: boolean;
          resolved_at: string | null;
          resolved_by: string | null;
          resolution_notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          prescription_hash?: string | null;
          doctor_id?: string | null;
          patient_identifier?: string | null;
          pharmacy_wallet: string;
          reason: FraudReason;
          severity: FraudSeverity;
          ai_explanation: string;
          action_required: string;
          smart_contract_response?: Json | null;
          resolved?: boolean;
          resolved_at?: string | null;
          resolved_by?: string | null;
          resolution_notes?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["fraud_alerts"]["Insert"]>;
      };

      user_profiles: {
        Row: {
          id: string;
          role: UserRole;
          wallet_address: string | null;
          display_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role: UserRole;
          wallet_address?: string | null;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_profiles"]["Insert"]>;
      };

      verification_logs: {
        Row: {
          id: string;
          prescription_hash: string;
          pharmacy_wallet: string;
          verified: boolean;
          fraud_alert_id: string | null;
          smart_contract_response: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          prescription_hash: string;
          pharmacy_wallet: string;
          verified: boolean;
          fraud_alert_id?: string | null;
          smart_contract_response?: Json | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["verification_logs"]["Insert"]
        >;
      };
    };
    Views: {
      prescription_analytics: {
        Row: {
          date: string;
          total_prescriptions: number;
          filled_count: number;
          expired_count: number;
          revoked_count: number;
          unique_doctors: number;
          unique_patients: number;
        };
      };
      fraud_analytics: {
        Row: {
          date: string;
          total_alerts: number;
          high_severity: number;
          medium_severity: number;
          low_severity: number;
          resolved_count: number;
          reason: FraudReason;
          reason_count: number;
        };
      };
    };
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      prescription_status: PrescriptionStatus;
      fraud_severity: FraudSeverity;
      fraud_reason: FraudReason;
    };
  };
}
