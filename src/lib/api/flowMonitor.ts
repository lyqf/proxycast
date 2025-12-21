/**
 * LLM Flow Monitor API
 *
 * 提供与 Tauri 后端 Flow Monitor 服务交互的 TypeScript 接口。
 * 支持 Flow 查询、搜索、统计、导出和标注管理。
 */

import { invoke } from "@tauri-apps/api/core";

// ============================================================================
// Provider 类型
// ============================================================================

/**
 * 提供商类型
 */
export type ProviderType =
  | "Kiro"
  | "Gemini"
  | "Qwen"
  | "Antigravity"
  | "OpenAI"
  | "Claude"
  | "Vertex"
  | "GeminiApiKey"
  | "Codex"
  | "ClaudeOAuth"
  | "IFlow";

// ============================================================================
// Flow 类型和状态
// ============================================================================

/**
 * Flow 类型
 */
export type FlowType =
  | "ChatCompletions"
  | "AnthropicMessages"
  | "GeminiGenerateContent"
  | "Embeddings"
  | { Other: string };

/**
 * Flow 状态
 */
export type FlowState =
  | "Pending"
  | "Streaming"
  | "Completed"
  | "Failed"
  | "Cancelled";

/**
 * 消息角色
 */
export type MessageRole = "system" | "user" | "assistant" | "tool" | "function";

/**
 * 停止原因
 */
export type StopReason =
  | "stop"
  | "length"
  | "tool_calls"
  | "content_filter"
  | "function_call"
  | "end_turn"
  | { other: string };

/**
 * 错误类型
 */
export type FlowErrorType =
  | "network"
  | "timeout"
  | "authentication"
  | "rate_limit"
  | "content_filter"
  | "server_error"
  | "bad_request"
  | "model_unavailable"
  | "token_limit_exceeded"
  | "other";

// ============================================================================
// 消息内容类型
// ============================================================================

/**
 * 图片 URL
 */
export interface ImageUrl {
  url: string;
  detail?: string;
}

/**
 * 内容部分（多模态消息）
 */
export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: ImageUrl }
  | { type: "image"; media_type?: string; data?: string; url?: string };

/**
 * 消息内容
 */
export type MessageContent = string | ContentPart[];

/**
 * 工具调用
 */
export interface ToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * 工具结果
 */
export interface ToolResult {
  tool_call_id: string;
  content: string;
  is_error: boolean;
}

/**
 * 消息
 */
export interface Message {
  role: MessageRole;
  content: MessageContent;
  tool_calls?: ToolCall[];
  tool_result?: ToolResult;
  name?: string;
}

// ============================================================================
// 请求和响应类型
// ============================================================================

/**
 * 工具定义
 */
export interface ToolDefinition {
  type: string;
  function: {
    name: string;
    description?: string;
    parameters?: unknown;
  };
}

/**
 * 请求参数
 */
export interface RequestParameters {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stop?: string[];
  stream: boolean;
  [key: string]: unknown;
}

/**
 * LLM 请求
 */
export interface LLMRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
  messages: Message[];
  system_prompt?: string;
  tools?: ToolDefinition[];
  model: string;
  original_model?: string;
  parameters: RequestParameters;
  size_bytes: number;
  timestamp: string;
}

/**
 * 思维链内容
 */
export interface ThinkingContent {
  text: string;
  tokens?: number;
  signature?: string;
}

/**
 * Token 使用统计
 */
export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  thinking_tokens?: number;
  total_tokens: number;
}

/**
 * 流式响应信息
 */
export interface StreamInfo {
  chunk_count: number;
  first_chunk_latency_ms: number;
  avg_chunk_interval_ms: number;
  raw_chunks?: StreamChunk[];
}

/**
 * 流式 Chunk
 */
export interface StreamChunk {
  index: number;
  event?: string;
  data: string;
  timestamp: string;
  content_delta?: string;
  tool_call_delta?: ToolCallDelta;
  thinking_delta?: string;
}

/**
 * 工具调用增量
 */
