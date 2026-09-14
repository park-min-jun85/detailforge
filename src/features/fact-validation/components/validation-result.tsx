import { STATUS_LABELS, VALIDATION_STATUSES, type ValidationResult as Result } from "../schemas";

const colors = { supported: "bg-emerald-50 text-emerald-800", insufficient: "bg-zinc-100 text-zinc-700", conflict: "bg-red-50 text-red-800", needs_review: "bg-amber-50 text-amber-900" };
export function ValidationResult({ result, stale }: { result: Result; stale: boolean }) {
  const evidence = new Map(result.evidenceSnapshot.map((item) => [item.id, item]));
  return <section className="space-y-5" aria-label="저장된 Fact 검증 결과">
    <div className="panel p-6 sm:p-8">
      <h2 className="text-lg font-semibold">{stale ? "이전 입력의 검증 결과" : "Fact별 검증 결과"}</h2>
      <p className="mt-2 text-sm text-zinc-600">전체 판정: {STATUS_LABELS[result.status]} · 아래 값은 검증 당시의 값입니다.</p>
      <dl className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">{VALIDATION_STATUSES.map((status) => <div key={status} className="rounded-md border border-zinc-200 p-4">
        <dt className="text-sm text-zinc-600">{STATUS_LABELS[status]}</dt><dd className="mt-2 text-2xl font-semibold">{result.counts[status]}</dd></div>)}</dl>
      <ul className="mt-5 list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-600">{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
    </div>
    <div className="grid gap-5 xl:grid-cols-2">{result.facts.map((fact) => <article key={fact.factId} className="panel min-w-0 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="min-w-0 break-words font-semibold">{fact.label}</h3>
        <span className={`rounded px-2 py-1 text-xs font-medium ${colors[fact.status]}`}>{STATUS_LABELS[fact.status]}</span></div>
      <p className="mt-3 text-xs text-zinc-500">검증 당시 값</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{fact.value}</p>
      <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-700">{fact.reason}</p>
      <p className="mt-3 text-xs text-zinc-500">판정 신뢰도 {Math.round(fact.confidence * 100)}% · 사실의 진위 확률이 아닙니다.</p>
      <div className="mt-4 space-y-2 text-xs text-zinc-600">{fact.evidenceIds.length ? fact.evidenceIds.map((id) => {
        const item = evidence.get(id);
        return <details key={id} className="rounded border border-zinc-200 p-3"><summary className="cursor-pointer break-words">{item?.label} ({id})</summary>
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-all font-sans leading-5">{item?.value}</pre></details>;
      }) : <p>참조할 비교 근거가 없습니다.</p>}</div>
    </article>)}</div>
  </section>;
}
