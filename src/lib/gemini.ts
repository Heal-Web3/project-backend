import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { FraudReason } from "@/lib/database.types";

function getModel(): GenerativeModel {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set in environment variables");
  }
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 150,
    },
  });
}

export interface FraudContext {
  reason: FraudReason;
  doctorName?: string;
  patientId?: string;
  medicine?: string;
  prescriptionCount?: number;
  pharmacyCount?: number;
  maxAllowed?: number;
  expiryDate?: string;
}

export interface FraudExplanation {
  explanation: string;
  severity: "low" | "medium" | "high";
  actionRequired: string;
}

const FRAUD_PROMPTS: Record<FraudReason, (ctx: FraudContext) => string> = {
  doctor_daily_limit_exceeded: (ctx) =>
    `A pharmacist is trying to fill a prescription but the smart contract flagged it. 
    The doctor${ctx.doctorName ? ` "${ctx.doctorName}"` : ""} has issued ${ctx.prescriptionCount ?? "too many"} prescriptions today, 
    exceeding the allowed limit of ${ctx.maxAllowed ?? 30} per day.
    Write 1-2 plain-English sentences explaining this fraud flag to a non-technical pharmacist. 
    Be factual and clear. Do not use blockchain or technical jargon.`,

  patient_pharmacy_limit_exceeded: (ctx) =>
    `A pharmacist is trying to fill a prescription but the smart contract flagged it.
    Patient ID "${ctx.patientId ?? "unknown"}" has already visited ${ctx.pharmacyCount ?? "too many"} pharmacies today, 
    exceeding the allowed limit of ${ctx.maxAllowed ?? 3} pharmacies per day.
    Write 1-2 plain-English sentences explaining this fraud flag to a non-technical pharmacist.
    Be factual and clear. Do not use blockchain or technical jargon.`,

  doctor_license_revoked: (ctx) =>
    `A pharmacist is trying to fill a prescription but the smart contract flagged it.
    The doctor${ctx.doctorName ? ` "${ctx.doctorName}"` : ""} who issued this prescription has had their medical license revoked.
    Write 1-2 plain-English sentences explaining this fraud flag to a non-technical pharmacist.
    Be factual and clear. Do not use blockchain or technical jargon.`,

  prescription_expired: (ctx) =>
    `A pharmacist is trying to fill a prescription but the smart contract flagged it.
    The prescription${ctx.medicine ? ` for "${ctx.medicine}"` : ""} expired on ${ctx.expiryDate ?? "an unknown date"} and is no longer valid.
    Write 1-2 plain-English sentences explaining this fraud flag to a non-technical pharmacist.
    Be factual and clear. Do not use blockchain or technical jargon.`,

  invalid_signature: (ctx) =>
    `A pharmacist is trying to fill a prescription but the smart contract flagged it.
    The digital signature on this prescription${ctx.medicine ? ` for "${ctx.medicine}"` : ""} does not match the issuing doctor's verified credentials.
    This could indicate the prescription was tampered with or forged.
    Write 1-2 plain-English sentences explaining this fraud flag to a non-technical pharmacist.
    Be factual and clear. Do not use blockchain or technical jargon.`,

  doctor_not_registered: (ctx) =>
    `A pharmacist is trying to fill a prescription but the smart contract flagged it.
    The doctor${ctx.doctorName ? ` "${ctx.doctorName}"` : ""} who issued this prescription is not registered in the verified healthcare system.
    Write 1-2 plain-English sentences explaining this fraud flag to a non-technical pharmacist.
    Be factual and clear. Do not use blockchain or technical jargon.`,
};

const SEVERITY_MAP: Record<FraudReason, FraudExplanation["severity"]> = {
  doctor_daily_limit_exceeded: "high",
  patient_pharmacy_limit_exceeded: "medium",
  doctor_license_revoked: "high",
  prescription_expired: "low",
  invalid_signature: "high",
  doctor_not_registered: "high",
};

const ACTION_MAP: Record<FraudReason, string> = {
  doctor_daily_limit_exceeded:
    "Do not fill this prescription. Contact your supervisor and report the issuing doctor.",
  patient_pharmacy_limit_exceeded:
    "Do not fill this prescription. The patient may be attempting to obtain excessive medication.",
  doctor_license_revoked:
    "Do not fill this prescription. The doctor is no longer authorized to practice.",
  prescription_expired:
    "Do not fill this prescription. Ask the patient to obtain a new prescription from their doctor.",
  invalid_signature:
    "Do not fill this prescription. Retain it and contact your supervisor — this may be a forgery.",
  doctor_not_registered:
    "Do not fill this prescription. This doctor has not been verified by the health authority.",
};

export async function generateFraudExplanation(
  context: FraudContext,
): Promise<FraudExplanation> {
  const prompt = FRAUD_PROMPTS[context.reason](context);

  try {
    const result = await getModel().generateContent(prompt);
    const response = result.response;
    const text = response.text().trim();

    const cleaned = text
      .replace(/^["']|["']$/g, "")
      .replace(/\*\*/g, "")
      .replace(/^-\s+/gm, "")
      .trim();

    return {
      explanation: cleaned,
      severity: SEVERITY_MAP[context.reason],
      actionRequired: ACTION_MAP[context.reason],
    };
  } catch (error: unknown) {
    console.error("[Gemini] Error generating fraud explanation:", error);

    const fallbacks: Record<FraudReason, string> = {
      doctor_daily_limit_exceeded: `This prescription was flagged because the issuing doctor has reached the maximum number of prescriptions allowed per day (${context.maxAllowed ?? 30}). This limit exists to prevent prescription fraud.`,
      patient_pharmacy_limit_exceeded: `This prescription was flagged because this patient has already visited ${context.pharmacyCount ?? "multiple"} pharmacies today, which exceeds the allowed limit. This pattern may indicate attempts to obtain excess medication.`,
      doctor_license_revoked: `This prescription was flagged because the doctor who issued it no longer holds a valid medical license. Prescriptions from unlicensed doctors are not permitted.`,
      prescription_expired: `This prescription has passed its expiry date of ${context.expiryDate ?? "the allowed period"} and is no longer valid. The patient will need to get a new prescription.`,
      invalid_signature: `This prescription was flagged because its digital verification failed. The prescription may have been altered or could be counterfeit.`,
      doctor_not_registered: `This prescription was flagged because the issuing doctor is not found in the verified medical registry. Only registered and approved doctors can issue valid prescriptions.`,
    };

    return {
      explanation: fallbacks[context.reason],
      severity: SEVERITY_MAP[context.reason],
      actionRequired: ACTION_MAP[context.reason],
    };
  }
}

export async function generateFraudSummary(
  alertCount: number,
  topReasons: Array<{ reason: FraudReason; count: number }>,
): Promise<string> {
  const reasonList = topReasons
    .map((r) => `${r.reason.replace(/_/g, " ")} (${r.count} times)`)
    .join(", ");

  const prompt = `A healthcare fraud monitoring system detected ${alertCount} suspicious prescription attempts today. 
  The most common reasons were: ${reasonList}.
  Write 2-3 sentences summarizing these patterns for a healthcare regulator. 
  Be concise and professional. Do not use blockchain or technical jargon.`;

  try {
    const result = await getModel().generateContent(prompt);
    return result.response.text().trim();
  } catch {
    return `Today's monitoring detected ${alertCount} flagged prescription attempts. The most frequent issues were ${reasonList}. Please review the detailed fraud alerts for further action.`;
  }
}
