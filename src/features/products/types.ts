import type { ProductInput } from "./schemas";

export type ProductSaveState = {
  status: "idle" | "success" | "error" | "recovery-required";
  message?: string;
  fieldErrors?: Record<string, string>;
  revision?: string;
  values?: ProductInput;
};