import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <p className="text-sm text-slate-500">로딩 중…</p>
    </div>
  );
}
