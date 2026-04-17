# cardanalysis — 법인카드 모니터링 로컬 프로토타입

## 구성

- `design-preview.html` — 대시보드 UI + 엑셀 업로드 자동 검토
- `server/` — **Node.js API** (Express) + **SQLite**(기본) 또는 **Firebase Firestore** 저장, 서버 측 파싱·검토·감사 로그
- **`web/`** — **Next.js MVP** (PostgreSQL + Prisma + NextAuth + TanStack Query + AI 목/OpenAI) — 상세는 `web/README.md`

### Vercel 배포 (Next.js `web/`)

1. [Vercel](https://vercel.com) → **Add New** → **Project** → GitHub 저장소 선택.
2. **Settings → General → Root Directory** 를 반드시 **`web`** 으로 지정한 뒤 저장합니다. (모노레포 루트가 아닙니다.)
3. **Environment Variables** 는 `web/README.md` «Vercel 배포» 참고 (`DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` 등).
4. **Deploy** 후 Production URL을 `NEXTAUTH_URL`에 다시 맞춥니다. (현재 프로덕션 예: **`https://sbsmccard.vercel.app`**)
5. GitHub와 연결되어 있으면 `main` 푸시마다 자동 배포됩니다. 수동 재배포: 대시보드 **Deployments** → 최신 배치 **⋯** → **Redeploy**.

CLI: 저장소 루트에서 `cd web` 후 `npx vercel --prod` (또는 이미 연결된 경우 프로젝트 루트가 `web`이어야 합니다).

GitHub Actions 수동 배포: `.github/workflows/vercel-deploy.yml` — `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` 시크릿 필요.

**법인카드 모니터링 UI**(엑셀 업로드·KPI·정책 관리 화면)는 **`web/public/design-preview.html`** 으로 제공되며, 배포 사이트에서 **`/` → `/design-preview.html`** 로 연결됩니다. 로그인은 **`/login.html`** → PostgreSQL에 배치 저장은 **`/api/import/*`** (Prisma `CardImportBatch`). 로컬 Express(`server/`, 포트 3001)를 쓸 때는 저장소 루트의 `design-preview.html`이 기존처럼 `/api/auth`를 사용합니다.

## 서버 실행

```bash
cd server
cp .env.example .env
# Firestore 쓰려면 .env 에 DATABASE_BACKEND=firestore 와 GOOGLE_APPLICATION_CREDENTIALS 등 설정
npm install
npm test
npm start
```

서버는 시작 시 **`server/.env`** 를 자동으로 읽습니다(`bootstrapEnv.js` + `dotenv`).

브라우저에서 **http://localhost:3001/design-preview.html** 로 접속하세요.  
(파일을 `file://`로 직접 열면 브라우저 보안상 API 업로드가 막힐 수 있습니다.)

### 서버(`server/`) 보안 요약

- **운영(`NODE_ENV=production`)** 에서는 `SESSION_SECRET`(32자+), `CARD_MONITOR_ADMIN_PASSWORD`(12자+) **필수**이며, 미설정 시 프로세스가 종료됩니다. `server/.env.example` 참고.
- **개발**: 비밀번호 미설정 시 경고 후 기본 `admin` / `admin` (인터넷에 노출되지 않는 로컬에서만 사용).
- **CORS**: 운영에서는 `ALLOWED_ORIGINS`에 허용 출처만 나열하세요. 미설정 시 브라우저 교차 출처 요청은 거부됩니다.
- **기타**: Helmet 보조 헤더, 로그인·API **레이트 리밋**, 업로드 **확장자·MIME 검사**, 배치 ID **UUID 검증**, 로그인 실패 시 **지연·타이밍 안전 비교**.

## API 요약

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/health` | 헬스 체크 |
| POST | `/api/import/upload` | `multipart/form-data` 필드명 `file` — 엑셀/CSV 업로드, DB 저장 |
| POST | `/api/import/sample` | 샘플 데이터 적재 |
| GET | `/api/import/batches` | 최근 배치 목록 |
| GET | `/api/import/batches/:id` | 배치 상세 + 행 |

**SQLite**(기본): `server/data/app.db` (자동 생성)

**Firebase Firestore**: Firebase 콘솔에서 프로젝트 생성 → Firestore(Native) 사용 설정 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키(JSON) 다운로드. 서버 환경 변수 예시:

- `DATABASE_BACKEND=firestore` (또는 `USE_FIREBASE_FIRESTORE=1`)
- `GOOGLE_APPLICATION_CREDENTIALS` = 위 JSON 파일의 **절대 경로**

컬렉션: `import_batches` (배치 메타), 하위 `import_rows` (행), `audit_logs` (감사). Admin SDK는 보안 규칙을 우회하므로 **이 API는 서버에서만** 자격 증명을 두세요.

## 가정

- 프로덕션에서는 PostgreSQL, 인증, 파일 스토리지 분리 등으로 교체하는 것을 권장합니다.
