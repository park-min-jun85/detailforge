import Link from "next/link";
import type { RenderView } from "./model";
import { RenderSurface } from "./surface";
export function RenderReview({ view }: { view: RenderView }) {
  const { readiness: ready } = view;
  return <div className="page-content">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold tracking-widest text-zinc-500">DETAIL PREVIEW</p><h1 className="mt-2 text-2xl font-semibold">최종 미리보기</h1><p className="mt-2 break-words text-sm text-zinc-600">{view.projectName} · {view.productName ?? "상품정보 없음"}</p></div>
      <Link prefetch={false} href={`/projects/${view.projectId}/editor`} className="button-secondary">편집기로 돌아가기</Link></header>
    {view.state === "ready" ? <>
      <section aria-label="상세페이지 준비 상태" className="panel space-y-3 p-5"><h2 className="font-semibold">상세페이지 준비 상태</h2><ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-600"><li>Sections {ready.sectionCount}개</li><li>사실 확인 필요한 수동 문구 {ready.needsReviewCount}개</li><li>누락 이미지 {ready.missingImageCount}개</li><li>출력 폭 {view.width}px</li></ul>
        <p className="text-xs leading-5 text-zinc-500">저장된 내용만 표시합니다. 편집 중인 문구·순서와 미적용 AI 후보는 포함되지 않습니다. 이미지가 만료되거나 보이지 않으면 이 페이지를 다시 열어 주세요.</p>
        {ready.stalePlan && <p role="status" className="text-sm text-amber-900">페이지 설계 변경됨 · 현재 저장된 상세페이지를 확인하고 있습니다.</p>}
        {ready.needsReviewCount > 0 && <p role="status" className="text-sm text-amber-900">사실 확인이 필요한 수동 문구가 있습니다. 게시 전 확인해 주세요.</p>}
        {ready.validation !== "ready" && <p role="status" className="text-sm text-amber-900">최신 사실 검증 상태를 확인해 주세요. <Link className="text-link" href={`/projects/${view.projectId}/validation`}>사실 검증 확인</Link></p>}
        {ready.unavailable && <p role="status" className="text-sm text-amber-900">준비 상태 일부를 확인하지 못했습니다. 저장된 내용은 아래에서 확인할 수 있습니다.</p>}
      </section>
      <div className="min-w-0 overflow-x-auto border border-zinc-200 bg-zinc-100" tabIndex={0} role="region" aria-label="최종 상세페이지 보기 · 좁은 화면에서는 가로 스크롤">
        <RenderSurface width={view.width!} sections={view.sections} assets={view.assets} />
      </div>
    </> : <section className="panel space-y-4 p-8 text-center"><h2 className="font-semibold">{view.state === "busy" ? "저장·생성·복구가 진행 중입니다." : view.state === "product_missing" ? "먼저 상품정보를 입력해 주세요." : "먼저 상세페이지를 생성해 주세요."}</h2>
      <p className="text-sm text-zinc-600">{view.state === "busy" ? "작업이 완료된 뒤 최종 미리보기를 다시 열어 주세요." : "저장된 상세페이지가 준비되면 최종 결과를 확인할 수 있습니다."}</p>
      <Link className="button-primary" href={view.state === "product_missing" ? `/projects/${view.projectId}` : `/projects/${view.projectId}/sections`}>{view.state === "product_missing" ? "상품정보 입력" : "상세페이지 생성으로 이동"}</Link>
    </section>}
  </div>;
}
