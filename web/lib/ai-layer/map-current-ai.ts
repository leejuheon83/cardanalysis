import type { AiAnalysisResult, ModelVersion, PredictionLabel } from "@prisma/client";

export type CurrentAiView = {
  riskScore: number;
  violationCategory: string;
  explanation: string;
  modelVersion: string | null;
  analysisResultId: string;
};

export function mapCurrentAiAnalysis(
  results: (AiAnalysisResult & {
    predictionLabels: PredictionLabel[];
    modelVersion: ModelVersion;
  })[],
): CurrentAiView | null {
  const cur = results.find((r) => r.isCurrent) ?? results[0];
  if (!cur) return null;
  const cat = cur.predictionLabels.find((l) => l.labelType === "violation_category");
  return {
    riskScore: cur.riskScore,
    violationCategory: cat?.labelValue ?? "NONE",
    explanation: cur.explanationText,
    modelVersion: cur.modelVersion.version,
    analysisResultId: cur.id,
  };
}
