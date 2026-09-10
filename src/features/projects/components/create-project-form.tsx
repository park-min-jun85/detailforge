"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { createProjectAction } from "../actions";
import type { CreateProjectState } from "../types";

const initialState: CreateProjectState = {};

export function CreateProjectForm() {
  const [state, formAction, pending] = useActionState(createProjectAction, initialState);
  const [name, setName] = useState("");
  const submitting = useRef(false);

  useEffect(() => {
    if (!pending) submitting.current = false;
  }, [pending, state]);

  return (
    <form action={formAction} aria-busy={pending} className="panel max-w-2xl space-y-6 p-6 sm:p-8"
      onSubmit={(event) => {
        if (pending || submitting.current) event.preventDefault();
        else submitting.current = true;
      }}>
      <div>
        <label htmlFor="project-name" className="block text-sm font-semibold">프로젝트명 <span className="text-zinc-500">(필수)</span></label>
        <input id="project-name" name="name" type="text" required maxLength={100}
          value={name} onChange={(event) => setName(event.target.value)} readOnly={pending}
          aria-invalid={Boolean(state.fieldError)}
          aria-describedby={state.fieldError ? "project-name-hint project-name-error" : "project-name-hint"}
          placeholder="예: 스테인리스 텀블러 상세페이지"
          className="mt-3 block min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm read-only:bg-zinc-50" />
        <p id="project-name-hint" className="mt-2 text-xs leading-5 text-zinc-500">작업을 구분할 수 있는 이름을 1~100자로 입력하세요.</p>
        {state.fieldError && <p id="project-name-error" role="alert" className="mt-2 text-sm text-red-700">{state.fieldError}</p>}
      </div>
      {state.message && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
          <p>{state.message}</p>
          <Link href="/projects" className="mt-2 inline-block underline underline-offset-4">프로젝트 목록 확인</Link>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-4 border-t border-zinc-200 pt-6">
        <button type="submit" disabled={pending} className="button-primary">
          {pending ? "생성 중…" : "프로젝트 생성"}
        </button>
        {pending
          ? <span className="text-sm text-zinc-500" role="status">프로젝트를 저장하고 있습니다.</span>
          : <Link href="/projects" className="text-link">취소</Link>}
      </div>
    </form>
  );
}