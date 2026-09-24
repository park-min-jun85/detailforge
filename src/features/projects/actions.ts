"use server";

import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseProjectFormData } from "./schemas";
import { createLegacyInternalProject } from "./legacy";
import type { CreateProjectState } from "./types";

export async function createProjectAction(
  _previousState: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  const parsed = parseProjectFormData(formData);
  if (!parsed.success) {
    return { fieldError: parsed.error.issues[0].message };
  }

  // 현재는 single-user/local-development 전용. 공개 배포 전에 Auth/소유권 검증이 필요하다.
  try {
    const client = createSupabaseServerClient();
    await createLegacyInternalProject(parsed.data, client);
  } catch {
    // 응답 유실 시 실제 저장 여부는 불명확할 수 있으므로 무조건 재제출을 유도하지 않는다.
    return { message: "프로젝트 생성 결과를 확인하지 못했습니다. 프로젝트 목록을 확인한 후 다시 시도해 주세요." };
  }

  // redirect는 예외로 제어 흐름을 종료하므로 DB 오류 처리 밖에서 호출한다.
  revalidatePath("/");
  revalidatePath("/projects");
  redirect("/projects?created=1", RedirectType.replace);
}
