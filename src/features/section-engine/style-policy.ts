import { z } from "zod";
import type { GeneratedSection, sectionStyleSchema } from "./schemas";

type Style = z.infer<typeof sectionStyleSchema>;
export function styleChoiceAllowed(type: GeneratedSection["type"], key: keyof Style, value: string, hasAssets: boolean) {
  if (key === "layout" && ["specification", "option", "notice"].includes(type)) return value === "stack" || value === "centered";
  if (key === "imageFit" && !hasAssets) return value === "contain";
  return true;
}
// Legacy saved combinations remain readable and can be retained during a text edit.
export function validateStyleChange(content: GeneratedSection, next: Style, previous?: Style) {
  for (const key of ["layout", "imageFit"] as const) {
    if (next[key] !== previous?.[key] && !styleChoiceAllowed(content.type, key, next[key], content.assetIds.length > 0)) {
      throw new z.ZodError([{ code: "custom", path: ["style", key], message: "이 섹션에서 사용할 수 없는 스타일 조합입니다." }]);
    }
  }
}
