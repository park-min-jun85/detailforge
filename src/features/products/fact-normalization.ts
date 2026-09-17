// Shared by the save boundary and form hints. Whole-value matches only;
// additions require a source example and regression coverage, never substring rules.
const NON_FACTUAL_VALUES = new Set([
  "별도표기", "상세페이지참조", "상세설명참조", "상세정보참조",
  "해당없음", "정보없음", "미상", "없음", "x", "x/x",
]);
const punctuationOnly = (value: string) => !value.trim() || /^[\p{P}|\s]+$/u.test(value);

export function isNonFactualPlaceholder(value: string): boolean {
  const comparison = value.trim().replace(/\s+/g, " ").replace(/\s*\/\s*/g, "/").replace(/\s/g, "").toLowerCase();
  return punctuationOnly(value) || NON_FACTUAL_VALUES.has(comparison);
}

export function normalizeFactValue(value: string): string | null {
  // Comparison normalization must not rewrite meaningful source text.
  return isNonFactualPlaceholder(value) ? null : value.trim();
}

type Specification = { name: string; value: string };
export function isFactualSpecification(spec: Specification): boolean {
  return !punctuationOnly(spec.name) && spec.name.trim() !== "항목" && normalizeFactValue(spec.value) !== null;
}

export function filterFactualSpecifications(specs: readonly Specification[]): Specification[] {
  // Preserve order, conflicting values and distinct labels. Do not merge or infer.
  return specs.filter(isFactualSpecification).map(spec => ({ name: spec.name.trim(), value: spec.value.trim() }));
}
