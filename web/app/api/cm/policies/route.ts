import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getCardMonitorSession } from "@/lib/card-monitor/session";
import { normalizePolicy, type CardPolicy } from "@/lib/card-monitor/policies";

export const runtime = "nodejs";

const BLOB_PATH = "card-monitor/policies.json";
const LOCAL_FILE = path.join(process.cwd(), ".data", "policies.json");
const MAX_POLICIES = 200;

// 구형(BLOB_READ_WRITE_TOKEN) 또는 신형(BLOB_STORE_ID + Vercel OIDC) 연결 모두 지원
const hasBlob = () =>
  !!process.env.BLOB_READ_WRITE_TOKEN || !!process.env.BLOB_STORE_ID;

// 신형 네이티브 스토어는 private, 구형 토큰 스토어는 public 전용
const blobAccess = () =>
  process.env.BLOB_STORE_ID ? ("private" as const) : ("public" as const);

async function readPolicies(): Promise<CardPolicy[]> {
  if (hasBlob()) {
    const { get } = await import("@vercel/blob");
    const result = await get(BLOB_PATH, {
      access: blobAccess(),
      useCache: false,
    }).catch(() => null);
    if (!result || !result.stream) return [];
    const text = await new Response(result.stream).text();
    const json = JSON.parse(text) as unknown;
    return Array.isArray(json)
      ? json.map((p) => normalizePolicy(p as Partial<CardPolicy>))
      : [];
  }
  try {
    const raw = await fs.readFile(LOCAL_FILE, "utf8");
    const json = JSON.parse(raw) as unknown;
    return Array.isArray(json)
      ? json.map((p) => normalizePolicy(p as Partial<CardPolicy>))
      : [];
  } catch {
    return [];
  }
}

async function writePolicies(policies: CardPolicy[]): Promise<void> {
  if (hasBlob()) {
    const { put } = await import("@vercel/blob");
    await put(BLOB_PATH, JSON.stringify(policies), {
      access: blobAccess(),
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return;
  }
  await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true });
  await fs.writeFile(LOCAL_FILE, JSON.stringify(policies), "utf8");
}

export async function GET() {
  const authed = await getCardMonitorSession();
  if (!authed) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  try {
    return NextResponse.json({ policies: await readPolicies() });
  } catch (e) {
    console.error("[api/cm/policies] GET", e);
    return NextResponse.json({ policies: [] });
  }
}

export async function PUT(req: Request) {
  const authed = await getCardMonitorSession();
  if (!authed) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (!hasBlob() && process.env.VERCEL) {
    return NextResponse.json(
      {
        error:
          "정책 서버 저장소가 없습니다. Vercel 대시보드 → Storage → Blob 스토어를 생성하고 재배포하세요.",
      },
      { status: 503 },
    );
  }
  let body: { policies?: unknown };
  try {
    body = (await req.json()) as { policies?: unknown };
  } catch {
    return NextResponse.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }
  if (!Array.isArray(body.policies) || body.policies.length > MAX_POLICIES) {
    return NextResponse.json(
      { error: "policies 배열이 필요합니다(최대 200개)." },
      { status: 400 },
    );
  }
  const policies = body.policies.map((p) =>
    normalizePolicy(p as Partial<CardPolicy>),
  );
  try {
    await writePolicies(policies);
    return NextResponse.json({ ok: true, count: policies.length });
  } catch (e) {
    console.error("[api/cm/policies] PUT", e);
    return NextResponse.json(
      { error: "정책 저장에 실패했습니다." },
      { status: 500 },
    );
  }
}
