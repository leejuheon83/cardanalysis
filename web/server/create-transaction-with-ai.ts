import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { analyzeTransaction } from "@/lib/ai/analyze-transaction";
import { writeAuditLog } from "@/lib/audit";
import { buildMinimalFeaturePayload } from "@/lib/ai-layer/build-minimal-features";
import { ensureModelVersion } from "@/lib/ai-layer/ensure-model-version";

const FEATURE_SCHEMA = "v1-minimal";
const MODEL_NAME = "corporate-card-risk";

export async function createTransactionWithAi(params: {
  actorId: string;
  amount: number;
  currency?: string;
  merchantName?: string | null;
  category?: string | null;
  userLabel?: string | null;
  txnDate: Date;
  description?: string | null;
  rawMetadata?: object;
}) {
  const ai = await analyzeTransaction({
    amount: params.amount,
    merchantName: params.merchantName,
    category: params.category,
    txnDate: params.txnDate,
    userLabel: params.userLabel,
  });

  const tx = await prisma.$transaction(async (db) => {
    const transaction = await db.transaction.create({
      data: {
        amount: new Prisma.Decimal(params.amount),
        currency: params.currency ?? "KRW",
        merchantName: params.merchantName ?? null,
        category: params.category ?? null,
        userLabel: params.userLabel ?? null,
        txnDate: params.txnDate,
        description: params.description ?? null,
        rawMetadata: params.rawMetadata ? (params.rawMetadata as object) : undefined,
      },
    });

    const snapshot = await db.featureSnapshot.create({
      data: {
        transactionId: transaction.id,
        featureSchemaVersion: FEATURE_SCHEMA,
        featuresJson: buildMinimalFeaturePayload({
          amount: params.amount,
          merchantName: params.merchantName,
          category: params.category,
          userLabel: params.userLabel,
          txnDate: params.txnDate,
        }) as object,
      },
    });

    const modelVer = await ensureModelVersion(db, MODEL_NAME, ai.modelVersion);

    const analysis = await db.aiAnalysisResult.create({
      data: {
        transactionId: transaction.id,
        resultSeq: 1,
        modelVersionId: modelVer.id,
        featureSnapshotId: snapshot.id,
        riskScore: ai.riskScore,
        explanationText: ai.explanation,
        explanationStructured: {
          source: "analyzeTransaction",
          violationCategory: ai.violationCategory,
        } as object,
        rawModelOutputs: { mockOrLlm: true } as object,
        isCurrent: true,
      },
    });

    await db.predictionLabel.create({
      data: {
        aiAnalysisResultId: analysis.id,
        labelType: "violation_category",
        labelValue: ai.violationCategory,
      },
    });

    await db.review.create({
      data: {
        transactionId: transaction.id,
        status: "PENDING",
        aiAnalysisResultId: analysis.id,
      },
    });

    return { transaction, analysisId: analysis.id };
  });

  await writeAuditLog({
    actorId: params.actorId,
    action: "transaction.create",
    entityType: "Transaction",
    entityId: tx.transaction.id,
    payload: {
      riskScore: ai.riskScore,
      violationCategory: ai.violationCategory,
      aiAnalysisResultId: tx.analysisId,
    },
  });

  return tx.transaction.id;
}