export interface ToolCallDelta {
  index: number;
  id?: string;
  function_name?: string;
  arguments_delta?: string;
}

/**
 * LLM 响应
 */
export interface LLMResponse {
  status_code: number;
  status_text: string;
  headers: Record<string, string>;
  body: unknown;
  content: string;
  thinking?: ThinkingContent;
  tool_calls: ToolCall[];
  usage: TokenUsage;
  stop_reason?: StopReason;
  size_bytes: number;
  timestamp_start: string;
  timestamp_end: string;
  stream_info?: StreamInfo;
}

// ============================================================================
// 元数据类型
// ============================================================================

/**
 * 客户端信息
 */
export interface ClientInfo {
  ip?: string;
  user_agent?: string;
  request_id?: string;
}

/**
 * 路由信息
 */
export interface RoutingInfo {
  target_url?: string;
  route_rule?: string;
  load_balance_strategy?: string;
}

/**
 * Flow 元数据
 */
export interface FlowMetadata {
  provider: ProviderType;
  credential_id?: string;
  credential_name?: string;
  retry_count: number;
  client_info: ClientInfo;
  routing_info: RoutingInfo;
  injected_params?: Record<string, unknown>;
  context_usage_percentage?: number;
}

/**
 * 时间戳集合
 */
export interface FlowTimestamps {
  created: string;
  request_start: string;
  request_end?: string;
  response_start?: string;
  response_end?: string;
  duration_ms: number;
  ttfb_ms?: number;
}

/**
 * 用户标注
 */
export interface FlowAnnotations {
  marker?: string;
  comment?: string;
  tags: string[];
  starred: boolean;
}

/**
 * Flow 错误
 */
export interface FlowError {
  error_type: FlowErrorType;
  message: string;
  status_code?: number;
  raw_response?: string;
  timestamp: string;
  retryable: boolean;
}

// ============================================================================
// 核心 Flow 类型
// ============================================================================

/**
 * LLM Flow
 */
export interface LLMFlow {
  id: string;
  flow_type: FlowType;
  request: LLMRequest;
  response?: LLMResponse;
  error?: FlowError;
  metadata: FlowMetadata;
  timestamps: FlowTimestamps;
  state: FlowState;
  annotations: FlowAnnotations;
}

// ============================================================================
// 过滤和查询类型
// ============================================================================

/**
 * 时间范围
 */
export interface TimeRange {
  start?: string;
  end?: string;
}

/**
 * Token 范围
 */
export interface TokenRange {
  min?: number;
  max?: number;
}

/**
 * 延迟范围
 */
export interface LatencyRange {
  min_ms?: number;
  max_ms?: number;
}

/**
 * Flow 过滤器
 */
export interface FlowFilter {
  time_range?: TimeRange;
  providers?: ProviderType[];
  models?: string[];
  states?: FlowState[];
  has_error?: boolean;
  has_tool_calls?: boolean;
  has_thinking?: boolean;
  is_streaming?: boolean;
  content_search?: string;
  request_search?: string;
  token_range?: TokenRange;
  latency_range?: LatencyRange;
  tags?: string[];
  starred_only?: boolean;
  credential_id?: string;
  flow_types?: FlowType[];
}

/**
 * 排序字段
 */
export type FlowSortBy =
  | "created_at"
  | "duration"
  | "total_tokens"
  | "content_length"
  | "model";

/**
 * 查询结果
 */
