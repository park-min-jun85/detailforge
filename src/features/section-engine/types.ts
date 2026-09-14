import type { LatestPlan } from "@/features/page-planner/schemas";
import type { PlannerView } from "@/features/page-planner/types";
import type { GenerationState, SectionRow } from "./schemas";
export type SectionInput = Pick<LatestPlan, "plan" | "evidenceSnapshot" | "strategySnapshot"> & {
  validation: { supported: string[]; restricted: { factId: string; status: string }[] };
};
export type SectionProvider = { readonly model: string; generate(input: SectionInput, signal: AbortSignal): Promise<unknown> };
export type SectionView = { projectId: string; projectName: string; productName: string; detailPageId: string | null;
  planReady: boolean; sourcePlanFingerprint: string | null; planSectionCount: number; sections: SectionRow[]; stale: boolean;
  generation: Pick<GenerationState, "status" | "startedAt" | "finishedAt" | "errorCode"> | null; recoveryNeeded: boolean;
  assets: PlannerView["assets"]; revision: string };
