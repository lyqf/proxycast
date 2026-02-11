/**
 * Agent Chat Hook 统一导出
 *
 * 根据配置自动选择 Native 或 Aster 后端
 */

import { useAgentChat } from "./useAgentChat";
import { useAsterAgentChat } from "./useAsterAgentChat";
import { getAgentBackend } from "../config";

export type { Topic } from "./useAgentChat";

/** Hook 配置选项 */
interface UseAgentChatUnifiedOptions {
  systemPrompt?: string;
  onWriteFile?: (content: string, fileName: string) => void;
  workspaceId: string;
}

/**
 * 统一的 Agent Chat Hook
 *
 * 根据 localStorage 配置自动选择后端：
 * - "native": 使用原有的 Native Agent 后端
 * - "aster": 使用新的 Aster Agent 后端
 *
 * 切换方式：
 * localStorage.setItem("proxycast_agent_backend", "aster")
 */
export function useAgentChatUnified(options: UseAgentChatUnifiedOptions) {
  const backend = getAgentBackend();

  // 根据配置选择 hook
  // 注意：React hooks 规则要求 hooks 调用顺序一致
  // 这里我们总是调用两个 hook，但只使用其中一个的结果
  const nativeResult = useAgentChat(options);
  const asterResult = useAsterAgentChat(options);

  if (backend === "aster") {
    console.log("[AgentChat] 使用 Aster 后端");
    return asterResult;
  }

  console.log("[AgentChat] 使用 Native 后端");
  return nativeResult;
}

// 重新导出原有 hooks，便于直接使用
export { useAgentChat } from "./useAgentChat";
export { useAsterAgentChat } from "./useAsterAgentChat";
