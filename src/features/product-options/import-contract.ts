import { z } from "zod";
import { optionCandidateSchema, optionGroupsSchema } from "./schemas";

export function domemeProductNumber(sourceUrl: string | null | undefined): string | null {
  try {
    if (!sourceUrl || sourceUrl.length > 2048 || sourceUrl !== sourceUrl.trim() || sourceUrl.includes("\\")) return null;
    const url = new URL(sourceUrl);
    if (url.protocol !== "https:" || url.hostname !== "domeme.domeggook.com" || url.port || url.username || url.password || url.search || url.hash) return null;
    return /^\/s\/([1-9]\d{0,14})\/?$/.exec(url.pathname)?.[1] ?? null;
  } catch { return null; }
}
export const candidateStatusLabels = {
  simple_groups: "현재 모델로 반영 가능", combination_restricted: "조합·판매 상태 제한으로 반영 불가",
  unverified: "옵션 확인 불가", unsupported: "미지원 응답 구조", invalid_json: "미지원 응답 구조 (JSON 오류)", confirmed_none: "명세상 옵션 없음",
} as const;
export const additionSchema = z.strictObject({ id: z.uuid(), groupId: z.uuid(), groupName: z.string().max(100), label: z.string().max(200),
  action: z.enum(["add", "keep", "deleted", "manual_duplicate", "ambiguous"]), detail: z.string().max(300) });
export type OptionAddition = z.infer<typeof additionSchema>;
export const optionPreviewSchema = z.strictObject({ token: z.string().max(128).nullable(), status: z.enum(Object.keys(candidateStatusLabels) as [keyof typeof candidateStatusLabels, ...Array<keyof typeof candidateStatusLabels>]),
  productId: z.uuid(), productNo: z.string(), sourceUrl: z.string().max(2048), fetchedAt: z.iso.datetime(), expiresAt: z.iso.datetime(),
  expectedVersion: z.number().int().nonnegative(), groups: optionCandidateSchema.nullable(), previous: optionCandidateSchema.nullable(), current: optionGroupsSchema,
  additions: z.array(additionSchema).max(100), notes: z.array(z.string().max(500)).max(30),
});
export type OptionPreview = z.infer<typeof optionPreviewSchema>;
export const optionApplySchema = z.strictObject({ productId: z.uuid(), expectedVersion: z.number().int().nonnegative(), token: z.string().max(128), selectedIds: z.array(z.uuid()).max(100) });
export const optionLookupSchema = z.strictObject({ productId: z.uuid(), expectedVersion: z.number().int().nonnegative() });
export const optionApplyResultSchema = z.strictObject({ options: optionGroupsSchema, importToken: z.string().max(128) });
