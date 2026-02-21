import { safeInvoke } from "@/lib/dev-bridge";

export type AgentRunSource = "chat" | "skill" | "heartbeat";

export type AgentRunStatus =
  | "queued"
  | "running"
  | "success"
  | "error"
  | "canceled"
  | "timeout";

export interface AgentRun {
  id: string;
  source: AgentRunSource;
  source_ref: string | null;
  session_id: string | null;
  status: AgentRunStatus;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  error_code: string | null;
  error_message: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

export async function executionRunList(
  limit: number = 50,
  offset: number = 0,
): Promise<AgentRun[]> {
  return await safeInvoke("execution_run_list", { limit, offset });
}

export async function executionRunGet(
  runId: string,
): Promise<AgentRun | null> {
  return await safeInvoke("execution_run_get", { runId });
}
