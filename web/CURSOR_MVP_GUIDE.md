# Cursor용 MVP 구현 가이드 (법인카드 컴플라이언스)

이 문서는 **그대로 복사해 Cursor에 붙여 넣고** 단계별로 따라 하거나, 이미 생성된 `web/` 코드와 대조할 때 사용합니다.

---

## 1) 단계별 셋업

### 사전 요구

- Node.js 18+
- PostgreSQL 인스턴스

### 1. 저장소 / 폴더

```bash
cd web
```

### 2. 환경 변수

`.env.example`을 복사해 `.env` 생성:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/card_compliance?schema=public"
NEXTAUTH_SECRET="openssl rand -base64 32 로 생성"
NEXTAUTH_URL="http://localhost:3000"
# 선택: OpenAI 사용 시
# OPENAI_API_KEY="sk-..."
# OPENAI_MODEL="gpt-4o-mini"
```

### 3. 의존성 · DB · 시드

```bash
npm install
npx prisma generate
npx prisma db push
npm run db:seed
```

### 4. 개발 서버

```bash
npm run dev
```

브라우저: `http://localhost:3000`  
로그인(시드):

- `admin@example.com` / `admin123`
- `accounting@example.com` / `accounting123`

### 5. 동작 확인 체크리스트

1. 로그인 성공 → 대시보드 KPI 표시  
2. **거래 목록** → CSV 업로드 → 행 생성 + 색상(정상/의심/위반)  
3. **상세** → AI 설명 표시 → 승인/위반/기각 클릭  
4. **감사 로그** → `transaction.create`, `review.update` 기록 확인  

---

## 2) 전체 Prisma 스키마

파일: `prisma/schema.prisma` (아래와 동일)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  ACCOUNTING
}

enum ReviewStatus {
  PENDING
  APPROVED
  VIOLATION
  DISMISSED
}

model User {
  id           String     @id @default(cuid())
  email        String     @unique
  name         String?
  passwordHash String
  role         Role       @default(ACCOUNTING)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  reviews      Review[]
  auditLogs    AuditLog[]
}

model Transaction {
  id           String       @id @default(cuid())
  amount       Decimal      @db.Decimal(14, 2)
  currency     String       @default("KRW")
  merchantName String?
  category     String?
  userLabel    String?
  txnDate      DateTime
  description  String?
  rawMetadata  Json?
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
  aiAnalysis   AiAnalysis?
  review       Review?
}

model AiAnalysis {
  id                String      @id @default(cuid())
  transactionId     String      @unique
  transaction       Transaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)
  riskScore         Int
  violationCategory String
  explanation       String      @db.Text
  modelVersion      String?
  createdAt         DateTime    @default(now())
}

model Review {
  id              String        @id @default(cuid())
  transactionId   String        @unique
  transaction     Transaction   @relation(fields: [transactionId], references: [id], onDelete: Cascade)
  status          ReviewStatus  @default(PENDING)
  reviewerId      String?
  reviewer        User?         @relation(fields: [reviewerId], references: [id])
  comment         String?
  decidedAt       DateTime?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
}

