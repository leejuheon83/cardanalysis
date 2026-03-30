# 법인카드 컴플라이언스 MVP (Next.js)

**Cursor 단계별 가이드(복사용):** [`CURSOR_MVP_GUIDE.md`](./CURSOR_MVP_GUIDE.md)

## 스택

- Next.js 14 App Router · TypeScript · Tailwind
- Prisma · PostgreSQL
- NextAuth (Credentials + JWT 세션)
- TanStack Query
- OpenAI 선택 (`OPENAI_API_KEY` 없으면 목 분석)

## 구조

```
web/
├── app/                    # 페이지 + Route Handlers
│   ├── api/
│   ├── login/
│   ├── transactions/
│   ├── ai-layer/
│   └── audit/
├── components/             # Providers, Shell
├── lib/                    # prisma, auth, csv, ai, audit
├── server/                 # createTransactionWithAi
├── prisma/                 # schema + seed
├── types/
└── public/sample-transactions.csv
```

## 설정

1. PostgreSQL 준비 후 `.env` 생성 (`.env.example` 참고).

```bash
cp .env.example .env
# DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL 수정
```

2. DB 반영 및 시드

```bash
npm install
npx prisma generate
npx prisma db push
npm run db:seed
```

3. 개발 서버

```bash
npm run dev
```

- 로그인: `accounting@example.com` / `accounting123` 또는 `admin@example.com` / `admin123`
- CSV: `public/sample-transactions.csv` 업로드 테스트

## API 요약

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/dashboard` | 총거래·플래그·위반·대기 |
| GET | `/api/transactions` | 목록 (쿼리: from,to,userLabel,minAmount,maxAmount) |
| POST | `/api/transactions/upload` | multipart `file` (CSV) |
| GET | `/api/transactions/[id]` | 상세 + AI + 검토 |
| PATCH | `/api/transactions/[id]/review` | `{ status, comment? }` |
| GET | `/api/audit` | 감사 로그 100건 |

## AI

- `lib/ai/analyze-transaction.ts`의 `analyzeTransaction()`  
- `OPENAI_API_KEY` 설정 시 `gpt-4o-mini`(또는 `OPENAI_MODEL`) JSON 응답 파싱, 실패 시 목 로직 폴백.

### AI 레이어 DB

- `FeatureSnapshot` → `AiAnalysisResult` → `PredictionLabel`, `ModelVersion`, `ReviewerFeedback`, `Review`(aiAnalysisResultId), 선택적 `AiAnalysisRun` / `PromptVersion`.
- 검토 PATCH 시 `ReviewerFeedback` 생성.
- UI: **`/ai-layer`** · 정적 미리보기: `public/ai-layer-preview.html`
- API: `GET /api/ai-layer`

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/ai-layer` | 모델/결과/스냅샷/피드백 건수 요약 |