export interface FlowQueryResult {
  flows: LLMFlow[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

/**
 * 搜索结果
 */
export interface FlowSearchResult {
  id: string;
  created_at: string;
  model: string;
  provider: string;
  snippet: string;
  score: number;
}

// ============================================================================
// 统计类型
// ============================================================================

/**
 * 按提供商统计
 */
export interface ProviderStats {
  provider: string;
  count: number;
  success_rate: number;
  avg_latency_ms: number;
}

/**
 * 按模型统计
 */
export interface ModelStats {
  model: string;
  count: number;
  success_rate: number;
  avg_latency_ms: number;
}

/**
 * 按状态统计
 */
export interface StateStats {
  state: string;
  count: number;
}

/**
 * Flow 统计信息
 */
export interface FlowStats {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  success_rate: number;
  avg_latency_ms: number;
  min_latency_ms: number;
  max_latency_ms: number;
  total_input_tokens: number;
  total_output_tokens: number;
  avg_input_tokens: number;
  avg_output_tokens: number;
  by_provider: ProviderStats[];
  by_model: ModelStats[];
  by_state: StateStats[];
}

// ============================================================================
// 导出类型
// ============================================================================

/**
 * 导出格式
 */
export type ExportFormat = "har" | "json" | "jsonl" | "markdown" | "csv";

/**
 * 脱敏规则
 */
export interface RedactionRule {
  name: string;
  pattern: string;
  replacement: string;
  enabled: boolean;
}

/**
 * 导出选项
 */
export interface ExportOptions {
  format: ExportFormat;
  filter?: FlowFilter;
  include_raw?: boolean;
  include_stream_chunks?: boolean;
  redact_sensitive?: boolean;
  redaction_rules?: RedactionRule[];
  compress?: boolean;
}

/**
 * 导出结果
 */
export interface ExportResult {
  data: string;
  filename: string;
  mime_type: string;
}

// ============================================================================
// 标注更新类型
// ============================================================================

/**
 * 标注更新请求
 */
export interface UpdateAnnotationsRequest {
  starred?: boolean;
  marker?: string | null;
  comment?: string | null;
  tags?: string[];
  add_tags?: string[];
  remove_tags?: string[];
}

// ============================================================================
// 实时事件类型
// ============================================================================

/**
 * Flow 摘要（用于事件）
 */
export interface FlowSummary {
  id: string;
  flow_type: FlowType;
  state: FlowState;
  model: string;
  provider: ProviderType;
  created_at: string;
  duration_ms: number;
  input_tokens?: number;
  output_tokens?: number;
  has_error: boolean;
  has_tool_calls: boolean;
  has_thinking: boolean;
  content_preview?: string;
  chunk_count?: number;
}

/**
 * Flow 更新（用于事件）
 */
export interface FlowUpdate {
  state?: FlowState;
  content_delta?: string;
  thinking_delta?: string;
  tool_call_delta?: ToolCallDelta;
  chunk_count?: number;
}

/**
 * Flow 事件
 */
export type FlowEvent =
  | { type: "FlowStarted"; flow: FlowSummary }
  | { type: "FlowUpdated"; id: string; update: FlowUpdate }
  | { type: "FlowCompleted"; id: string; summary: FlowSummary }
  | { type: "FlowFailed"; id: string; error: FlowError };

// ============================================================================
// API 接口
// ============================================================================

/**
 * Flow Monitor API
 *
 * 提供与后端 Flow Monitor 服务交互的所有方法。
 */
export const flowMonitorApi = {
  /**
   * 查询 Flow 列表
   *
   * @param filter - 过滤条件
   * @param sortBy - 排序字段
   * @param sortDesc - 是否降序
   * @param page - 页码（从 1 开始）
   * @param pageSize - 每页大小
   * @returns 查询结果
   */
  async queryFlows(
    filter: FlowFilter = {},
    sortBy: FlowSortBy = "created_at",
    sortDesc: boolean = true,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<FlowQueryResult> {
    // 后端期望一个 request 对象，包含 filter, sort_by, sort_desc, page, page_size
    return invoke("query_flows", {
      request: {
        filter,
        sort_by: sortBy,
        sort_desc: sortDesc,
        page,
        page_size: pageSize,
      },
    });
  },

  /**
   * 获取单个 Flow 的详细信息
   *
   * @param id - Flow ID
   * @returns Flow 详情，如果不存在则返回 null
   */
  async getFlowDetail(id: string): Promise<LLMFlow | null> {
    return invoke("get_flow_detail", { flowId: id });
  },

  /**
   * 全文搜索 Flow
   *
   * @param query - 搜索关键词
   * @param limit - 最大返回数量
   * @returns 搜索结果列表
   */
  async searchFlows(
    query: string,
    limit: number = 50,
  ): Promise<FlowSearchResult[]> {
    return invoke("search_flows", { request: { query, limit } });
  },

  /**
   * 获取 Flow 统计信息
   *
   * @param filter - 过滤条件（可选）
   * @returns 统计信息
   */
  async getFlowStats(filter: FlowFilter = {}): Promise<FlowStats> {
    return invoke("get_flow_stats", { filter });
  },

  /**
   * 导出 Flow
   *
   * @param options - 导出选项
   * @returns 导出结果
   */
  async exportFlows(options: ExportOptions): Promise<ExportResult> {
    // 后端期望 request: ExportFlowsRequest 格式
    return invoke("export_flows", {
      request: {
        format: options.format,
        filter: options.filter,
        include_raw: options.include_raw ?? true,
        include_stream_chunks: options.include_stream_chunks ?? false,
        redact_sensitive: options.redact_sensitive ?? false,
        flow_ids: null,
      },
    });
  },

  /**
   * 更新 Flow 标注
   *
   * @param id - Flow ID
   * @param request - 标注更新请求
   * @returns 更新后的标注
   */
  async updateFlowAnnotations(
    id: string,
    request: UpdateAnnotationsRequest,
  ): Promise<FlowAnnotations> {
    // 后端期望 request: UpdateAnnotationsRequest { flow_id, annotations }
    return invoke("update_flow_annotations", {
      request: {
        flow_id: id,
        annotations: {
          starred: request.starred,
          marker: request.marker,
          comment: request.comment,
          tags: request.tags ?? [],
        },
      },
    });
  },

  /**
   * 清理旧的 Flow 数据
   *
   * @param beforeDays - 清理多少天前的数据
   * @returns 清理的 Flow 数量
   */
  async cleanupFlows(beforeDays: number): Promise<number> {
    // 后端期望 request: CleanupFlowsRequest { retention_days }
    const result = await invoke<{ cleaned_count: number }>("cleanup_flows", {
      request: { retention_days: beforeDays },
    });
    return result.cleaned_count;
  },

  /**
   * 获取最近的 Flow 列表
   *
   * @param limit - 最大返回数量
   * @returns Flow 列表
   */
  async getRecentFlows(limit: number = 20): Promise<LLMFlow[]> {
    return invoke("get_recent_flows", { limit });
  },

  /**
   * 切换 Flow 收藏状态
   *
   * @param id - Flow ID
   * @returns 更新后的收藏状态
   */
  async toggleFlowStar(id: string): Promise<boolean> {
    return invoke("toggle_flow_starred", { flowId: id });
  },

  /**
   * 为 Flow 添加标签
   *
   * @param id - Flow ID
   * @param tags - 要添加的标签
   * @returns 更新后的标签列表
   */
  async addFlowTags(id: string, tags: string[]): Promise<string[]> {
    // 后端 add_flow_tag 只支持单个标签，需要循环调用
    const results: boolean[] = [];
    for (const tag of tags) {
      const result = await invoke<boolean>("add_flow_tag", { flowId: id, tag });
      results.push(result);
    }
    // 返回添加的标签（假设全部成功）
    return tags;
  },

  /**
   * 从 Flow 移除标签
   *
   * @param id - Flow ID
   * @param tags - 要移除的标签
   * @returns 更新后的标签列表
   */
  async removeFlowTags(id: string, tags: string[]): Promise<string[]> {
    // 后端 remove_flow_tag 只支持单个标签，需要循环调用
    for (const tag of tags) {
      await invoke<boolean>("remove_flow_tag", { flowId: id, tag });
    }
    // 返回空数组表示已移除
    return [];
  },

  /**
   * 设置 Flow 评论
   *
   * @param id - Flow ID
   * @param comment - 评论内容，传 null 清除评论
   * @returns 更新后的评论
   */
  async setFlowComment(
    id: string,
    comment: string | null,
  ): Promise<string | null> {
    // 后端是 add_flow_comment，只支持添加评论
    if (comment) {
      await invoke<boolean>("add_flow_comment", { flowId: id, comment });
    }
    return comment;
  },

  /**
   * 设置 Flow 标记
   *
   * @param id - Flow ID
   * @param marker - 标记（如 ⭐、🔴、🟢），传 null 清除标记
   * @returns 更新后的标记
   */
  async setFlowMarker(
    id: string,
    marker: string | null,
  ): Promise<string | null> {
    await invoke<boolean>("set_flow_marker", { flowId: id, marker });
    return marker;
  },

  /**
   * 获取所有可用的标签
   *
   * @returns 标签列表
   */
  async getAllTags(): Promise<string[]> {
    return invoke("get_all_flow_tags");
  },

  /**
   * 批量导出 Flow
   *
   * @param ids - Flow ID 列表
   * @param options - 导出选项
   * @returns 导出结果
   */
  async exportFlowsByIds(
    ids: string[],
    options: Omit<ExportOptions, "filter">,
  ): Promise<ExportResult> {
    return invoke("export_flows_by_ids", { ids, options });
  },

  /**
   * 删除 Flow
   *
   * @param id - Flow ID
   * @returns 是否删除成功
   */
  async deleteFlow(id: string): Promise<boolean> {
    return invoke("delete_flow", { id });
  },

  /**
   * 批量删除 Flow
   *
   * @param ids - Flow ID 列表
   * @returns 删除的数量
   */
  async deleteFlows(ids: string[]): Promise<number> {
    return invoke("delete_flows", { ids });
  },
};

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 格式化 Flow 状态为中文
 */
export function formatFlowState(state: FlowState): string {
  const stateMap: Record<FlowState, string> = {
    Pending: "等待中",
    Streaming: "流式传输中",
    Completed: "已完成",
    Failed: "失败",
    Cancelled: "已取消",
  };
  return stateMap[state] || state;
}

/**
 * 格式化 Flow 类型为中文
 */
export function formatFlowType(flowType: FlowType): string {
  if (typeof flowType === "string") {
    const typeMap: Record<string, string> = {
      ChatCompletions: "聊天补全",
      AnthropicMessages: "Anthropic 消息",
      GeminiGenerateContent: "Gemini 生成",
      Embeddings: "嵌入",
    };
    return typeMap[flowType] || flowType;
  }
  return flowType.Other;
}

/**
 * 格式化错误类型为中文
 */
export function formatErrorType(errorType: FlowErrorType): string {
  const errorMap: Record<FlowErrorType, string> = {
    network: "网络错误",
    timeout: "超时",
    authentication: "认证错误",
    rate_limit: "速率限制",
    content_filter: "内容过滤",
    server_error: "服务器错误",
    bad_request: "请求错误",
    model_unavailable: "模型不可用",
    token_limit_exceeded: "Token 限制超出",
    other: "其他错误",
  };
  return errorMap[errorType] || errorType;
}

/**
 * 格式化 Token 数量
 */
export function formatTokenCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

/**
 * 格式化延迟时间
 */
export function formatLatency(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${ms}ms`;
}

/**
 * 格式化字节大小
 */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${bytes} B`;
}

/**
 * 获取消息内容的纯文本
 */
export function getMessageText(content: MessageContent): string {
  if (typeof content === "string") {
    return content;
  }
  return content
    .filter(
      (part): part is { type: "text"; text: string } => part.type === "text",
    )
    .map((part) => part.text)
    .join("\n");
}

/**
 * 截断文本
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * 创建默认过滤器
 */
export function createDefaultFilter(): FlowFilter {
  return {
    starred_only: false,
  };
}

/**
 * 创建时间范围过滤器
 */
export function createTimeRangeFilter(
  hours: number,
): Pick<FlowFilter, "time_range"> {
  const end = new Date();
  const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
  return {
    time_range: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
  };
}

/**
 * 合并过滤器
 */
export function mergeFilters(...filters: FlowFilter[]): FlowFilter {
  return filters.reduce((acc, filter) => ({ ...acc, ...filter }), {});
}

export default flowMonitorApi;
