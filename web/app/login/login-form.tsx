"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type SystemStatus = {
  mode: "database" | "fallback-auth" | "setup-required";
  hasFallbackAuth: boolean;
  message: string | null;
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<SystemStatus | null>(null);

  useEffect(() => {
    fetch("/api/system/status", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => setStatus(json))
      .catch(() => setStatus(null));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status?.mode === "setup-required") {
      setError(status.message ?? "서비스 설정이 아직 완료되지 않았습니다.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("아이디 또는 비밀번호가 올바르지 않습니다.");
      return;
    }
    const next = searchParams.get("callbackUrl") ?? "/";
    router.push(next);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">로그인</h1>
        <p className="mt-1 text-sm text-slate-500">내부 회계용 관리자 로그인</p>
        {status?.mode === "fallback-auth" && (
          <p className="mt-3 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
            현재는 운영 DB 연결 전 임시 보호 모드입니다. 발급받은 관리자 계정으로 로그인하세요.
          </p>
        )}
        {status?.mode === "setup-required" && (
          <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {status.message}
          </p>
        )}
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">아이디</label>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">비밀번호</label>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-primary py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "처리 중…" : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}
