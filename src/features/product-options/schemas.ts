import { z } from "zod";
import { isNonFactualPlaceholder } from "@/features/products/fact-normalization";

export const MAX_OPTION_GROUPS = 10;
export const MAX_GROUP_VALUES = 30;
export const MAX_OPTION_VALUES = 100;
const comparison = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

// Explicit manual choices may mean "none" or the size X. Do not blindly apply Fact semantics.
export function isOptionPlaceholder(value: string) {
  return isNonFactualPlaceholder(value) && !["없음", "해당없음", "x"].includes(comparison(value).replace(/\s/g, ""));
}
const draftValue = z.strictObject({ id: z.uuid(), label: z.string().max(200) });
const draftGroup = z.strictObject({ id: z.uuid(), name: z.string().max(100), values: z.array(draftValue).max(MAX_GROUP_VALUES) });
export const optionDraftSchema = z.strictObject({ schemaVersion: z.literal(1), groups: z.array(draftGroup).max(MAX_OPTION_GROUPS) })
  .superRefine((data, ctx) => {
    if (data.groups.reduce((sum, group) => sum + group.values.length, 0) > MAX_OPTION_VALUES)
      ctx.addIssue({ code: "custom", path: ["groups"], message: "옵션 값은 전체 100개까지 입력할 수 있습니다." });
    const ids = new Set<string>();
    for (const group of data.groups) for (const id of [group.id, ...group.values.map(value => value.id)]) {
      if (ids.has(id)) ctx.addIssue({ code: "custom", path: ["groups"], message: "옵션 ID가 중복되었습니다." });
      ids.add(id);
    }
  });
const confirmedLabel = (max: number) => z.string().trim().min(1).max(max)
  .refine(value => !isOptionPlaceholder(value), "실제 선택 가능한 옵션을 입력해 주세요.");
export const optionGroupsSchema = z.strictObject({ schemaVersion: z.literal(1), groups: z.array(z.strictObject({
  id: z.uuid(), name: z.string().trim().min(1).max(100),
  values: z.array(z.strictObject({ id: z.uuid(), label: confirmedLabel(200) })).min(1).max(MAX_GROUP_VALUES),
})).max(MAX_OPTION_GROUPS) }).superRefine((data, ctx) => {
  const bounds = optionDraftSchema.safeParse(data);
  if (!bounds.success) for (const issue of bounds.error.issues) ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
  const names = new Set<string>();
  data.groups.forEach((group, index) => {
    const name = comparison(group.name);
    if (names.has(name)) ctx.addIssue({ code: "custom", path: ["groups", index, "name"], message: "옵션 그룹 이름이 중복되었습니다." });
    names.add(name);
    const labels = new Set<string>();
    group.values.forEach((value, valueIndex) => {
      const label = comparison(value.label);
      if (labels.has(label)) ctx.addIssue({ code: "custom", path: ["groups", index, "values", valueIndex, "label"], message: "같은 그룹의 옵션 값이 중복되었습니다." });
      labels.add(label);
    });
  });
});
export type OptionGroups = z.infer<typeof optionGroupsSchema>;
export type OptionGroup = OptionGroups["groups"][number];

export function normalizeOptionDraft(input: unknown) {
  const raw = optionDraftSchema.parse(input);
  const groups = raw.groups.filter(group => group.name.trim() || group.values.some(value => value.label.trim()))
    .map(group => ({ ...group, name: group.name.trim(), values: group.values
      .filter(value => value.label.trim() && !isOptionPlaceholder(value.label))
      .map(value => ({ ...value, label: value.label.trim() })) }));
  // A named group with no real choice is an error, not silent deletion.
  const confirmed = optionGroupsSchema.parse({ schemaVersion: 1, groups });
  return { confirmed, sourceSnapshot: { inputMethod: "manual" as const, ...raw } };
}

// Future Adapter candidate only: no IDs, no confirmation and no slash splitting.
export const optionCandidateSchema = z.array(z.strictObject({ name: z.string().max(100), values: z.array(z.string().max(200)).max(MAX_GROUP_VALUES) }))
  .max(MAX_OPTION_GROUPS).refine(groups => groups.reduce((sum, group) => sum + group.values.length, 0) <= MAX_OPTION_VALUES);
export const importedOptionSourceSchema = z.strictObject({
  inputMethod: z.literal("domeme_api"), schemaVersion: z.literal(1), supplier: z.literal("domeme"),
  productNo: z.string().regex(/^[1-9]\d{0,14}$/), sourceUrl: z.url().max(2048),
  apiVersion: z.literal("4.6"), fetchedAt: z.iso.datetime(), fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  groups: optionCandidateSchema,
  // Keep bounded tombstones as well: deleting a confirmed value must not resurrect it on import.
  bindings: z.array(z.strictObject({ name: z.string().max(100), id: z.uuid(),
    values: z.array(z.strictObject({ label: z.string().max(200), id: z.uuid() })).max(200),
  })).max(20).refine(groups => groups.reduce((sum, group) => sum + group.values.length, 0) <= 200),
});
export type ImportedOptionSource = z.infer<typeof importedOptionSourceSchema>;
export const optionSourceSchema = z.union([
  importedOptionSourceSchema,
  z.strictObject({ inputMethod: z.literal("manual"), schemaVersion: z.literal(1), groups: optionDraftSchema.shape.groups }),
  z.strictObject({ inputMethod: z.literal("wholesale_url"), sourceUrl: z.url().max(2048), groups: optionCandidateSchema }),
  z.strictObject({}),
]);
export const optionRowSchema = z.object({ id: z.uuid(), product_id: z.uuid(), groups: optionGroupsSchema,
  source_snapshot: optionSourceSchema, version: z.number().int().positive().max(2147483647),
  created_at: z.iso.datetime({ offset: true }), updated_at: z.iso.datetime({ offset: true }) });
export const optionViewSchema = z.strictObject({ productId: z.uuid().nullable(), id: z.uuid().nullable(),
  version: z.number().int().nonnegative(), options: optionGroupsSchema, updatedAt: z.iso.datetime({ offset: true }).nullable() });
export type OptionView = z.infer<typeof optionViewSchema>;
export const optionSaveSchema = z.strictObject({ productId: z.uuid(), expectedVersion: z.number().int().min(0).max(2147483646), options: optionDraftSchema,
  importToken: z.string().max(128).optional() });
export function emptyOptionView(productId: string | null): OptionView {
  return { productId, id: null, version: 0, options: { schemaVersion: 1, groups: [] }, updatedAt: null };
}
