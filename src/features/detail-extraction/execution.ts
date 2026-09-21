import "server-only";
import { ExtractionError } from "./errors";

// Full analysis and explicit retry share the existing process-wide one-run budget.
let running = false;
export async function withExtractionSlot<T>(operation: () => Promise<T>): Promise<T> {
  if (running) throw new ExtractionError("busy");
  running = true;
  try { return await operation(); } finally { running = false; }
}
