import "server-only";
import { extractCandidate } from "../extractor";
import type { ImportAdapter } from "./types";
export const genericAdapter: ImportAdapter = { id:"generic",matches:()=>true,extract:extractCandidate };
// Register future site-specific adapters before the generic fallback.
export function resolveAdapter(url: URL): ImportAdapter { return [genericAdapter].find(adapter=>adapter.matches(url))!; }
