import "server-only";
import { randomUUID } from "node:crypto";
import { importedOptionSourceSchema, optionGroupsSchema, type ImportedOptionSource, type OptionGroups } from "./schemas";
import type { OptionAddition } from "./import-contract";
import { OptionError } from "./errors";

const comparable = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
type RawGroups = ImportedOptionSource["groups"];
export function compareImportedOptions(current: OptionGroups, previous: ImportedOptionSource | null, incoming: RawGroups) {
  const additions: OptionAddition[] = [], notes: string[] = [];
  const lostGroup = previous?.bindings.some(group => !incoming.some(item => item.name === group.name));
  for (const group of incoming) {
    const binding = previous?.bindings.find(item => item.name === group.name);
    const local = binding ? current.groups.find(item => item.id === binding.id) : undefined;
    const duplicate = !binding && current.groups.some(item => comparable(item.name) === comparable(group.name));
    const groupId = binding?.id ?? randomUUID();
    const lostValue = binding?.values.some(value => !group.values.includes(value.label));
    for (const label of group.values) {
      const mapped = binding?.values.find(value => value.label === label);
      const id = mapped?.id ?? randomUUID();
      let action: OptionAddition["action"] = "add", detail = "선택하면 새 값으로 추가합니다.";
      if ((binding && !local) || (mapped && !local?.values.some(value => value.id === mapped.id))) {
        action = "deleted"; detail = "사용자가 삭제한 항목입니다. 자동 복구하지 않습니다.";
      } else if (mapped) {
        action = "keep"; detail = "기존 UUID와 현재 표시값을 유지합니다.";
      } else if (duplicate || local?.values.some(value => comparable(value.label) === comparable(label))) {
        action = "manual_duplicate"; detail = "수동 값과 중복됩니다. 출처를 자동 연결하지 않습니다. 수동 확인이 필요합니다.";
      } else if ((!binding && lostGroup) || lostValue) {
        action = "ambiguous"; detail = "공급처 이름 변경인지 새 항목인지 불명확합니다. 자동 매칭하지 않습니다.";
      }
      additions.push({ id, groupId, groupName: group.name, label, action, detail });
    }
  }
  if (lostGroup || previous?.bindings.some(group => group.values.some(value => !incoming.find(item => item.name === group.name)?.values.includes(value.label))))
    notes.push("공급처에서 사라진 항목도 현재 입력에서 자동 삭제하지 않습니다. 이전 원본과 현재 값을 비교해 주세요.");
  return { additions, notes };
}

export function applyImportedAdditions(current: OptionGroups, previous: ImportedOptionSource | null, source: Omit<ImportedOptionSource, "bindings">, additions: OptionAddition[], selectedIds: string[]) {
  if (new Set(selectedIds).size !== selectedIds.length || selectedIds.some(id => !additions.some(item => item.id === id && item.action === "add"))) throw new OptionError("invalid_input");
  const options = structuredClone(current);
  const bindings = structuredClone(previous?.bindings ?? []);
  // Only append explicitly selected additions. Never change existing labels, IDs, order or tombstones.
  for (const item of additions.filter(item => selectedIds.includes(item.id))) {
    let group = options.groups.find(group => group.id === item.groupId);
    if (!group) { group = { id: item.groupId, name: item.groupName, values: [] }; options.groups.push(group); }
    group.values.push({ id: item.id, label: item.label });
    let binding = bindings.find(group => group.id === item.groupId);
    if (!binding) { binding = { id: item.groupId, name: item.groupName, values: [] }; bindings.push(binding); }
    binding.values.push({ id: item.id, label: item.label });
  }
  try { return { options: optionGroupsSchema.parse(options), source: importedOptionSourceSchema.parse({ ...source, bindings }) }; }
  catch { throw new OptionError("invalid_input"); }
}
