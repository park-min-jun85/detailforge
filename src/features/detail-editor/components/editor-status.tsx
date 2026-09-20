export type EditorAction = "refresh" | "save" | "recover" | "generate" | "apply" | "options";

const ACTION_LABELS: Record<EditorAction, string> = {
  refresh: "최신 섹션을 불러오는 중…",
  save: "저장 중…",
  recover: "이전 순서를 복구하는 중…",
  generate: "AI가 이 섹션을 다시 작성하고 있습니다.",
  apply: "선택한 AI 후보를 적용하는 중…",
  options: "확정 옵션을 반영하는 중…",
};

export function EditorStatus({ action, dirty, orderDirty, message }: {
  action: EditorAction | null; dirty: boolean; orderDirty: boolean; message: string;
}) {
  return <p role="status" className="text-sm text-zinc-600">{action ? ACTION_LABELS[action]
    : dirty ? "저장되지 않은 변경사항" : orderDirty ? "저장되지 않은 순서 변경" : message || "저장된 상태"}</p>;
}
