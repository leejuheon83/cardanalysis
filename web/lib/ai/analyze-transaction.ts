/**
 * 거래 1건에 대한 AI(또는 목) 분석.
 * OPENAI_API_KEY 가 있으면 OpenAI 호출, 없으면 규칙 기반 목 점수.
 */
export type AnalyzeInput = {
  amount: number;
  merchantName?: string | null;
  category?: string | null;
  txnDate: Date;
  userLabel?: string | null;
};

export type AnalyzeResult = {
  riskScore: number;
  violationCategory: string;
  explanation: string;
  modelVersion: string;
};

const SENSITIVE = [
  "유흥",
  "룸",
  "호텔",
  "모텔",
  "주점",
  "BAR",
  "CASINO",
  "안마",
];

function mockAnalyze(input: AnalyzeInput): AnalyzeResult {
  let risk = 12;
  const reasons: string[] = [];

  if (input.amount >= 1_000_000) {
    risk += 40;
    reasons.push("금액이 100만원 이상입니다.");
  } else if (input.amount >= 500_000) {
    risk += 28;
    reasons.push("금액이 50만원 이상입니다.");
  } else if (input.amount >= 200_000) {
    risk += 14;
    reasons.push("금액이 20만원 이상입니다.");
  }

  const m = String(input.merchantName ?? "");
  const mu = m.toUpperCase();
  for (const w of SENSITIVE) {
    if (m.includes(w) || mu.includes(w.toUpperCase())) {
      risk += 30;
      reasons.push(`가맹점명에 주의 키워드("${w}")가 포함되었습니다.`);
      break;
    }
  }

  risk = Math.min(99, Math.max(0, Math.round(risk)));

  let violationCategory = "NONE";
  if (risk >= 72) violationCategory = "HIGH_RISK_OR_POLICY";
  else if (risk >= 48) violationCategory = "REVIEW_RECOMMENDED";
  else if (risk >= 30) violationCategory = "LOW_CONFIDENCE_ANOMALY";

  const explanation =
    reasons.length > 0
      ? reasons.join(" ") + " 종합하여 리스크 점수를 산출했습니다."
      : "규칙상 특이사항이 적어 낮은 리스크로 분류했습니다.";

  return {
    riskScore: risk,
    violationCategory,
    explanation,
    modelVersion: "mock-v1",
  };
}

async function openAiAnalyze(input: AnalyzeInput): Promise<AnalyzeResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return mockAnalyze(input);

  const body = {
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [
      {
        role: "system" as const,
        content:
          "You are a corporate card compliance assistant. Reply ONLY with compact JSON: {\"riskScore\":0-100,\"violationCategory\":\"NONE|HIGH_RISK_OR_POLICY|REVIEW_RECOMMENDED|PERSONAL_LIKE|OTHER\",\"explanation\":\"short Korean\"}",
      },
      {
        role: "user" as const,
        content: JSON.stringify({
          amount: input.amount,
          merchantName: input.merchantName,
          category: input.category,
          txnDate: input.txnDate.toISOString(),
          userLabel: input.userLabel,
        }),
      },
    ],
    temperature: 0.2,
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error("OpenAI error", await res.text());
    return { ...mockAnalyze(input), modelVersion: "mock-fallback-openai-error" };
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  try {
    const parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, "")) as {
      riskScore?: number;
      violationCategory?: string;
      explanation?: string;
    };
    return {
      riskScore: Math.min(99, Math.max(0, Number(parsed.riskScore ?? 0))),
      violationCategory: String(parsed.violationCategory ?? "OTHER"),
      explanation: String(parsed.explanation ?? ""),
      modelVersion: body.model,
    };
  } catch {
    return { ...mockAnalyze(input), modelVersion: "mock-fallback-parse" };
  }
}

export async function analyzeTransaction(input: AnalyzeInput): Promise<AnalyzeResult> {
  if (process.env.OPENAI_API_KEY) {
    return openAiAnalyze(input);
  }
  return mockAnalyze(input);
}
