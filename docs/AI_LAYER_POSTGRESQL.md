# AI 레이어 PostgreSQL DDL 초안

**Prisma 원본:** Next MVP의 스키마는 `web/prisma/schema.prisma`가 **정본**입니다. 마이그레이션·`db push`는 해당 파일 기준으로 수행하세요.

**목적:** 이전 AI 아키텍처 문서 §10을 **SQL 관점**으로 풀어 둔 참고용입니다. Prisma 모델명은 PascalCase·필드는 camelCase입니다.

**가정**

- 코어 업무 테이블: `users`, `transactions`, `reviews`가 이미 존재한다. (컬럼명은 프로젝트에 맞게 매핑)
- PK는 `uuid`, 시각은 `timestamptz`, 유연한 메타는 `jsonb`.
- 멀티테넌트 시 모든 테이블에 `tenant_id uuid NOT NULL` 추가 및 FK·인덱스 선두 컬럼으로 둔다 **(가정)**.

---

## 1. 기존 코어와의 관계 (요약)

```
users
  ↑
reviews.reviewer_id ──→ transactions ──→ ai_analysis_results.transaction_id
                                              ↑
                         feature_snapshots ──┘ (transaction_id)
                         model_versions, prompt_versions
                         ai_analysis_runs
prediction_labels → ai_analysis_results
reviewer_feedback → transactions + reviews + ai_analysis_results + users
```

---

## 2. ENUM (선택)

애플리케이션에서 문자열로만 써도 되나, DB에서 제약을 걸고 싶다면:

```sql
CREATE TYPE ai_run_status AS ENUM ('pending', 'running', 'completed', 'failed');
CREATE TYPE feedback_outcome AS ENUM ('APPROVED', 'VIOLATION', 'DISMISSED', 'PENDING');
```

아래 DDL은 **TEXT + CHECK**로 단순화한다 **(가정)**.

---

## 3. DDL 전문

### 3.1 `model_versions`

학습/배포된 ML 모델(또는 통계 스코어러 버전) 메타.

```sql
CREATE TABLE model_versions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name        text NOT NULL,
  version           text NOT NULL,
  artifact_uri      text,
  training_data_from timestamptz,
  training_data_to   timestamptz,
  metrics_json      jsonb,
  is_deployed       boolean NOT NULL DEFAULT false,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (model_name, version)
);

CREATE INDEX idx_model_versions_deployed
  ON model_versions (model_name) WHERE is_deployed = true;

COMMENT ON TABLE model_versions IS 'ML/통계 스코어러 버전. 감사·재현용.';
```

### 3.2 `prompt_versions`

LLM 설명용 프롬프트(또는 템플릿) 버전. **본문은 해시 + 객체 스토리지** 권장 **(가정)**.

```sql
CREATE TABLE prompt_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  content_sha256  text NOT NULL,
  template_uri    text,
  llm_model       text NOT NULL DEFAULT 'gpt-4o-mini',
  parameters_json jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, content_sha256)
);

COMMENT ON TABLE prompt_versions IS '설명 생성 프롬프트 버전. content_sha256으로 동일 프롬프트 중복 방지.';
```

### 3.3 `ai_analysis_runs`

배치/온디맨드 추론 **작업 단위**.

```sql
CREATE TABLE ai_analysis_runs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type            text NOT NULL
                        CHECK (run_type IN ('batch', 'on_demand', 'reprocess')),
  status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  scope_description   text,
  transaction_from    timestamptz,
  transaction_to      timestamptz,
  started_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  triggered_by_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  error_message       text,
  stats_json          jsonb
);

CREATE INDEX idx_ai_analysis_runs_started ON ai_analysis_runs (started_at DESC);

COMMENT ON TABLE ai_analysis_runs IS '추론 배치/재처리 실행 단위.';
```

### 3.4 `feature_snapshots`

거래(또는 집계 키)별 **당시 계산된 피처 고정본**. 재학습·분쟁 시 재현에 사용.

