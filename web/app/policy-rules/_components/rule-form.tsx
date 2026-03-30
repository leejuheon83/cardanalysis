"use client";

import { useMemo, useState } from "react";
import {
  buildRulePayload,
  initRuleFormDraft,
  type RuleConditionDraft,
  type RuleExceptionDraft,
} from "@/lib/policy-rules/form-mapper";
import type {
  ConditionOperator,
  ConditionValueType,
  ExceptionTargetType,
  PolicyAction,
  PolicyRuleDetail,
  PolicyRuleType,
  PolicySeverity,
} from "@/types/policy-rules";
import {
  actionLabel,
  exceptionTargetLabel,
  logicalOpLabel,
  operatorLabel,
  ruleTypeLabel,
  severityLabel,
  valueTypeLabel,
} from "@/lib/policy-rules/labels";
import {
  formatConditionSentence,
  formatExceptionSentence,
  formatScopeSentence,
} from "@/lib/policy-rules/readable";

type Props = {
  mode: "create" | "edit";
  initial?: PolicyRuleDetail | null;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
};

const defaultConditions = [
  { value: "amount", label: "거래 금액" },
  { value: "merchantName", label: "가맹점명" },
  { value: "category", label: "카테고리" },
  { value: "dayOfWeek", label: "요일(0=일요일)" },
  { value: "hourOfDay", label: "거래 시각(0~23)" },
  { value: "hasReceipt", label: "증빙 존재 여부" },
];

function getConditionValuePlaceholder(valueType: ConditionValueType, field: string) {
  if (valueType === "NUMBER") return "예: 300000";
  if (valueType === "BOOLEAN") return "예: true 또는 false";
  if (valueType === "DATETIME") return "예: 2026-03-26T09:00:00Z";
  if (valueType === "ARRAY") return '예: ["토요일","일요일"]';
  if (valueType === "JSON") return '예: {"min":100000,"max":500000}';
  if (field === "merchantName") return "예: 스타벅스";
  if (field === "category") return "예: 식대";
  if (field === "dayOfWeek") return "예: 토요일";
  if (field === "hourOfDay") return "예: 22";
  if (field === "hasReceipt") return "예: true";
  return "값을 입력하세요";
}

function getConditionValueGuide(valueType: ConditionValueType) {
  if (valueType === "ARRAY" || valueType === "JSON") {
    return "JSON 형식으로 입력해야 합니다. 따옴표와 쉼표를 정확히 입력하세요.";
  }
  if (valueType === "DATETIME") {
    return "권장 형식: YYYY-MM-DDTHH:mm:ssZ";
  }
  if (valueType === "BOOLEAN") {
    return "true 또는 false만 입력합니다.";
  }
  return undefined;
}

function getDefaultValueTypeForField(field: string): ConditionValueType {
  if (field === "amount" || field === "hourOfDay" || field === "dayOfWeek") return "NUMBER";
  if (field === "hasReceipt") return "BOOLEAN";
  return "STRING";
}

function getExceptionTargetIdPlaceholder(targetType: ExceptionTargetType) {
  switch (targetType) {
    case "USER":
      return "예: user-123";
    case "CARD":
      return "예: card-001";
    case "MERCHANT":
      return "예: STARBUCKS-SEOUL";
    case "PROJECT":
      return "예: PRJ-2026-001";
    case "TRANSACTION":
      return "예: txn-abc123";
    default:
      return "대상 ID를 입력하세요";
  }
}

function getExceptionTargetIdHelper(targetType: ExceptionTargetType) {
  switch (targetType) {
    case "USER":
      return "특정 사용자만 예외 처리합니다.";
    case "CARD":
      return "특정 카드 번호(식별자) 기준 예외입니다.";
    case "MERCHANT":
      return "특정 가맹점 식별자 기준 예외입니다.";
    case "PROJECT":
      return "특정 프로젝트 건만 예외 처리합니다.";
    case "TRANSACTION":
      return "특정 거래 1건만 예외 처리합니다.";
    default:
      return undefined;
  }
}

