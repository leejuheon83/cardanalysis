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

1. PostgreSQL 준비 (로컬은 Docker 권장) 후 `.env` 생성 (`.env.example` 참고).

```bash
docker compose -f docker-compose.yml up -d
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

## Vercel 배포

1. [Vercel](https://vercel.com)에서 GitHub 저장소 **Import** → **Root Directory**를 `web`으로 지정.
2. **Environment Variables** (프로젝트 → Settings → Environment Variables):
   - `DATABASE_URL` — Neon / Supabase / Vercel Postgres 등 **PostgreSQL** 연결 문자열 (`?sslmode=require` 포함 권장).
   - `NEXTAUTH_SECRET` — `openssl rand -base64 32` 등으로 생성한 임의 문자열.
   - `NEXTAUTH_URL` — 배포 후 표시되는 URL (예: `https://<프로젝트명>.vercel.app`). Preview/Production 각각 설정 가능.
   - (선택) `OPENAI_API_KEY`
3. 첫 배포 전에 DB에 스키마 반영: 로컬에서 프로덕션 `DATABASE_URL`로 `npx prisma db push` 또는 마이그레이션 적용.
4. Redeploy 후 동일 URL로 로그인·API 동작을 확인.

`web/vercel.json`에 `framework: nextjs`, 기본 리전 `icn1`을 넣어 두었습니다. 리전은 Vercel 대시보드에서 변경할 수 있습니다.

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
