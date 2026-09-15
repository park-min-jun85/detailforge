export function moveSection(ids: string[], from: string, to: string) {
  const start = ids.indexOf(from), end = ids.indexOf(to);
  if (start < 0 || end < 0 || start === end) return [...ids];
  const next = [...ids]; next.splice(start, 1); next.splice(end, 0, from); return next;
}
export function orderIsDirty(canonical: string[], draft: string[]) { return canonical.length !== draft.length || canonical.some((id, i) => id !== draft[i]); }
export function needsDraftGuard(contentDirty: boolean, orderDirty: boolean, action: "move" | "select" | "leave") { return contentDirty || (action === "leave" && orderDirty); }
