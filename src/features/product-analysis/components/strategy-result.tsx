import type { Evidence, LatestProductAnalysis } from "../schemas";

function EvidenceLabels({ ids, evidence }: { ids: string[]; evidence: Evidence[] }) {
  if (!ids.length) return null;
  return <p className="mt-2 text-xs leading-5 text-zinc-500">근거: {ids.map((id) => {
    const item = evidence.find((entry) => entry.id === id);
    return item?.kind === "product_fact" ? `상품정보 · ${item.label}`
      : item?.kind === "visual_observation" ? item.label : "원본 설명 (미검증)";
  }).join(" / ")}</p>;
}
type Strategy = { rationale: string; confidence: number; evidenceIds: string[] };
function StrategyList<T extends Strategy>({ title, items, label, evidence }: {
  title: string; items: T[]; label: (item: T) => string; evidence: Evidence[];
}) {
  return <section className="panel p-6 sm:p-8">
    <h2 className="text-lg font-semibold">{title}</h2>
    {items.length ? <ul className="mt-5 divide-y divide-zinc-100">{items.map((item, index) => <li key={index} className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap justify-between gap-2"><h3 className="font-medium break-words">{label(item)}</h3>
        <span className="text-xs text-zinc-500">신뢰도 {Math.round(item.confidence * 100)}%</span></div>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-600">{item.rationale}</p>
      <EvidenceLabels ids={item.evidenceIds} evidence={evidence} />
    </li>)}</ul> : <p className="mt-4 text-sm text-zinc-500">근거가 부족하여 제안된 항목이 없습니다.</p>}
  </section>;
}
export function StrategyResult({ result }: { result: LatestProductAnalysis }) {
  const { analysis, evidenceSnapshot } = result;
  return <div className="space-y-6">
    <section className="panel p-6 sm:p-8"><h2 className="text-lg font-semibold">상품 요약</h2>
      <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-zinc-700">{analysis.summary.text}</p>
      <EvidenceLabels ids={analysis.summary.evidenceIds} evidence={evidenceSnapshot} /></section>
    <div className="grid gap-6 xl:grid-cols-2">
      <StrategyList title="핵심 판매 포인트 후보" items={analysis.valuePropositions} label={(item) => item.title} evidence={evidenceSnapshot} />
      <StrategyList title="고객군 가설" items={analysis.audienceHypotheses} label={(item) => item.label} evidence={evidenceSnapshot} />
      <StrategyList title="사용 상황 가설" items={analysis.useCaseHypotheses} label={(item) => item.title} evidence={evidenceSnapshot} />
      <StrategyList title="메시지 방향" items={analysis.messagingAngles} label={(item) => item.angle} evidence={evidenceSnapshot} />
    </div>
    <section className="panel p-6 sm:p-8"><h2 className="text-lg font-semibold">콘텐츠 우선순위</h2>
      <div className="mt-5 grid gap-6 sm:grid-cols-2">{([
        ["강조할 내용", analysis.contentPriorities.emphasize], ["강조를 줄일 내용", analysis.contentPriorities.deEmphasize],
      ] as const).map(([title, items]) => <div key={title}><h3 className="text-sm font-medium">{title}</h3>
        {items.length ? <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-600">{items.map((item, index) => <li key={index} className="break-words">{item}</li>)}</ul>
          : <p className="mt-3 text-sm text-zinc-500">제안된 항목이 없습니다.</p>}</div>)}</div></section>
    <section className="panel p-6 sm:p-8"><h2 className="text-lg font-semibold">주의 / 불확실 정보</h2>
      {analysis.cautions.length ? <ul className="mt-4 space-y-4">{analysis.cautions.map((item, index) => <li key={index}>
        <p className="break-words text-sm leading-6 text-zinc-700">{item.message}</p><EvidenceLabels ids={item.evidenceIds} evidence={evidenceSnapshot} />
      </li>)}</ul> : <p className="mt-4 text-sm text-zinc-500">AI가 별도 주의를 반환하지 않았습니다. 사실 검증이 완료됐다는 의미는 아닙니다.</p>}
    </section>
  </div>;
}
