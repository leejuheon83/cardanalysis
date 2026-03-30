import { z } from "zod";

export const ruleTypeSchema = z.enum([
  "TIME_BASED",
  "AMOUNT_BASED",
  "MERCHANT_CATEGORY_BASED",
  "DOCUMENT_BASED",
  "PATTERN_BASED",
  "ORGANIZATION_BASED",
]);

export const severitySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const actionSchema = z.enum(["FLAG_ONLY", "REQUIRE_REVIEW", "AUTO_HOLD", "AUTO_ESCALATE"]);
export const statusSchema = z.enum(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"]);
export const approvalSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export const logicalOpSchema = z.enum(["AND", "OR"]);
export const operatorSchema = z.enum(["EQ", "NE", "GT", "GTE", "LT", "LTE", "IN", "NOT_IN", "EXISTS", "REGEX"]);
export const valueTypeSchema = z.enum(["STRING", "NUMBER", "BOOLEAN", "DATETIME", "ARRAY", "JSON"]);
export const scopeUnitSchema = z.enum(["COMPANY", "DEPARTMENT", "COST_CENTER", "CARD_GROUP", "USER_ROLE"]);
export const exceptionTargetSchema = z.enum(["USER", "CARD", "MERCHANT", "PROJECT", "TRANSACTION"]);

export const conditionSchema = z.object({
  conditionGroup: z.coerce.number().int().min(1).default(1),
  logicalOp: logicalOpSchema.default("AND"),
  field: z.string().min(1),
  operator: operatorSchema,
  valueType: valueTypeSchema,
  value: z.unknown(),
  orderNo: z.coerce.number().int().min(1).default(1),
});

export const scopeSchema = z.object({
  scopeUnitType: scopeUnitSchema,
  scopeUnitId: z.string().min(1),
  country: z.string().min(2).optional().nullable(),
  currency: z.string().min(3).optional().nullable(),
  effectiveFrom: z.string().datetime().optional().nullable(),
  effectiveTo: z.string().datetime().optional().nullable(),
});

export const exceptionSchema = z.object({
  targetType: exceptionTargetSchema,
  targetId: z.string().min(1),
  reason: z.string().min(1).max(500),
  validFrom: z.string().datetime().optional().nullable(),
  validTo: z.string().datetime().optional().nullable(),
});

export const createRuleSchema = z.object({
  ruleCode: z.string().min(2).max(50),
  name: z.string().min(2).max(100),
  description: z.string().max(2000).optional().nullable(),
  ruleType: ruleTypeSchema,
  severity: severitySchema,
  priority: z.coerce.number().int().min(1).max(1000).default(100),
  tags: z.array(z.string().min(1)).optional().default([]),
  changeSummary: z.string().max(500).optional().default("Initial draft"),
  changeReason: z.string().max(1000).optional().default("Initial creation"),
  actions: z.array(actionSchema).min(1).default(["FLAG_ONLY"]),
  conditions: z.array(conditionSchema).default([]),
  scopes: z.array(scopeSchema).default([]),
  exceptions: z.array(exceptionSchema).default([]),
});

export const updateRuleSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(2000).optional().nullable(),
  severity: severitySchema.optional(),
  status: statusSchema.optional(),
  priority: z.coerce.number().int().min(1).max(1000).optional(),
  tags: z.array(z.string().min(1)).optional(),
});

export const createVersionSchema = z.object({
  changeSummary: z.string().min(2).max(500),
  changeReason: z.string().min(2).max(1000),
  severity: severitySchema,
  actions: z.array(actionSchema).min(1),
  conditions: z.array(conditionSchema).min(1),
  scopes: z.array(scopeSchema).default([]),
  exceptions: z.array(exceptionSchema).default([]),
});

export const activateSchema = z.object({
  confirmationNote: z.string().min(2),
  requireConflictCheck: z.boolean().default(true),
});

export const deactivateSchema = z.object({
  reason: z.string().min(2).max(500),
});

export const rollbackSchema = z.object({
  targetVersionId: z.string().min(1),
  reason: z.string().min(2).max(500),
});

export const testSchema = z.object({
  inputType: z.enum(["SINGLE_TRANSACTION", "SAMPLESET_LAST_DAYS", "CSV_ROWS"]),
  transaction: z.record(z.unknown()).optional(),
  lastDays: z.coerce.number().int().min(1).max(365).optional(),
  csvRows: z.array(z.record(z.unknown())).optional(),
});

