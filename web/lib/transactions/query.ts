import type { Prisma } from "@prisma/client";

export const currentAnalysisInclude = {
  where: { isCurrent: true },
  take: 1,
  include: {
    predictionLabels: true,
    modelVersion: true,
  },
} as const;

export type TransactionListQuery = {
  from?: string;
  to?: string;
  userLabel?: string;
  minAmount?: number;
  maxAmount?: number;
};

export function buildTransactionWhere(q: TransactionListQuery): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = {};

  if (q.from || q.to) {
    where.txnDate = {};
    if (q.from) where.txnDate.gte = new Date(q.from);
    if (q.to) where.txnDate.lte = new Date(q.to);
  }
  if (q.userLabel) {
    where.userLabel = { contains: q.userLabel };
  }
  if (q.minAmount != null || q.maxAmount != null) {
    where.amount = {};
    if (q.minAmount != null) where.amount.gte = q.minAmount;
    if (q.maxAmount != null) where.amount.lte = q.maxAmount;
  }

  return where;
}
