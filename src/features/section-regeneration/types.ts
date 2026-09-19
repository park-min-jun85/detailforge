import type { CopyIntent, MessageSection } from "@/features/page-quality/commerce";
import type { EditorSection } from "@/features/detail-editor/schemas";
import type { LatestPlan, PlannerEvidence } from "@/features/page-planner/schemas";
export type RegenerationInput = {
  copyIntent?: CopyIntent;
  otherSections?: MessageSection[];
  target: LatestPlan["plan"]["sections"][number];
  current: Pick<EditorSection, "type" | "content" | "style">;
  heroAssetId: string | null;
  evidence: PlannerEvidence[];
  strategy: LatestPlan["strategySnapshot"];
  validation: { status: "ready"; supported: string[]; restricted: { factId: string; status: string }[] };
};
export type RegenerationProvider = { readonly model: string; generate(input: RegenerationInput, signal: AbortSignal): Promise<unknown> };
