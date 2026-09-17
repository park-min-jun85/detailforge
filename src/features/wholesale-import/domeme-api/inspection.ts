import "server-only";
import { z } from "zod";
import { optionGroupsSchema } from "@/features/product-options/schemas";
import { DomemeApiError } from "./errors";

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const typeOf = (value: unknown) => value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
const boundedText = z.string().min(1).max(200);
const setSchema = z.array(z.object({ name: boundedText, opts: z.array(boundedText).min(1).max(100) })).min(1).max(20);
const flag = (value: unknown) => {
  const number = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
};
export type OptionStatus = "confirmed_none" | "unverified" | "invalid_json" | "unsupported" | "combination_restricted" | "simple_groups";
type Group = { name: string; values: string[] };
type Combination = { key: string; sup: number | null; hid: number | null; stock: "positive" | "zero" | "unknown" };
export type OptionInspection = {
  status: OptionStatus; present: boolean; fieldType: string; jsonParseable: boolean | null;
  structure: { type: string; setType: string; dataType: string; recognizedFields: string[]; unknownFieldCount: number } | null;
  groups?: Group[]; combinations?: Combination[]; reasons: string[];
};

export function inspectSelectOpt(present: boolean, value: unknown): OptionInspection {
  const base: OptionInspection = { status: "unverified", present, fieldType: present ? typeOf(value) : "missing", jsonParseable: null, structure: null, reasons: [] };
  if (!present) return { ...base, reasons: ["selectOpt 필드 누락: 옵션 없음으로 확정하지 않습니다."] };
  // Public docs show null, but do not define it as an authoritative no-options marker.
  if (value === null || value === "") return { ...base, reasons: ["null/빈 값의 옵션 없음 의미가 명세로 확정되지 않았습니다."] };
  const fromString = typeof value === "string";
  let parsed: unknown = value;
  if (fromString) {
    try { parsed = JSON.parse(value); } catch { return { ...base, status: "invalid_json", jsonParseable: false, reasons: ["selectOpt JSON 파싱 실패"] }; }
  }
  const opt = record(parsed);
  if (!opt) return { ...base, status: "unsupported", jsonParseable: fromString ? true : null, reasons: ["옵션 객체 구조가 아닙니다."] };
  const knownFields = ["type", "optSort", "set", "orgSet", "data"];
  const structure = { type: typeof opt.type === "string" && opt.type.length <= 40 ? opt.type : "unrecognized", setType: typeOf(opt.set), dataType: typeOf(opt.data),
    recognizedFields: knownFields.filter(key => Object.hasOwn(opt, key)), unknownFieldCount: Object.keys(opt).filter(key => !knownFields.includes(key)).length };
  const result = { ...base, jsonParseable: fromString ? true : null, structure };
  const sets = setSchema.safeParse(opt.set);
  if (!sets.success) return { ...result, status: "unsupported", reasons: ["명세의 set/name/opts 구조 또는 진단 상한과 일치하지 않습니다."] };
  const groups = sets.data.map(group => ({ name: group.name, values: group.opts }));
  // Only identity mappings are understood. Do not guess how supplier remapping works.
  const rawSets = opt.set as Record<string, unknown>[];
  const remapped = rawSets.some((group, i) => group.changeKey !== undefined && (!Array.isArray(group.changeKey)
    || group.changeKey.length !== groups[i].values.length || group.changeKey.some((key, index) => flag(key) !== index)));
  const originals = opt.orgSet === undefined || (Array.isArray(opt.orgSet) && opt.orgSet.length === 0) ? null : setSchema.safeParse(opt.orgSet);
  const changedOriginal = originals && (!originals.success || JSON.stringify(originals.data.map(group => ({ name: group.name, values: group.opts }))) !== JSON.stringify(groups));
  if (remapped || changedOriginal || structure.unknownFieldCount > 0)
    return { ...result, groups, status: "unsupported", reasons: ["미지원 재매핑 또는 추가 구조입니다. 원본 그룹과 조합을 추측해 연결하지 않습니다."] };
  if (!fromString) return { ...result, groups, status: "unsupported", reasons: ["명세와 달리 selectOpt가 JSON 문자열이 아닙니다. 구조 확인만 하며 변환하지 않습니다."] };
  if (opt.type !== "combination") return { ...result, groups, status: "unsupported", reasons: ["확인되지 않은 옵션 type입니다. 독립형으로 추측하지 않습니다."] };
  const data = record(opt.data);
  if (!data || Object.keys(data).length > 1000) return { ...result, groups, status: "unsupported", reasons: ["data 조합 구조 또는 진단 상한과 일치하지 않습니다."] };
  const combinations: Combination[] = [];
  let malformed = false, unknownState = false, restricted = false;
  for (const [key, value] of Object.entries(data)) {
    const row = record(value), indexes = key.split("_");
    if (!row || indexes.length !== groups.length || indexes.some((index, i) => !/^\d{2}$/.test(index) || Number(index) >= groups[i].values.length)) { malformed = true; continue; }
    const sup = flag(row.sup), hid = flag(row.hid), qty = flag(row.qty);
    const stock = qty === null ? "unknown" : qty > 0 ? "positive" : "zero";
    combinations.push({ key, sup, hid, stock });
    if (sup === null || hid === null || ![0, 1, 2].includes(hid) || qty === null) unknownState = true;
    if ((sup !== null && sup !== 1) || hid === 1 || hid === 2 || qty === 0) restricted = true;
  }
  if (malformed || unknownState) return { ...result, groups, combinations, status: "unsupported", reasons: ["조합 키 또는 상태값이 누락/미지원입니다. 의미를 추측하지 않습니다."] };
  const expected = groups.reduce((total, group) => total * group.values.length, 1);
  if (combinations.length !== expected) restricted = true;
  if (restricted) return { ...result, groups, combinations, status: "combination_restricted", reasons: ["일부 조합 누락·도매매 비노출·판매 종료·숨김·재고 없음: 독립 그룹으로 반영할 수 없습니다."] };
  // Validate model compatibility without allocating or returning confirmed UUIDs/options.
  let id = 0;
  const syntheticId = () => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}`;
  const compatible = optionGroupsSchema.safeParse({ schemaVersion: 1, groups: groups.map(group => ({
    id: syntheticId(), name: group.name, values: group.values.map(label => ({ id: syntheticId(), label })),
  })) });
  if (!compatible.success) return { ...result, groups, combinations, status: "unsupported", reasons: ["현재 Options의 상한·중복·placeholder 규칙에 맞지 않습니다. 값을 삭제하거나 합치지 않습니다."] };
  return { ...result, groups, combinations, status: "simple_groups", reasons: ["조회 시점의 전체 조합이 일치합니다. 가격/재고 모델 변환이나 향후 구매 가능 보장은 아닙니다."] };
}

function rejectApiError(value: unknown) {
  const error = record(value);
  if (!error || !("code" in error)) return;
  const code = String(error.code);
  if (["20", "401"].includes(code)) throw new DomemeApiError("authentication");
  if (code === "403") throw new DomemeApiError("forbidden");
  if (code === "429") throw new DomemeApiError("rate_limited");
  throw new DomemeApiError("api_error");
}
export function inspectProductResponse(payload: unknown, productNo: string) {
  const root = record(payload);
  if (!root) throw new DomemeApiError("invalid_response");
  rejectApiError(root);
  const item = record(root.domeggook);
  rejectApiError(item);
  // Error containers are checked conservatively; no upstream text is returned.
  for (const container of [root.errors, item?.errors]) {
    if (container === undefined || container === null) continue;
    if (Array.isArray(container)) {
      for (const error of container) rejectApiError(error);
      if (container.length > 0) throw new DomemeApiError("api_error");
    } else {
      rejectApiError(container);
      // Unknown nonempty error shapes must not become successful option results.
      if (container !== "" && (!record(container) || Object.keys(container).length > 0)) throw new DomemeApiError("api_error");
    }
  }
  const basis = record(item?.basis);
  if (!item || !basis || !("no" in basis)) throw new DomemeApiError("invalid_response");
  if (String(basis.no) !== productNo) throw new DomemeApiError("product_mismatch");
  return { productNo, wrapper: "domeggook", productNoPath: "domeggook.basis.no", selectOptPath: "domeggook.selectOpt",
    options: inspectSelectOpt(Object.hasOwn(item, "selectOpt"), item.selectOpt) };
}
