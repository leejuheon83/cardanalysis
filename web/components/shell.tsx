"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const nav = [
  { href: "/", label: "대시보드" },
  { href: "/transactions", label: "거래 목록" },
  { href: "/policy-rules", label: "정책 규칙" },
  { href: "/ai-layer", label: "AI 레이어" },
  { href: "/audit", label: "감사 로그" },
];

/** 관리자 레이아웃: 좌측 사이드바 + 상단 바 + 본문 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { data } = useSession();
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-slate-800 bg-slate-900 text-slate-100 md:flex">
        <div className="border-b border-slate-800 px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">내부 시스템</p>
          <p className="mt-1 text-sm font-semibold text-white">카드 컴플라이언스</p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {nav.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 shadow-sm">
          <div className="flex h-14 items-center justify-between">
          <nav className="flex gap-3 overflow-x-auto text-sm md:hidden">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap font-medium text-primary underline-offset-4 hover:underline"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="hidden md:block flex-1" aria-hidden />
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span className="truncate max-w-[200px] sm:max-w-none">
              {data?.user?.email}
              <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                {data?.user?.role}
              </span>
            </span>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
            >
              로그아웃
            </button>
          </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      </div>
    </div>
  );
}
