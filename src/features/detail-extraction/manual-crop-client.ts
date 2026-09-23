import type { ManualInsets, Rect, Dimensions } from "./schemas";
import type { ExtractionReview, ReviewCandidate } from "./review-model";
import { reconcileSelection } from "./review-model";
import { insetRect, manualCropRect } from "./crop-geometry";
import { MIN_CROP_WIDTH, MIN_CROP_HEIGHT, MIN_CROP_AREA } from "./policy";
import { cropRectKey } from "./crop-identity";

export const ZERO_INSETS: ManualInsets = { left: 0, top: 0, right: 0, bottom: 0 };
export type CropEdge = keyof ManualInsets;
export type ManualDraft = { basisKey: string; baseRect: Rect; sourceDimensions: Dimensions; insets: ManualInsets; stale: boolean };
export type CropDrafts = Record<string, ManualDraft>;
export type SaveReceipt = { basisKey: string; finalRect: Rect };
export type CropWorkspace = { review: ExtractionReview | null; selected: Record<string, boolean>; drafts: CropDrafts;
  receipts: Record<string, SaveReceipt>; notice: string };
export const emptyCropWorkspace = (): CropWorkspace => ({ review: null, selected: {}, drafts: {}, receipts: {}, notice: "" });
export function sameRect(a: Rect, b: Rect) { return cropRectKey(a) === cropRectKey(b); }
export function draftMatches(draft: ManualDraft, candidate: ReviewCandidate, dimensions: Dimensions) {
  return !draft.stale && draft.basisKey === candidate.basisKey && sameRect(draft.baseRect, candidate.rect)
    && draft.sourceDimensions.width === dimensions.width && draft.sourceDimensions.height === dimensions.height;
}
export function cropValidation(base: Rect, dimensions: Dimensions, insets: ManualInsets) {
  try { return { rect: manualCropRect(base, dimensions, insets), error: "" }; }
  catch { return { rect: null, error: "저장 영역이 너무 작거나 올바르지 않습니다. 가로·세로 160px 이상, 면적 64,000픽셀 이상으로 조정해 주세요." }; }
}
export function maxEdgeInset(base: Rect, insets: ManualInsets, edge: CropEdge) {
  const horizontal = edge === "left" || edge === "right", other = horizontal ? base.height - insets.top - insets.bottom : base.width - insets.left - insets.right;
  const opposite = edge === "left" ? insets.right : edge === "right" ? insets.left : edge === "top" ? insets.bottom : insets.top;
  const minimum = Math.max(horizontal ? MIN_CROP_WIDTH : MIN_CROP_HEIGHT, Math.ceil(MIN_CROP_AREA / Math.max(1, other)));
  return Math.max(0, Math.min(60000, (horizontal ? base.width : base.height) - opposite - minimum));
}
export function moveCropEdge(base: Rect, insets: ManualInsets, edge: CropEdge, value: number): ManualInsets {
  return { ...insets, [edge]: Math.max(0, Math.min(maxEdgeInset(base, insets, edge), Math.floor(value + .5))) };
}
// Arrow keys move the physical boundary; right/bottom insets therefore reverse direction.
export function keyboardInsetDelta(edge: CropEdge, key: string, shift: boolean) {
  const forward = edge === "left" || edge === "right" ? key === "ArrowRight" : key === "ArrowDown";
  const backward = edge === "left" || edge === "right" ? key === "ArrowLeft" : key === "ArrowUp";
  if (!forward && !backward) return 0;
  return (forward ? 1 : backward ? -1 : 0) * (edge === "right" || edge === "bottom" ? -1 : 1) * (shift ? 10 : 1);
}
export function pointerInset(edge: CropEdge, start: ManualInsets, sourceDelta: { x: number; y: number }) {
  return start[edge] + (edge === "left" ? sourceDelta.x : edge === "right" ? -sourceDelta.x : edge === "top" ? sourceDelta.y : -sourceDelta.y);
}
export function reconcileCropWorkspace(previous: CropWorkspace, review: ExtractionReview): CropWorkspace {
  const candidates = review.result?.candidates ?? [], dimensions = review.result?.sourceDimensions;
  const drafts: CropDrafts = {}, receipts: Record<string, SaveReceipt> = {};
  let changed = 0;
  for (const [id, draft] of Object.entries(previous.drafts)) {
    const candidate = candidates.find(c => c.id === id);
    if (!candidate || !dimensions) { changed++; continue; }
    const valid = draftMatches(draft, candidate, dimensions);
    drafts[id] = valid ? draft : { ...draft, stale: true };
    if (!valid && !draft.stale) changed++;
  }
  for (const [id, receipt] of Object.entries(previous.receipts)) {
    if (candidates.some(c => c.id === id && c.basisKey === receipt.basisKey)
      && review.savedCrops.some(c => sameRect(c.finalRect, receipt.finalRect))) receipts[id] = receipt;
  }
  return { review, selected: reconcileSelection(previous.selected, candidates), drafts, receipts,
    notice: changed ? "이미지 분석 결과가 변경되어 일부 자르기 조정을 다시 확인해야 합니다. 사라진 후보의 조정은 해제했습니다." : previous.notice };
}
export function applyManualDraft(workspace: CropWorkspace, candidate: ReviewCandidate, insets: ManualInsets): CropWorkspace {
  const dimensions = workspace.review!.result!.sourceDimensions;
  manualCropRect(candidate.rect, dimensions, insets);
  const receipts = { ...workspace.receipts }; delete receipts[candidate.id];
  return { ...workspace, receipts, drafts: { ...workspace.drafts, [candidate.id]: { basisKey: candidate.basisKey, baseRect: { ...candidate.rect },
    sourceDimensions: { ...dimensions }, insets: { ...insets }, stale: false } } };
}
export function removeManualDraft(workspace: CropWorkspace, id: string): CropWorkspace {
  const drafts = { ...workspace.drafts }, receipts = { ...workspace.receipts }; delete drafts[id]; delete receipts[id];
  return { ...workspace, drafts, receipts };
}
export function cropAlreadySaved(workspace: CropWorkspace, candidate: ReviewCandidate) {
  const { review, drafts, receipts } = workspace, draft = drafts[candidate.id];
  if (!review?.result) return false;
  if (draft) return draftMatches(draft, candidate, review.result.sourceDimensions)
    && review.savedCrops.some(saved => sameRect(saved.finalRect, insetRect(candidate.rect, draft.insets)));
  return Boolean(receipts[candidate.id]?.basisKey === candidate.basisKey || review.savedCandidateIds.includes(candidate.id));
}
export function buildCropSaveRequest(workspace: CropWorkspace) {
  const review = workspace.review;
  if (!review?.revision || !review.result) return null;
  const items = review.result.candidates.flatMap(candidate => {
    if (!workspace.selected[candidate.id] || !candidate.saveAllowed || cropAlreadySaved(workspace, candidate)) return [];
    const draft = workspace.drafts[candidate.id];
    if (draft && (!draftMatches(draft, candidate, review.result!.sourceDimensions) || !cropValidation(candidate.rect, review.result!.sourceDimensions, draft.insets).rect)) return [];
    return [{ candidateId: candidate.id, ...(draft ? { manualInsets: { ...draft.insets } } : {}) }];
  });
  return { schemaVersion: 2 as const, expectedRevision: review.revision, items };
}
export function settleCropSave(workspace: CropWorkspace, savedIds: string[]): CropWorkspace {
  const selected = { ...workspace.selected }, drafts = { ...workspace.drafts }, receipts = { ...workspace.receipts };
  for (const id of savedIds) {
    selected[id] = false;
    const candidate = workspace.review?.result?.candidates.find(c => c.id === id), draft = drafts[id];
    if (candidate && draft && !draft.stale) receipts[id] = { basisKey: candidate.basisKey, finalRect: insetRect(candidate.rect, draft.insets) };
    delete drafts[id];
  }
  return { ...workspace, selected, drafts, receipts };
}
