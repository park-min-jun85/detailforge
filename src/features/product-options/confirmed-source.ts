import "server-only";
import { validationFingerprint } from "@/features/fact-validation/evidence";
import { confirmedOptionsSchema, type ConfirmedOptions } from "./section-snapshot";
import type { OptionView } from "./schemas";

export function confirmedOptionsFingerprint(value: Pick<ConfirmedOptions, "rowId" | "groups">) {
  return validationFingerprint({ schemaVersion: 1, policyVersion: 1, rowId: value.rowId, groups: value.groups });
}
export function confirmedSource(view: OptionView): ConfirmedOptions {
  return confirmedOptionsSchema.parse({ schemaVersion: 1, policyVersion: 1, productId: view.productId,
    rowId: view.id, version: view.version, state: view.id === null ? "missing" : view.options.groups.length ? "present" : "empty",
    groups: view.options.groups, fingerprint: confirmedOptionsFingerprint({ rowId: view.id, groups: view.options.groups }) });
}
