"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { AUTH_ERRORS, type AuthErrorCode } from "@/lib/auth/errors";
import { safeReturnPath } from "@/lib/auth/return-path";

export function AuthForm({ mode, next, notice }: { mode: "login" | "signup"; next: string; notice?: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(notice === "confirmation_failed" ? "인증 링크를 확인하지 못했습니다. 다시 가입 요청하거나 로그인해 주세요." : "");
  const [submitted, setSubmitted] = useState(false);
  const busy = useRef(false), announcement = useRef<HTMLParagraphElement>(null);
  const signup = mode === "signup", destination = safeReturnPath(next);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy.current) return;
    const form = event.currentTarget, data = new FormData(form);
    busy.current = true; setPending(true); setMessage("");
    try {
      const response = await fetch(`/auth/${signup ? "signup" : "signin"}`, { method: "POST",
        headers: { "Content-Type": "application/json" }, credentials: "same-origin", cache: "no-store",
        body: JSON.stringify({ email: data.get("email"), password: data.get("password") }) });
      const result = await response.json();
      if (!response.ok) {
        const code = result?.error?.code;
        setMessage(typeof code === "string" && Object.hasOwn(AUTH_ERRORS, code)
          ? AUTH_ERRORS[code as AuthErrorCode].message : AUTH_ERRORS.temporary_failure.message);
      } else if (signup) {
        setSubmitted(true);
        setMessage("가입 요청을 접수했습니다. 확인 메일을 받았다면 인증을 완료한 뒤 로그인해 주세요. 이미 가입했거나 이메일 확인이 필요 없는 경우 바로 로그인할 수 있습니다.");
      } else {
        // A full navigation discards the previous account's RSC/router memory.
        window.location.replace(destination); return;
      }
    } catch { setMessage(AUTH_ERRORS.temporary_failure.message); }
    finally {
      const password = form.elements.namedItem("password");
      if (password instanceof HTMLInputElement) password.value = "";
      busy.current = false; setPending(false);
      requestAnimationFrame(() => announcement.current?.focus());
    }
  }
  return <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-12">
    <p className="mb-8 text-lg font-bold tracking-tight">DetailForge</p>
    <section className="panel p-6 sm:p-8" aria-labelledby="auth-title">
      <h1 id="auth-title" className="text-2xl font-semibold">{signup ? "회원가입" : "로그인"}</h1>
      <p className="mt-3 text-sm leading-6 text-zinc-600">{signup ? "이메일과 비밀번호로 작업 공간을 시작하세요." : "상품 상세페이지 작업을 이어가세요."}</p>
      <form onSubmit={submit} aria-busy={pending} className="mt-6 space-y-5">
        <div><label htmlFor="auth-email" className="text-sm font-semibold">이메일</label>
          <input id="auth-email" name="email" type="email" autoComplete="email" required maxLength={254} disabled={pending}
            className="mt-2 block min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2" /></div>
        <div><label htmlFor="auth-password" className="text-sm font-semibold">비밀번호</label>
          <input id="auth-password" name="password" type="password" autoComplete={signup ? "new-password" : "current-password"}
            required minLength={signup ? 8 : 1} maxLength={1024} disabled={pending} aria-describedby={signup ? "password-hint" : undefined}
            className="mt-2 block min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2" />
          {signup && <p id="password-hint" className="mt-2 text-xs text-zinc-600">8자 이상 입력해 주세요.</p>}</div>
        {message && <p ref={announcement} tabIndex={-1} role={submitted ? "status" : "alert"}
          className={`rounded-lg p-3 text-sm leading-6 ${submitted ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"}`}>{message}</p>}
        <button type="submit" className="button-primary w-full justify-center" disabled={pending}>
          {pending ? "처리 중…" : signup ? "가입 요청" : "로그인"}</button>
      </form>
      <p className="mt-6 text-sm text-zinc-600">{signup ? "이미 계정이 있나요? " : "처음 이용하시나요? "}
        <Link className="text-link" href={`/${signup ? "login" : "signup"}?${new URLSearchParams({ next: destination })}`}>{signup ? "로그인" : "회원가입"}</Link></p>
    </section>
  </div>;
}
