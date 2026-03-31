# cardanalysis — 법인카드 모니터링 로컬 프로토타입

## 구성

- `design-preview.html` — 대시보드 UI + 엑셀 업로드 자동 검토
- `server/` — **Node.js API** (Express) + **SQLite** 저장, 서버 측 파싱·검토·감사 로그
- **`web/`** — **Next.js MVP** (PostgreSQL + Prisma + NextAuth + TanStack Query + AI 목/OpenAI) — 상세는 `web/README.md`

**Vercel 배포:** GitHub 저장소 `cardanalysis`와 Vercel 프로젝트 **`web`** 이 연결되어 있으면 `main`에 푸시할 때마다 배포됩니다. 모노레포 루트의 `vercel.json`이 **Install/Build를 `web` 하위에서 실행**하도록 설정되어 있습니다. 환경 변수는 Vercel 대시보드(해당 프로젝트 → Settings → Environment Variables)와 `web/README.md`의 «Vercel 배포»를 참고하세요.

## 서버 실행

```bash
cd server
npm install
npm test
npm start
```

브라우저에서 **http://localhost:3001/design-preview.html** 로 접속하세요.  
(파일을 `file://`로 직접 열면 브라우저 보안상 API 업로드가 막힐 수 있습니다.)

## API 요약

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/health` | 헬스 체크 |
| POST | `/api/import/upload` | `multipart/form-data` 필드명 `file` — 엑셀/CSV 업로드, DB 저장 |
| POST | `/api/import/sample` | 샘플 데이터 적재 |
| GET | `/api/import/batches` | 최근 배치 목록 |
| GET | `/api/import/batches/:id` | 배치 상세 + 행 |

SQLite 파일: `server/data/app.db` (자동 생성)

## 가정

- 프로덕션에서는 PostgreSQL, 인증, 파일 스토리지 분리 등으로 교체하는 것을 권장합니다.
