"use server";

import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { getUserContext } from "@/lib/supabase/user";
import { parseProjectFormData } from "./schemas";
import { createProject } from "./service";
import type { CreateProjectState } from "./types";

export async function createProjectAction(
  _previousState: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  const parsed = parseProjectFormData(formData);
  if (!parsed.success) {
    return { fieldError: parsed.error.issues[0].message };
  }

  // Identity comes from the verified request session, never form data.
  try {
    const { client, principal } = await getUserContext();
    await createProject(principal, parsed.data, client);
  } catch {
    // 응답 유실 시 실제 저장 여부는 불명확할 수 있으므로 무조건 재제출을 유도하지 않는다.
    return { message: "프로젝트 생성 결과를 확인하지 못했습니다. 프로젝트 목록을 확인한 후 다시 시도해 주세요." };
  }

  // redirect는 예외로 제어 흐름을 종료하므로 DB 오류 처리 밖에서 호출한다.
  revalidatePath("/");
  revalidatePath("/projects");
  redirect("/projects?created=1", RedirectType.replace);
}
