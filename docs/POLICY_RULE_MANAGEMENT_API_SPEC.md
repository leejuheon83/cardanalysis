# Policy Rule Management API 명세 (OpenAPI 스타일 초안)

## 가정

- 인증은 기존 NextAuth 세션을 사용하며, API 게이트웨이/미들웨어에서 역할(`ADMIN`, `ACCOUNTING_MANAGER`, `AUDITOR`)을 검증한다.
- URL 버전은 `/api/v1`를 사용한다.
- 활성화는 기본적으로 `ADMIN`만 가능하며, 필요 시 2인 승인 정책을 추가할 수 있다.
- 본 문서는 구현 초안이며, 실제 응답 필드는 프런트 요구에 맞춰 확장 가능하다.

## 리소스 개요

- `PolicyRule`: 규칙 메타(이름, 유형, 상태, 현재 버전)
- `PolicyRuleVersion`: 규칙 설정 스냅샷(조건/스코프/예외/액션)
- `PolicyRuleTestRun`: 샌드박스 테스트 실행/결과

## 권한 매트릭스

- 조회: `ADMIN`, `ACCOUNTING_MANAGER`, `AUDITOR`
- 생성/수정/테스트: `ADMIN`, `ACCOUNTING_MANAGER`
- 승인/활성화/롤백: `ADMIN`

## OpenAPI YAML

