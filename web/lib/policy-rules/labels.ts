import type {
  ConditionOperator,
  ConditionValueType,
  ExceptionTargetType,
  PolicyAction,
  PolicyApproval,
  PolicyRuleType,
  PolicySeverity,
  PolicyStatus,
  ScopeUnitType,
} from "@/types/policy-rules";

export const statusLabel: Record<PolicyStatus, string> = {
  DRAFT: "초안",
  ACTIVE: "활성",
  INACTIVE: "비활성",
  ARCHIVED: "보관",
};

export const severityLabel: Record<PolicySeverity, string> = {
  LOW: "낮음",
  MEDIUM: "보통",
  HIGH: "높음",
  CRITICAL: "치명",
};

export const ruleTypeLabel: Record<PolicyRuleType, string> = {
  TIME_BASED: "시간 기반",
  AMOUNT_BASED: "금액 기반",
  MERCHANT_CATEGORY_BASED: "가맹점/카테고리 기반",
  DOCUMENT_BASED: "증빙 기반",
  PATTERN_BASED: "패턴 기반",
  ORGANIZATION_BASED: "조직 기반",
};

export const approvalLabel: Record<PolicyApproval, string> = {
  PENDING: "승인 대기",
  APPROVED: "승인됨",
  REJECTED: "반려",
};

export const actionLabel: Record<PolicyAction, string> = {
  FLAG_ONLY: "표시만",
  REQUIRE_REVIEW: "검토 필요",
  AUTO_HOLD: "자동 보류",
  AUTO_ESCALATE: "자동 상향 보고",
};

export const operatorLabel: Record<ConditionOperator, string> = {
  EQ: "같음",
  NE: "다름",
  GT: "초과",
  GTE: "이상",
  LT: "미만",
  LTE: "이하",
  IN: "포함",
  NOT_IN: "미포함",
  EXISTS: "존재",
  REGEX: "패턴 일치(정규식)",
};

export const valueTypeLabel: Record<ConditionValueType, string> = {
  STRING: "문자열",
  NUMBER: "숫자",
  BOOLEAN: "참/거짓",
  DATETIME: "날짜/시간",
  ARRAY: "목록(JSON 형식)",
  JSON: "객체(JSON 형식)",
};

export const scopeUnitLabel: Record<ScopeUnitType, string> = {
  COMPANY: "회사",
  DEPARTMENT: "부서",
  COST_CENTER: "비용 센터",
  CARD_GROUP: "카드 그룹",
  USER_ROLE: "사용자 역할",
};

export const exceptionTargetLabel: Record<ExceptionTargetType, string> = {
  USER: "사용자",
  CARD: "카드",
  MERCHANT: "가맹점",
  PROJECT: "프로젝트",
  TRANSACTION: "거래",
};

export const logicalOpLabel: Record<"AND" | "OR", string> = {
  AND: "그리고(AND)",
  OR: "또는(OR)",
};

export const inputTypeLabel = {
  SINGLE_TRANSACTION: "단건 거래 직접 입력",
  SAMPLESET_LAST_DAYS: "최근 n일 샘플 데이터",
  CSV_ROWS: "복수 거래 입력(JSON 목록)",
} as const;