model AuditLog {
  id         String   @id @default(cuid())
  actorId    String?
  actor      User?    @relation(fields: [actorId], references: [id])
  action     String
  entityType String
  entityId   String?
  payload    Json?
  createdAt  DateTime @default(now())
}
```

---

## 3) 핵심 API 라우트

| 메서드 | 경로 | 파일 | 설명 |
|--------|------|------|------|
| POST | `/api/auth/[...nextauth]` | `app/api/auth/[...nextauth]/route.ts` | NextAuth |
| GET | `/api/dashboard` | `app/api/dashboard/route.ts` | 총거래·플래그·위반·대기 |
| GET | `/api/transactions` | `app/api/transactions/route.ts` | 필터: `from`,`to`,`userLabel`,`minAmount`,`maxAmount` |
| POST | `/api/transactions/upload` | `app/api/transactions/upload/route.ts` | `multipart` 필드명 `file` (CSV) |
| GET | `/api/transactions/[id]` | `app/api/transactions/[id]/route.ts` | 상세 + AI + 검토 |
| PATCH | `/api/transactions/[id]/review` | `app/api/transactions/[id]/review/route.ts` | `{ status, comment? }` |
| GET | `/api/audit` | `app/api/audit/route.ts` | 최근 100건 |

`middleware.ts`: 페이지 보호( `/api` 제외 ).

---

## 4) 핵심 페이지

| 경로 | 파일 | 역할 |
|------|------|------|
| `/login` | `app/login/page.tsx` | Credentials 로그인 |
| `/` | `app/page.tsx` | 대시보드 KPI |
| `/transactions` | `app/transactions/page.tsx` | CSV 업로드 + 필터 + **색상 구분 테이블** |
| `/transactions/[id]` | `app/transactions/[id]/page.tsx` | AI 설명 + 검토 버튼 |
| `/audit` | `app/audit/page.tsx` | 감사 로그 테이블 |

공통 레이아웃: `components/shell.tsx` — **사이드바(md+) + 탑바 + 본문** (모바일은 탑바에 링크).

---

## 5) 예시 컴포넌트 / 유틸 (요약)

### 행 상태 색상 규칙

파일: `lib/transaction-row-status.ts`

- **위반**: 검토 `VIOLATION` 또는 리스크 ≥ 70  
- **의심**: 검토 `PENDING` 또는 리스크 ≥ 40 (단, 승인/기각은 항상 정상 표시)  
- **정상**: 그 외 + 승인/기각

### 배지 컴포넌트

파일: `components/status-badge.tsx` — `TransactionStatusBadge`

### 셸

파일: `components/shell.tsx` — `AppShell` (관리자 레이아웃)

---

## 6) AI 분석 함수

**단일 진입점**: `lib/ai/analyze-transaction.ts` → `analyzeTransaction(input)`

- `OPENAI_API_KEY` 없음 → **규칙 기반 목** (금액 구간 + 가맹점 키워드)  
- 있음 → `gpt-4o-mini`(또는 `OPENAI_MODEL`) JSON 응답 파싱, 실패 시 목 폴백  

거래 생성 파이프라인: `server/create-transaction-with-ai.ts`  
→ `Transaction` + `AiAnalysis` + `Review(PENDING)` + `AuditLog`

목 로직 핵심(요약):

```ts
// 금액: 20만 / 50만 / 100만 이상 가산
// 가맹점: 유흥·호텔·BAR 등 키워드 가산
// risk 0~99 → violationCategory 문자열 + explanation 문장
```

---

## 7) 샘플 CSV 형식

최소 권장 헤더(한글·영문 자동 매핑은 `lib/csv-parse.ts` 참고):

```csv
거래일시,가맹점명,이용금액,사용자
2025-03-26T12:00:00,○○식당,35000,김회계
2025-03-26T14:00:00,△△유흥주점,120000,김회계
2025-03-25T09:00:00,□□전자,1250000,이재무
```

- **거래일시**: ISO 또는 브라우저가 파싱 가능한 날짜 문자열  
- **이용금액**: 숫자(콤마·원 허용)  
- 저장 위치 예시: `public/sample-transactions.csv`  

---

## 8) 과하지 않게 유지한 범위 (MVP)

- 단일 테넌트, RBAC는 역할 필드만 (화면 분기 최소)  
- CSV만 업로드 (엑셀은 추후)  
- AI는 1건씩 동기 분석 (대량은 배치 큐로 확장)  

---

## 9) 트러블슈팅

| 증상 | 조치 |
|------|------|
| Prisma 클라이언트 없음 | `npx prisma generate` |
| DB 연결 실패 | `DATABASE_URL` 확인, Postgres 기동 |
| 로그인 후 401 API | `NEXTAUTH_SECRET` / 쿠키 도메인, `credentials: "include"` |
| 미들웨어가 API 막음 | `middleware` matcher에서 `/api` 제외 확인 |

---

이 가이드와 `web/` 소스가 일치하도록 유지하세요. 스키마 변경 시 **이 문서 §2**도 함께 갱신하면 Cursor 맥락이 깨지지 않습니다.
