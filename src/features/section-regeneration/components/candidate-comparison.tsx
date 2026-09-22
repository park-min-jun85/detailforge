import { textFields, SECTION_LABELS } from "@/features/detail-editor/fields";
import type { EditorSection } from "@/features/detail-editor/schemas";
import type { Candidate } from "../schemas";
import { reviewCopyRoles, COPY_REVIEW_LABELS } from "@/features/page-quality/copy-review";
export function CandidateComparison({ current, candidate, sections = [current], busy, onApply, onKeep }: { current: EditorSection; candidate: Candidate; sections?: EditorSection[]; busy: boolean; onApply: () => void; onKeep: () => void }) {
  const targetIndex = sections.findIndex(section => section.id === current.id);
  const findings = reviewCopyRoles(sections.map(section => section.id === current.id ? candidate.content : section.content))
    .filter(finding => finding.sectionIndices.includes(targetIndex));
  return <section aria-label="AI 후보 비교" className="space-y-4 border-b border-zinc-300 bg-zinc-50 p-5">
    <h2 className="text-base font-semibold">{SECTION_LABELS[current.type]} · AI 후보 비교</h2>
    <p className="text-sm leading-6 text-zinc-600">아직 저장되지 않은 후보입니다. 문구를 확인한 뒤 적용하세요. 이미지·스타일·섹션 순서는 유지됩니다.</p>
    <div className="grid min-w-0 gap-4 md:grid-cols-2">{[["현재", current.content], ["새 AI 결과", candidate.content]].map(([label, value]) => {
      const content = value as Candidate["content"];
      return <section key={String(label)} aria-label={String(label)} className="min-w-0 rounded border border-zinc-200 bg-white p-4"><h3 className="mb-3 font-semibold">{String(label)}</h3>
        <dl className="max-h-96 space-y-3 overflow-auto text-sm">{textFields(content).map(field => <div key={field.path}><dt className="text-xs text-zinc-500">{field.label}</dt><dd className="mt-1 whitespace-pre-wrap break-words">{field.value || "없음"}</dd></div>)}</dl>
        {(content.type === "specification" || content.type === "option") && <p className="mt-3 text-xs text-zinc-500">사실값 행은 기존 값으로 유지됩니다.</p>}
      </section>;
    })}</div>
    {findings.map((finding, index) => <p key={index} className="text-sm text-amber-900">
      후보 검토 · {finding.sectionIndices.map(i => `${i + 1}번 섹션`).join(" / ")}: {COPY_REVIEW_LABELS[finding.reason]}
    </p>)}
    <p className="break-words text-xs text-zinc-500">{candidate.provider} · {candidate.model} · 후보 유효 시간 10분 · 입력 근거 안의 일관성을 검증한 결과이며 게시 전 사람이 확인해야 합니다.</p>
    <div className="flex flex-wrap gap-3"><button type="button" className="button-primary" disabled={busy} onClick={onApply}>새 결과 적용</button>
      <button type="button" className="button-secondary" disabled={busy} onClick={onKeep}>기존 내용 유지</button></div>
  </section>;
}
