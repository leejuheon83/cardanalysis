import type { ReviewStatus, Role } from "@prisma/client";

export type { ReviewStatus, Role };

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
};

export type SetupAwareResponse = {
  setupRequired: boolean;
  message: string | null;
};

export type TransactionListItem = {
  id: string;
  amount: string;
  currency: string;
  merchantName: string | null;
  category: string | null;
  userLabel: string | null;
  txnDate: string;
  riskScore: number | null;
  violationCategory: string | null;
  reviewStatus: ReviewStatus;
};

export type AIAnalysisDTO = {
  riskScore: number;
  violationCategory: string;
  explanation: string;
  modelVersion: string | null;
};