```sql
CREATE TABLE feature_snapshots (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id         uuid NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
  feature_schema_version text NOT NULL,
  features_json          jsonb NOT NULL,
  input_hash             text,
  computed_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_feature_snapshots_tx
  ON feature_snapshots (transaction_id, feature_schema_version, computed_at DESC);

COMMENT ON TABLE feature_snapshots IS '거래 단위 피처 스냅샷. 스키마 버전별로 복수 행 가능.';
COMMENT ON COLUMN feature_snapshots.input_hash IS '원천 필드 기반 해시(선택). 동일 입력 재계산 판별.';
```

**참고:** 직원/부서 집계만 별도로 저장하려면 `entity_type` + `entity_key` 컬럼을 추가하는 변형이 가능하다 **(가정)**.

### 3.5 `ai_analysis_results`

거래당 **추론 이력**(재추론 시 `result_seq` 증가). 기존 단일 `AiAnalysis` 행을 이 테이블로 **대체하거나**, 마이그레이션 후 뷰로 호환 **(가정)**.

```sql
CREATE TABLE ai_analysis_results (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id       uuid NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
  analysis_run_id      uuid REFERENCES ai_analysis_runs (id) ON DELETE SET NULL,
  result_seq           int NOT NULL,
  model_version_id     uuid REFERENCES model_versions (id) ON DELETE RESTRICT,
  prompt_version_id    uuid REFERENCES prompt_versions (id) ON DELETE SET NULL,
  feature_snapshot_id  uuid NOT NULL REFERENCES feature_snapshots (id) ON DELETE RESTRICT,

  rule_hits_json       jsonb,
  anomaly_score        numeric(8, 6),
  risk_score           int NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),

  explanation_structured jsonb,
  explanation_text     text,
  explanation_locale   text NOT NULL DEFAULT 'ko',

  raw_model_outputs    jsonb,
  is_current           boolean NOT NULL DEFAULT true,

  created_at           timestamptz NOT NULL DEFAULT now(),

  UNIQUE (transaction_id, result_seq)
);

CREATE INDEX idx_ai_results_tx_current
  ON ai_analysis_results (transaction_id) WHERE is_current = true;

CREATE INDEX idx_ai_results_run ON ai_analysis_results (analysis_run_id);

COMMENT ON TABLE ai_analysis_results IS '거래별 AI/규칙/통계 결합 추론 결과. 재추론 시 result_seq 증가.';
COMMENT ON COLUMN ai_analysis_results.rule_hits_json IS '규칙 엔진 출력 스냅샷(결정론적 근거).';
COMMENT ON COLUMN ai_analysis_results.is_current IS 'UI 기본 표시용 최신 행. 재계산 시 트랜잭션 내 갱신 권장.';
```

**트리거 예시 (선택):** 새 행 삽입 시 동일 `transaction_id`의 기존 `is_current`를 `false`로.

```sql
CREATE OR REPLACE FUNCTION trg_ai_result_set_current()
RETURNS trigger AS $$
BEGIN
  IF NEW.is_current THEN
    UPDATE ai_analysis_results
    SET is_current = false
    WHERE transaction_id = NEW.transaction_id AND id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_analysis_results_current
  AFTER INSERT ON ai_analysis_results
  FOR EACH ROW EXECUTE FUNCTION trg_ai_result_set_current();
```

*(PostgreSQL 14+ 에서는 `EXECUTE FUNCTION` / 구버전은 `EXECUTE PROCEDURE`.)*

### 3.6 `prediction_labels`

한 추론 결과에 **복수 라벨**(위반 카테고리, 심각도 버킷, 보조 태그).

