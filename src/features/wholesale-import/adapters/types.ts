import type { ImportCandidate } from "../schemas";
export type ImportAdapter = { id: string; matches: (url: URL) => boolean; extract: (html: string,url: string,rendered?: boolean) => ImportCandidate };
