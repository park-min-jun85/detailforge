import { z } from "zod";
import { sectionRowSchema, sectionStyleSchema, storedContentSchema } from "@/features/section-engine/schemas";
import { applyTextFields, textFields } from "./fields";

export const editRequestSchema = z.strictObject({ revision: z.iso.datetime({ offset: true }),
  fields: z.record(z.string().max(60), z.string().max(700).nullable()),
  assetIds: z.array(z.uuid()).max(8).refine(ids => new Set(ids).size === ids.length), style: sectionStyleSchema });
export const editorSectionSchema = sectionRowSchema.extend({ content: storedContentSchema, style: sectionStyleSchema }).refine(row => row.type === row.content.type);
export type EditorSection = z.infer<typeof editorSectionSchema>;
export type EditDraft = Omit<z.infer<typeof editRequestSchema>, "revision">;
export function draftOf(section: EditorSection): EditDraft {
  return { fields: Object.fromEntries(textFields(section.content).map(field => [field.path, field.value])), assetIds: [...section.content.assetIds], style: { ...section.style } };
}
export function editableFieldsSchema(section: EditorSection) {
  return z.strictObject(Object.fromEntries(textFields(section.content).map(field => {
    const value = z.string().min(1).max(field.max).refine(text => !/\/storage\/v1\/object\/sign\/|[?&]token=|<\/?[a-z][^>]*>/i.test(text), "일반 문구만 입력해 주세요.");
    return [field.path, field.nullable ? value.nullable() : value];
  })));
}
export function previewContent(section: EditorSection, draft: EditDraft) {
  const content = { ...applyTextFields(section.content, draft.fields), assetIds: draft.assetIds };
  // A deselected image must also disappear from use-case item associations.
  // Evidence/confidence stay untouched; new images are Section-level manual choices.
  if (content.type === "useCase") content.items = content.items.map(item => ({ ...item, assetIds: item.assetIds.filter(id => draft.assetIds.includes(id)) }));
  return content;
}
export function prepareEdit(section: EditorSection, input: unknown, now: string) {
  const request = editRequestSchema.parse(input);
  const fields = editableFieldsSchema(section).parse(request.fields);
  const old = draftOf(section);
  const textChanged = Object.keys(old.fields).some(key => old.fields[key] !== fields[key]);
  const assetsChanged = JSON.stringify(old.assetIds) !== JSON.stringify(request.assetIds);
  const content = previewContent(section, { ...request, fields });
  if (textChanged || assetsChanged) content.meta = { ...content.meta, manualEdit: { edited: true, editedAt: now,
    textEdited: textChanged || !!content.meta.manualEdit?.textEdited, assetsEdited: assetsChanged || !!content.meta.manualEdit?.assetsEdited },
    ...(textChanged ? { groundingStatus: "needs_review" as const } : {}) };
  return { content: storedContentSchema.parse(content), style: request.style, revision: request.revision };
}
export function isDirty(section: EditorSection, draft: EditDraft) { return JSON.stringify(draftOf(section)) !== JSON.stringify(draft); }