```sql
CREATE TABLE prediction_labels (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_analysis_result_id uuid NOT NULL REFERENCES ai_analysis_results (id) ON DELETE CASCADE,
  label_type            text NOT NULL
                          CHECK (label_type IN (
                            'violation_category',
                            'severity_bucket',
                            'routing_queue',
                            'custom'
                          )),
  label_value           text NOT NULL,
  probability           numeric(8, 6),
  calibrated_bucket     text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_prediction_labels_result
  ON prediction_labels (ai_analysis_result_id);

COMMENT ON TABLE prediction_labels IS '분류기/정책 매핑 산출 라벨. 감사 시 JSON보다 쿼리 용이.';
```

### 3.7 `reviewer_feedback`

**사람 최종 판단**과 **당시 AI 결과**의 연결. 학습·오탐 분석의 핵심.

```sql
CREATE TABLE reviewer_feedback (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id         uuid NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
  review_id              uuid REFERENCES reviews (id) ON DELETE SET NULL,
  ai_analysis_result_id  uuid REFERENCES ai_analysis_results (id) ON DELETE SET NULL,
  reviewer_user_id       uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,

  final_outcome          text NOT NULL
                           CHECK (final_outcome IN ('APPROVED', 'VIOLATION', 'DISMISSED', 'PENDING')),
  final_violation_category text,
  override_reason        text,

  ai_suggested_category  text,
  ai_risk_score_at_review int,
  agreement_with_ai      boolean,

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reviewer_feedback_tx ON reviewer_feedback (transaction_id, created_at DESC);
CREATE INDEX idx_reviewer_feedback_reviewer ON reviewer_feedback (reviewer_user_id, created_at DESC);

COMMENT ON TABLE reviewer_feedback IS 'HITL 최종 결과 및 AI 대비 오버라이드. 학습 라벨 소스.';
COMMENT ON COLUMN reviewer_feedback.agreement_with_ai IS '운영 정의에 따라 배치/트리거로 채우거나 앱에서 계산.';
```

**앱 로직 예:** 검토 저장 시 `ai_analysis_result_id`는 `is_current = true`인 행을 FK로 저장.

### 3.8 기존 `reviews`와의 정합

이미 `reviews`에 `status`, `comment`, `reviewer_id`가 있다면:

- **옵션 A:** `reviewer_feedback`는 **학습 전용** 복제 레이어로 두고, 트리거/앱에서 `reviews` 갱신 시 `reviewer_feedback`에도 insert **(가정)**  
- **옵션 B:** `reviews`에 `ai_analysis_result_id`, `override_reason` 컬럼만 추가하고 `reviewer_feedback`는 생략 **(소규모 MVP)**

```sql
-- 옵션 B 예시 (reviews 확장)
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS ai_analysis_result_id uuid
    REFERENCES ai_analysis_results (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS override_reason text;
```

---

## 4. 인덱스·파티셔닝 **(가정)**

- 대량 적재 시 `ai_analysis_results`, `feature_snapshots`를 **`created_at` 월 파티션**으로 분할 검토.
- 감사 조회: `reviewer_feedback (created_at DESC)` + `entity_id` 필터.

---

## 5. Prisma 마이그레이션 시 매핑 힌트

현재 MVP의 `AiAnalysis` 단일 테이블은 다음 중 하나로 진화시키면 된다.

| MVP | 프로덕션 AI 레이어 |
|-----|-------------------|
| `AiAnalysis.riskScore` | `ai_analysis_results.risk_score` |
| `AiAnalysis.violationCategory` | `prediction_labels` (`label_type = violation_category`) |
| `AiAnalysis.explanation` | `explanation_text` + `explanation_structured` |

---

## 6. 정리

- **버전 테이블**(`model_versions`, `prompt_versions`)로 감사·재현을 담당한다.  
- **피처 스냅샷**으로 “그때 무엇을 봤는지”를 고정한다.  
- **추론 결과**는 이력(`result_seq` / `is_current`)으로 재계산을 흡수한다.  
- **reviewer_feedback**이 지도학습·품질 지표의 **강한 라벨** 소스가 된다.

프로젝트의 실제 `transactions` / `reviews` / `users` 컬럼명이 다르면 FK 컬럼명만 맞추면 된다.
