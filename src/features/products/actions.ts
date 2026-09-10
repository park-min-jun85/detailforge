"use server";

import { revalidatePath } from "next/cache";
import { readProductFormData } from "./mappers";
import { saveProductInformation } from "./persistence";
import type { ProductSaveState } from "./types";

export async function saveProductAction(
  projectId: string, _previous: ProductSaveState, formData: FormData,
): Promise<ProductSaveState> {
  const result = await saveProductInformation(projectId, formData.get("revision"), readProductFormData(formData));
  // 성공과 보상 복구 모두 서버 화면의 오래된 데이터를 무효화한다.
  if (result.status === "success" || result.revision !== undefined || result.status === "recovery-required") {
    revalidatePath(`/projects/${projectId}`);
  }
  return result;
}