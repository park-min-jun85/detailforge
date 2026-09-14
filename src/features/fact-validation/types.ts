import type { TargetFact, ValidationEvidence, ValidationState } from "./schemas";
export type ValidationInput = { targets: TargetFact[]; evidence: ValidationEvidence[]; coverage: { total: number; completed: number; invalid: number }; warnings: string[] };
export type ValidationProvider = { readonly model: string; analyze(input: ValidationInput, signal: AbortSignal): Promise<unknown> };
export type ValidationView = ValidationInput & { projectId: string; projectName: string; productName: string; inputFingerprint: string; state: ValidationState | null };