```yaml
openapi: 3.0.3
info:
  title: Policy Rule Management API
  version: 0.1.0
  description: >
    기업카드 위반 정책을 코드 변경 없이 관리하기 위한 관리자 API.
servers:
  - url: /api/v1

tags:
  - name: PolicyRules
  - name: PolicyRuleVersions
  - name: PolicyRuleTesting

paths:
  /policy-rules:
    get:
      tags: [PolicyRules]
      summary: 규칙 목록 조회
      parameters:
        - in: query
          name: q
          schema: { type: string }
          description: 규칙명/코드 검색어
        - in: query
          name: status
          schema:
            type: string
            enum: [DRAFT, ACTIVE, INACTIVE, ARCHIVED]
        - in: query
          name: ruleType
          schema:
            $ref: '#/components/schemas/RuleType'
        - in: query
          name: severity
          schema:
            $ref: '#/components/schemas/Severity'
        - in: query
          name: page
          schema: { type: integer, minimum: 1, default: 1 }
        - in: query
          name: size
          schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  items:
                    type: array
                    items:
                      $ref: '#/components/schemas/PolicyRuleSummary'
                  page: { type: integer }
                  size: { type: integer }
                  total: { type: integer }
    post:
      tags: [PolicyRules]
      summary: 규칙 생성 (초안)
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreatePolicyRuleRequest'
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PolicyRuleDetail'
        '409':
          description: ruleCode 중복

  /policy-rules/{ruleId}:
    get:
      tags: [PolicyRules]
      summary: 규칙 상세 조회
      parameters:
        - $ref: '#/components/parameters/ruleId'
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PolicyRuleDetail'
    patch:
      tags: [PolicyRules]
      summary: 규칙 메타 수정 (활성 규칙은 새 버전 권장)
      parameters:
        - $ref: '#/components/parameters/ruleId'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpdatePolicyRuleRequest'
      responses:
        '200':
          description: Updated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PolicyRuleDetail'

  /policy-rules/{ruleId}/versions:
    get:
      tags: [PolicyRuleVersions]
      summary: 버전 목록 조회
      parameters:
        - $ref: '#/components/parameters/ruleId'
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  items:
                    type: array
                    items:
                      $ref: '#/components/schemas/PolicyRuleVersionSummary'
    post:
      tags: [PolicyRuleVersions]
      summary: 새 버전 생성
      parameters:
        - $ref: '#/components/parameters/ruleId'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreatePolicyRuleVersionRequest'
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PolicyRuleVersionDetail'

  /policy-rules/{ruleId}/versions/{versionId}:
    get:
      tags: [PolicyRuleVersions]
      summary: 버전 상세 조회
      parameters:
        - $ref: '#/components/parameters/ruleId'
        - $ref: '#/components/parameters/versionId'
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PolicyRuleVersionDetail'

  /policy-rules/{ruleId}/versions/{versionId}/test:
    post:
      tags: [PolicyRuleTesting]
      summary: 룰 테스트 샌드박스 실행
      parameters:
        - $ref: '#/components/parameters/ruleId'
        - $ref: '#/components/parameters/versionId'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RuleTestRequest'
      responses:
        '200':
          description: 테스트 결과
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/RuleTestResponse'

  /policy-rules/{ruleId}/versions/{versionId}/activate:
    post:
      tags: [PolicyRuleVersions]
      summary: 버전 활성화
      parameters:
        - $ref: '#/components/parameters/ruleId'
        - $ref: '#/components/parameters/versionId'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [confirmationNote]
              properties:
                confirmationNote:
                  type: string
                  description: 활성화 확인 문구(감사용)
                requireConflictCheck:
                  type: boolean
                  default: true
      responses:
        '200':
          description: Activated
          content:
            application/json:
              schema:
                type: object
                properties:
                  ruleId: { type: string }
                  activeVersionId: { type: string }
                  activatedAt: { type: string, format: date-time }
        '409':
          description: 충돌 규칙 존재

  /policy-rules/{ruleId}/deactivate:
    post:
      tags: [PolicyRules]
      summary: 규칙 비활성화
      parameters:
        - $ref: '#/components/parameters/ruleId'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [reason]
              properties:
                reason:
                  type: string
      responses:
        '200':
          description: Deactivated

  /policy-rules/{ruleId}/rollback:
    post:
      tags: [PolicyRuleVersions]
      summary: 이전 버전 롤백(재활성화)
      parameters:
        - $ref: '#/components/parameters/ruleId'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [targetVersionId, reason]
              properties:
                targetVersionId: { type: string }
                reason: { type: string }
      responses:
        '200':
          description: Rolled back

components:
  parameters:
    ruleId:
      in: path
      name: ruleId
      required: true
      schema: { type: string }
    versionId:
      in: path
      name: versionId
      required: true
      schema: { type: string }

  schemas:
    RuleType:
      type: string
      enum:
        - TIME_BASED
        - AMOUNT_BASED
        - MERCHANT_CATEGORY_BASED
        - DOCUMENT_BASED
        - PATTERN_BASED
        - ORGANIZATION_BASED

    Severity:
      type: string
      enum: [LOW, MEDIUM, HIGH, CRITICAL]

    RuleAction:
      type: string
      enum: [FLAG_ONLY, REQUIRE_REVIEW, AUTO_HOLD, AUTO_ESCALATE]

    PolicyRuleSummary:
      type: object
      properties:
        id: { type: string }
        ruleCode: { type: string }
        name: { type: string }
        ruleType:
          $ref: '#/components/schemas/RuleType'
        severity:
          $ref: '#/components/schemas/Severity'
        status:
          type: string
          enum: [DRAFT, ACTIVE, INACTIVE, ARCHIVED]
        activeVersionNo: { type: integer, nullable: true }
        updatedAt: { type: string, format: date-time }
        updatedBy: { type: string, nullable: true }

    PolicyRuleDetail:
      allOf:
        - $ref: '#/components/schemas/PolicyRuleSummary'
        - type: object
          properties:
            description: { type: string, nullable: true }
            tags:
              type: array
              items: { type: string }
            currentVersion:
              $ref: '#/components/schemas/PolicyRuleVersionDetail'

    PolicyRuleVersionSummary:
      type: object
      properties:
        id: { type: string }
        versionNo: { type: integer }
        approvalStatus:
          type: string
          enum: [PENDING, APPROVED, REJECTED]
        isActive: { type: boolean }
        changeSummary: { type: string, nullable: true }
        createdAt: { type: string, format: date-time }
        createdBy: { type: string }

    PolicyRuleCondition:
      type: object
      required: [field, operator, valueType, value]
      properties:
        conditionGroup: { type: integer, default: 1 }
        logicalOp:
          type: string
          enum: [AND, OR]
          default: AND
        field: { type: string }
        operator:
          type: string
          enum: [EQ, NE, GT, GTE, LT, LTE, IN, NOT_IN, EXISTS, REGEX]
        valueType:
          type: string
          enum: [STRING, NUMBER, BOOLEAN, DATETIME, ARRAY, JSON]
        value: {}
        orderNo: { type: integer, default: 1 }

    PolicyRuleScope:
      type: object
      properties:
        companyId: { type: string, nullable: true }
        departmentIds:
          type: array
          items: { type: string }
        cardGroupIds:
          type: array
          items: { type: string }
        userRoleCodes:
          type: array
          items: { type: string }
        currencies:
          type: array
          items: { type: string }
        effectiveFrom: { type: string, format: date-time, nullable: true }
        effectiveTo: { type: string, format: date-time, nullable: true }

    PolicyRuleException:
      type: object
      required: [exceptionType, targetId, reason]
      properties:
        exceptionType:
          type: string
          enum: [USER, CARD, MERCHANT, PROJECT, TRANSACTION]
        targetId: { type: string }
        reason: { type: string }
        validFrom: { type: string, format: date-time, nullable: true }
        validTo: { type: string, format: date-time, nullable: true }

    PolicyRuleVersionDetail:
      allOf:
        - $ref: '#/components/schemas/PolicyRuleVersionSummary'
        - type: object
          properties:
            severity:
              $ref: '#/components/schemas/Severity'
            actions:
              type: array
              items:
                $ref: '#/components/schemas/RuleAction'
            conditions:
              type: array
              items:
                $ref: '#/components/schemas/PolicyRuleCondition'
            scopes:
              type: array
              items:
                $ref: '#/components/schemas/PolicyRuleScope'
            exceptions:
              type: array
              items:
                $ref: '#/components/schemas/PolicyRuleException'
            changeReason: { type: string, nullable: true }

    CreatePolicyRuleRequest:
      type: object
      required: [ruleCode, name, ruleType, severity]
      properties:
        ruleCode: { type: string }
        name: { type: string }
        description: { type: string, nullable: true }
        ruleType:
          $ref: '#/components/schemas/RuleType'
        severity:
          $ref: '#/components/schemas/Severity'
        tags:
          type: array
          items: { type: string }

    UpdatePolicyRuleRequest:
      type: object
      properties:
        name: { type: string }
        description: { type: string, nullable: true }
        severity:
          $ref: '#/components/schemas/Severity'
        status:
          type: string
          enum: [DRAFT, ACTIVE, INACTIVE, ARCHIVED]
        tags:
          type: array
          items: { type: string }

    CreatePolicyRuleVersionRequest:
      type: object
      required: [changeSummary, changeReason, severity, actions, conditions]
      properties:
        changeSummary: { type: string }
        changeReason: { type: string }
        severity:
          $ref: '#/components/schemas/Severity'
        actions:
          type: array
          items:
            $ref: '#/components/schemas/RuleAction'
        conditions:
          type: array
          items:
            $ref: '#/components/schemas/PolicyRuleCondition'
        scopes:
          type: array
          items:
            $ref: '#/components/schemas/PolicyRuleScope'
        exceptions:
          type: array
          items:
            $ref: '#/components/schemas/PolicyRuleException'

    RuleTestRequest:
      type: object
      required: [inputType]
      properties:
        inputType:
          type: string
          enum: [SINGLE_TRANSACTION, SAMPLESET_LAST_DAYS, CSV_ROWS]
        transaction:
          type: object
          description: inputType=SINGLE_TRANSACTION일 때 사용
        lastDays:
          type: integer
          minimum: 1
          maximum: 365
          description: inputType=SAMPLESET_LAST_DAYS일 때 사용
        csvRows:
          type: array
          items: { type: object }
          description: inputType=CSV_ROWS일 때 사용

    RuleTestResponse:
      type: object
      properties:
        matchedCount: { type: integer }
        unmatchedCount: { type: integer }
        conflictWarnings:
          type: array
          items: { type: string }
        samples:
          type: array
          items:
            type: object
            properties:
              transactionId: { type: string, nullable: true }
              matched: { type: boolean }
              triggeredConditions:
                type: array
                items: { type: string }
              appliedActions:
                type: array
                items: { type: string }
              explanation:
                type: string
```

## 구현 체크리스트

- `POST /policy-rules/{ruleId}/versions/{versionId}/activate`에서 충돌 검사 결과를 409로 반환
- 테스트 샌드박스 결과에 "룰 근거 문자열"을 저장해 AI 설명 계층과 연결
- 모든 변경 API에서 `AuditLog` 이벤트를 남기고 `actorId`/`entityId`/`payload`를 보존