export function RuleForm({ mode, initial, onSubmit }: Props) {
  const initialValue = useMemo(() => {
    const draft = initRuleFormDraft(initial ?? null);
    const version = initial?.currentVersion ?? null;
    return {
      ruleCode: initial?.ruleCode ?? "",
      name: initial?.name ?? "",
      description: initial?.description ?? "",
      ruleType: initial?.ruleType ?? "AMOUNT_BASED",
      severity: initial?.severity ?? "MEDIUM",
      priority: initial?.priority ?? 100,
      tags: Array.isArray(initial?.tags) ? (initial?.tags as string[]) : [],
      changeSummary: mode === "create" ? "초기 초안 생성" : "규칙 변경",
      changeReason: mode === "create" ? "초기 생성" : "정책 변경 반영",
      actions: version?.actions ?? (["FLAG_ONLY"] as PolicyAction[]),
      draft,
    };
  }, [initial, mode]);

  const [value, setValue] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const payload = buildRulePayload({
        ruleCode: value.ruleCode,
        name: value.name,
        description: value.description,
        ruleType: value.ruleType,
        severity: value.severity,
        priority: Number(value.priority),
        tags: value.tags,
        changeSummary: value.changeSummary,
        changeReason: value.changeReason,
        actions: value.actions,
        draft: value.draft,
      });
      await onSubmit(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "입력값 검증에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="rounded border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
        순서대로 입력하세요: <span className="font-semibold">기본 정보</span> →{" "}
        <span className="font-semibold">조건</span> → <span className="font-semibold">예외</span> →{" "}
        <span className="font-semibold">저장</span>
      </div>
      <h3 className="text-sm font-semibold text-slate-800">1. 기본 정보</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="규칙 코드"
          value={value.ruleCode}
          disabled={mode === "edit"}
          placeholder="예: RULE-MERCHANT-001"
          onChange={(v) => setValue((prev) => ({ ...prev, ruleCode: v }))}
        />
        <Field
          label="규칙명"
          value={value.name}
          placeholder="예: 가맹점 카테고리 제한"
          onChange={(v) => setValue((prev) => ({ ...prev, name: v }))}
        />
      </div>

      <Field
        label="설명"
        value={value.description}
        placeholder="예: 업무 무관 업종 사용을 위반으로 분류"
        onChange={(v) => setValue((prev) => ({ ...prev, description: v }))}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="규칙 유형"
          value={value.ruleType}
          onChange={(v) => setValue((prev) => ({ ...prev, ruleType: v as PolicyRuleType }))}
          options={[
            { value: "TIME_BASED", label: ruleTypeLabel.TIME_BASED },
            { value: "AMOUNT_BASED", label: ruleTypeLabel.AMOUNT_BASED },
            { value: "MERCHANT_CATEGORY_BASED", label: ruleTypeLabel.MERCHANT_CATEGORY_BASED },
            { value: "DOCUMENT_BASED", label: ruleTypeLabel.DOCUMENT_BASED },
            { value: "PATTERN_BASED", label: ruleTypeLabel.PATTERN_BASED },
            { value: "ORGANIZATION_BASED", label: ruleTypeLabel.ORGANIZATION_BASED },
          ]}
        />
        <SelectField
          label="심각도"
          value={value.severity}
          onChange={(v) => setValue((prev) => ({ ...prev, severity: v as PolicySeverity }))}
          options={[
            { value: "LOW", label: severityLabel.LOW },
            { value: "MEDIUM", label: severityLabel.MEDIUM },
            { value: "HIGH", label: severityLabel.HIGH },
            { value: "CRITICAL", label: severityLabel.CRITICAL },
          ]}
        />
      </div>
      <details className="rounded border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-slate-700">고급 설정(선택)</summary>
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              label="우선순위"
              value={String(value.priority)}
              placeholder="예: 100"
              onChange={(v) => setValue((prev) => ({ ...prev, priority: Number(v || 100) }))}
            />
            <div className="sm:col-span-2">
              <Field
                label="태그(쉼표 구분)"
                value={value.tags.join(",")}
                placeholder="예: 가맹점,유흥업종"
                onChange={(v) =>
                  setValue((prev) => ({
                    ...prev,
                    tags: v
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean),
                  }))
                }
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="변경 요약"
              value={value.changeSummary}
              placeholder="예: 초기 정책 등록"
              onChange={(v) => setValue((prev) => ({ ...prev, changeSummary: v }))}
            />
            <Field
              label="변경 사유"
              value={value.changeReason}
              placeholder="예: 내부 통제 기준 반영"
              onChange={(v) => setValue((prev) => ({ ...prev, changeReason: v }))}
            />
          </div>
        </div>
      </details>

      <h3 className="text-sm font-semibold text-slate-800">2. 조치 방식</h3>
      <p className="text-xs font-medium text-slate-600">액션(복수 선택 가능, 최소 1개)</p>
      <div className="flex flex-wrap gap-2 rounded border border-slate-200 bg-slate-50 p-3 text-xs">
        {(["FLAG_ONLY", "REQUIRE_REVIEW", "AUTO_HOLD", "AUTO_ESCALATE"] as PolicyAction[]).map((action) => (
          <label
            key={action}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded border px-2 py-1 ${
              value.actions.includes(action)
                ? "border-primary bg-primary/10 text-primary"
                : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            <input
              type="checkbox"
              checked={value.actions.includes(action)}
              onChange={(e) =>
                setValue((prev) => ({
                  ...prev,
                  actions: e.target.checked
                    ? (prev.actions.includes(action) ? prev.actions : [...prev.actions, action])
                    : prev.actions.filter((x) => x !== action),
                }))
              }
            />
            {actionLabel[action]}
          </label>
        ))}
      </div>

      <h3 className="text-sm font-semibold text-slate-800">3. 조건 설정</h3>
      <section className="space-y-2 rounded-lg border border-slate-200 p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">조건 빌더</h3>
          <button
            type="button"
            onClick={() =>
              setValue((prev) => ({
                ...prev,
                draft: {
                  ...prev.draft,
                  conditions: [
                    ...prev.draft.conditions,
                    {
                      conditionGroup: 1,
                      logicalOp: "AND",
                      field: "amount",
                      operator: "GT",
                      valueType: "NUMBER",
                      valueText: "0",
                      orderNo: prev.draft.conditions.length + 1,
                    },
                  ],
                },
              }))
            }
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
          >
            조건 추가
          </button>
        </div>
        <div className="space-y-2">
          {value.draft.conditions.map((condition, idx) => (
            <ConditionRow
              key={`condition-${idx}`}
              value={condition}
              onChange={(next) =>
                setValue((prev) => ({
                  ...prev,
                  draft: {
                    ...prev.draft,
                    conditions: prev.draft.conditions.map((row, i) => (i === idx ? next : row)),
                  },
                }))
              }
              onRemove={() =>
                setValue((prev) => ({
                  ...prev,
                  draft: {
                    ...prev.draft,
                    conditions: prev.draft.conditions.filter((_, i) => i !== idx),
                  },
                }))
              }
            />
          ))}
        </div>
      </section>

      <h3 className="text-sm font-semibold text-slate-800">4. 예외 대상</h3>
      <section className="space-y-2 rounded-lg border border-slate-200 p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">예외 대상</h3>
          <button
            type="button"
            onClick={() =>
              setValue((prev) => ({
                ...prev,
                draft: {
                  ...prev.draft,
                  exceptions: [
                    ...prev.draft.exceptions,
                    {
                      targetType: "CARD",
                      targetId: "",
                      reason: "",
                      validFrom: "",
                      validTo: "",
                    },
                  ],
                },
              }))
            }
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
          >
            예외 추가
          </button>
        </div>
        <p className="text-[11px] text-slate-500">예외 유형, 대상 ID, 사유만 입력하면 저장할 수 있습니다.</p>
        <div className="space-y-2">
          {value.draft.exceptions.map((exception, idx) => (
            <ExceptionRow
              key={`exception-${idx}`}
              value={exception}
              onChange={(next) =>
                setValue((prev) => ({
                  ...prev,
                  draft: {
                    ...prev.draft,
                    exceptions: prev.draft.exceptions.map((row, i) => (i === idx ? next : row)),
                  },
                }))
              }
              onRemove={() =>
                setValue((prev) => ({
                  ...prev,
                  draft: {
                    ...prev.draft,
                    exceptions: prev.draft.exceptions.filter((_, i) => i !== idx),
                  },
                }))
              }
            />
          ))}
        </div>
      </section>

      <h3 className="text-sm font-semibold text-slate-800">5. 저장</h3>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="rounded bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {submitting ? "저장 중..." : mode === "create" ? "규칙 생성" : "규칙/버전 저장"}
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
  placeholder,
  helperText,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  helperText?: string;
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <input
        disabled={disabled}
        className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-100"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {helperText ? <p className="mt-1 text-[11px] text-slate-500">{helperText}</p> : null}
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <select
        className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ConditionRow({
  value,
  onChange,
  onRemove,
}: {
  value: RuleConditionDraft;
  onChange: (v: RuleConditionDraft) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-2 rounded border border-slate-200 bg-slate-50 p-2">
      <div className="grid gap-2 sm:grid-cols-4">
      <SelectField
        label="필드"
        value={value.field}
        options={defaultConditions}
        onChange={(v) =>
          onChange({
            ...value,
            field: v,
            valueType: getDefaultValueTypeForField(v),
          })
        }
      />
      <SelectField
        label="비교 방식"
        value={value.operator}
        options={[
          { value: "EQ", label: operatorLabel.EQ },
          { value: "NE", label: operatorLabel.NE },
          { value: "GT", label: operatorLabel.GT },
          { value: "GTE", label: operatorLabel.GTE },
          { value: "LT", label: operatorLabel.LT },
          { value: "LTE", label: operatorLabel.LTE },
          { value: "IN", label: operatorLabel.IN },
          { value: "NOT_IN", label: operatorLabel.NOT_IN },
          { value: "EXISTS", label: operatorLabel.EXISTS },
          { value: "REGEX", label: operatorLabel.REGEX },
        ]}
        onChange={(v) => onChange({ ...value, operator: v as ConditionOperator })}
      />
      <Field
        label="값"
        value={value.valueText}
        onChange={(v) => onChange({ ...value, valueText: v })}
        placeholder={getConditionValuePlaceholder(value.valueType, value.field)}
        helperText={getConditionValueGuide(value.valueType)}
      />
      <button
        type="button"
        onClick={onRemove}
        className="self-end rounded border border-red-300 bg-white px-2 py-1 text-xs text-red-700"
      >
        삭제
      </button>
      </div>
      <details className="rounded border border-slate-200 bg-white px-2 py-2">
        <summary className="cursor-pointer text-[11px] font-medium text-slate-600">세부 설정 (고급)</summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <SelectField
            label="값 타입"
            value={value.valueType}
            options={[
              { value: "STRING", label: valueTypeLabel.STRING },
              { value: "NUMBER", label: valueTypeLabel.NUMBER },
              { value: "BOOLEAN", label: valueTypeLabel.BOOLEAN },
              { value: "DATETIME", label: valueTypeLabel.DATETIME },
              { value: "ARRAY", label: valueTypeLabel.ARRAY },
              { value: "JSON", label: valueTypeLabel.JSON },
            ]}
            onChange={(v) => onChange({ ...value, valueType: v as ConditionValueType })}
          />
          <SelectField
            label="논리연산"
            value={value.logicalOp}
            options={[
              { value: "AND", label: logicalOpLabel.AND },
              { value: "OR", label: logicalOpLabel.OR },
            ]}
            onChange={(v) => onChange({ ...value, logicalOp: v as "AND" | "OR" })}
          />
          <Field
            label="그룹"
            value={String(value.conditionGroup)}
            onChange={(v) => onChange({ ...value, conditionGroup: Number(v || "1") })}
          />
        </div>
      </details>
      <p className="sm:col-span-7 rounded bg-white px-2 py-1 text-xs text-slate-600">
        미리보기:{" "}
        {formatConditionSentence({
          field: value.field,
          operator: value.operator,
          valueType: value.valueType,
          value: value.valueText,
          logicalOp: value.logicalOp,
          conditionGroup: value.conditionGroup,
          orderNo: value.orderNo,
        })}
      </p>
    </div>
  );
}

function ExceptionRow({
  value,
  onChange,
  onRemove,
}: {
  value: RuleExceptionDraft;
  onChange: (v: RuleExceptionDraft) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-2 rounded border border-slate-200 bg-slate-50 p-2">
      <div className="grid gap-2 sm:grid-cols-4">
        <SelectField
          label="예외 유형"
          value={value.targetType}
          options={[
            { value: "USER", label: exceptionTargetLabel.USER },
            { value: "CARD", label: exceptionTargetLabel.CARD },
            { value: "MERCHANT", label: exceptionTargetLabel.MERCHANT },
            { value: "PROJECT", label: exceptionTargetLabel.PROJECT },
            { value: "TRANSACTION", label: exceptionTargetLabel.TRANSACTION },
          ]}
          onChange={(v) => onChange({ ...value, targetType: v as ExceptionTargetType })}
        />
        <Field
          label="대상 ID"
          value={value.targetId}
          placeholder={getExceptionTargetIdPlaceholder(value.targetType)}
          helperText={getExceptionTargetIdHelper(value.targetType)}
          onChange={(v) => onChange({ ...value, targetId: v })}
        />
        <Field label="사유" value={value.reason} onChange={(v) => onChange({ ...value, reason: v })} placeholder="예: 임원 출장 예외" />
        <button
          type="button"
          onClick={onRemove}
          className="self-end rounded border border-red-300 bg-white px-2 py-1 text-xs text-red-700"
        >
          삭제
        </button>
      </div>
      <details className="rounded border border-slate-200 bg-white px-2 py-2">
        <summary className="cursor-pointer text-[11px] font-medium text-slate-600">세부 설정 (유효 기간)</summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Field
            label="유효 시작"
            value={value.validFrom}
            onChange={(v) => onChange({ ...value, validFrom: v })}
            placeholder="예: 2026-03-01T00:00:00Z"
          />
          <Field
            label="유효 종료"
            value={value.validTo}
            onChange={(v) => onChange({ ...value, validTo: v })}
            placeholder="예: 2026-03-31T23:59:59Z"
          />
        </div>
      </details>
      <p className="rounded bg-white px-2 py-1 text-xs text-slate-600">
        미리보기:{" "}
        {formatExceptionSentence({
          targetType: value.targetType,
          targetId: value.targetId || "(미입력)",
          reason: value.reason || "(사유 미입력)",
          validFrom: value.validFrom || null,
          validTo: value.validTo || null,
        })}
      </p>
    </div>
  );
}

