import { z } from "zod";
import { optionGroupsSchema } from "./schemas";

const fingerprint = z.string().regex(/^[a-f0-9]{64}$/);
export const confirmedOptionsSchema = z.strictObject({
  schemaVersion: z.literal(1), policyVersion: z.literal(1), productId: z.uuid(), rowId: z.uuid().nullable(),
  version: z.number().int().nonnegative(), state: z.enum(["present", "empty", "missing"]),
  groups: optionGroupsSchema.shape.groups, fingerprint,
}).superRefine((value, ctx) => {
  if (value.state !== (value.rowId === null ? "missing" : value.groups.length ? "present" : "empty")
    || (value.rowId === null ? value.version !== 0 || value.groups.length > 0 : value.version < 1))
    ctx.addIssue({ code: "custom", message: "Invalid confirmed options source" });
});
export type ConfirmedOptions = z.infer<typeof confirmedOptionsSchema>;
export const optionSnapshotSchema = z.strictObject({
  source: z.literal("confirmed_options"), appliedAt: z.iso.datetime({ offset: true }), confirmed: confirmedOptionsSchema,
}).refine(value => value.confirmed.rowId !== null, "A saved options row is required");
export type OptionSnapshot = z.infer<typeof optionSnapshotSchema>;
export type OptionFreshness = "current" | "stale" | "unlinked" | "missing" | "unavailable" | "invalid";
export function optionFreshness(snapshot: OptionSnapshot | undefined, current: ConfirmedOptions): OptionFreshness {
  if (!snapshot) return "unlinked";
  if (current.state === "missing") return "missing";
  return snapshot.confirmed.productId === current.productId && snapshot.confirmed.fingerprint === current.fingerprint ? "current" : "stale";
}
export const OPTION_FRESHNESS_LABELS: Record<OptionFreshness, string> = {
  current: "저장된 옵션과 현재 상품 옵션이 일치합니다.", stale: "상품 옵션이 변경되었습니다. 최신 옵션 반영을 확인해 주세요.",
  unlinked: "옵션 연결 확인 필요", missing: "저장된 상품 옵션이 없습니다. 옵션 화면에서 먼저 저장해 주세요.",
  unavailable: "상품 옵션을 조회하지 못했습니다. 최신 여부를 확인할 수 없습니다.", invalid: "저장된 상품 옵션 형식을 확인할 수 없습니다.",
};
