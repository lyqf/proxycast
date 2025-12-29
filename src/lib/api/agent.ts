import { invoke } from "@tauri-apps/api/core";

/**
 * Agent 进程状态
 */
export interface AgentProcessStatus {
  running: boolean;
  base_url?: string;
  port?: number;
}

/**
 * 创建会话响应
 */
export interface CreateSessionResponse {
  session_id: string;
  credential_name: string;
  credential_uuid: string;
  provider_type: string;
  model?: string;
}

/**
 * 会话信息
 */
export interface SessionInfo {
  session_id: string;
  provider_type: string;
  model?: string;
  created_at: string;
  last_activity: string;
  messages_count: number;
}

/**
 * 图片输入
 */
export interface ImageInput {
  data: string; // base64 encoded image data
  media_type: string; // e.g., "image/png"
}

/**
 * 启动 Agent 进程
 */
export async function startAgentProcess(
  asterBinaryPath?: string,
  port?: number,
  credentialsEndpoint?: string,
): Promise<AgentProcessStatus> {
  return await invoke("agent_start_process", {
    asterBinaryPath,
    port,
    credentialsEndpoint,
  });
}

/**
 * 停止 Agent 进程
 */
export async function stopAgentProcess(): Promise<void> {
  return await invoke("agent_stop_process");
}

/**
 * 获取 Agent 进程状态
 */
export async function getAgentProcessStatus(): Promise<AgentProcessStatus> {
  return await invoke("agent_get_process_status");
}

/**
 * 创建 Agent 会话
 */
export async function createAgentSession(
  providerType: string,
  model?: string,
): Promise<CreateSessionResponse> {
  return await invoke("agent_create_session", {
    providerType,
    model,
  });
}

/**
 * 发送消息到 Agent（使用同步 chat API）
 */
export async function sendAgentMessage(
  message: string,
  model?: string,
  images?: ImageInput[],
): Promise<string> {
  return await invoke("agent_send_message", {
    message,
    images,
    model,
  });
}

/**
 * 获取会话列表
 */
export async function listAgentSessions(): Promise<SessionInfo[]> {
  return await invoke("agent_list_sessions");
}

/**
 * 获取会话详情
 */
export async function getAgentSession(sessionId: string): Promise<SessionInfo> {
  return await invoke("agent_get_session", {
    sessionId,
  });
}

/**
 * 删除会话
 */
export async function deleteAgentSession(sessionId: string): Promise<void> {
  return await invoke("agent_delete_session", {
    sessionId,
  });
}
