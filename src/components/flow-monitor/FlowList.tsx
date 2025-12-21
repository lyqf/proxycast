import React, { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ChevronDown,
  ChevronRight,
  Star,
  StarOff,
  Wrench,
  Brain,
  RefreshCw,
  Copy,
  ExternalLink,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  flowMonitorApi,
  type LLMFlow,
  type FlowState,
  type FlowFilter,
  type FlowSortBy,
  type FlowQueryResult,
  formatFlowState,
  formatLatency,
  formatTokenCount,
  truncateText,
} from "@/lib/api/flowMonitor";
import { useFlowEvents } from "@/hooks/useFlowEvents";
import { cn } from "@/lib/utils";

interface FlowListProps {
  filter?: FlowFilter;
  onFlowSelect?: (flow: LLMFlow) => void;
  selectedFlowId?: string;
  onRefresh?: () => void;
  /** 是否启用实时更新 */
  enableRealtime?: boolean;
}

export function FlowList({
  filter = {},
  onFlowSelect,
  selectedFlowId,
  onRefresh,
  enableRealtime = true,
}: FlowListProps) {
  const [flows, setFlows] = useState<LLMFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState<FlowSortBy>("created_at");
  const [sortDesc, setSortDesc] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 实时更新 Hook
  const {
    connected: wsConnected,
    connecting: wsConnecting,
    activeFlows,
  } = useFlowEvents({
    autoConnect: enableRealtime,
    onFlowStarted: (flow) => {
      // 新 Flow 开始时，添加到列表顶部
      if (page === 1 && sortBy === "created_at" && sortDesc) {
        setFlows((prev) => {
          // 将 FlowSummary 转换为 LLMFlow 的简化版本
          const newFlow: LLMFlow = {
            id: flow.id,
            flow_type: flow.flow_type,
            state: flow.state,
            request: {
              method: "POST",
              path: "",
              headers: {},
              body: {},
              messages: [],
              model: flow.model,
              parameters: { stream: false },
              size_bytes: 0,
              timestamp: flow.created_at,
            },
            metadata: {
              provider: flow.provider,
              retry_count: 0,
              client_info: {},
              routing_info: {},
            },
            timestamps: {
              created: flow.created_at,
              request_start: flow.created_at,
              duration_ms: flow.duration_ms,
            },
            annotations: {
              tags: [],
              starred: false,
            },
          };
          // 避免重复
          if (prev.some((f) => f.id === flow.id)) {
            return prev;
          }
          return [newFlow, ...prev.slice(0, pageSize - 1)];
        });
        setTotal((prev) => prev + 1);
      }
    },
    onFlowCompleted: (id, summary) => {
      // Flow 完成时，更新状态
      setFlows((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                state: "Completed" as FlowState,
                timestamps: {
                  ...f.timestamps,
                  duration_ms: summary.duration_ms,
                },
                response: f.response
                  ? {
                      ...f.response,
                      usage: {
                        ...f.response.usage,
                        input_tokens: summary.input_tokens || 0,
                        output_tokens: summary.output_tokens || 0,
                        total_tokens:
                          (summary.input_tokens || 0) +
                          (summary.output_tokens || 0),
                      },
                    }
                  : undefined,
              }
            : f,
        ),
      );
    },
    onFlowFailed: (id) => {
      // Flow 失败时，更新状态
      setFlows((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, state: "Failed" as FlowState } : f,
        ),
      );
    },
    onFlowUpdated: (id, update) => {
      // Flow 更新时，更新状态
      if (update.state) {
        setFlows((prev) =>
          prev.map((f) => (f.id === id ? { ...f, state: update.state! } : f)),
        );
      }
    },
  });

  const fetchFlows = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result: FlowQueryResult = await flowMonitorApi.queryFlows(
        filter,
        sortBy,
        sortDesc,
        page,
        pageSize,
      );
      setFlows(result.flows);
      setTotalPages(result.total_pages);
      setTotal(result.total);
    } catch (e) {
      console.error("Failed to fetch flows:", e);
      setError(e instanceof Error ? e.message : "加载 Flow 列表失败");
    } finally {
      setLoading(false);
    }
  }, [filter, sortBy, sortDesc, page, pageSize]);

  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  const handleRefresh = () => {
    fetchFlows();
    onRefresh?.();
  };

  const handleToggleStar = async (e: React.MouseEvent, flowId: string) => {
    e.stopPropagation();
    try {
      await flowMonitorApi.toggleFlowStar(flowId);
      // 更新本地状态
      setFlows((prev) =>
        prev.map((f) =>
          f.id === flowId
            ? {
                ...f,
                annotations: {
                  ...f.annotations,
                  starred: !f.annotations.starred,
                },
              }
            : f,
        ),
      );
    } catch (e) {
      console.error("Failed to toggle star:", e);
    }
  };

  const handleCopyId = async (e: React.MouseEvent, flowId: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(flowId);
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  };

  const getStateIcon = (state: FlowState) => {
    switch (state) {
      case "Completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "Failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "Streaming":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "Pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "Cancelled":
        return <XCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getProviderColor = (provider: string) => {
    const colors: Record<string, string> = {
      Kiro: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
      Gemini:
        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      OpenAI:
        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
      Claude:
        "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
      Qwen: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
      Antigravity:
        "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
    };
    return (
      colors[provider] ||
      "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300"
    );
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  if (loading && flows.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-4 text-red-600 dark:text-red-400">
        {error}
        <button
          onClick={handleRefresh}
          className="ml-2 underline hover:no-underline"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            共 {total} 条记录
          </span>
          {/* 实时连接状态 */}
          {enableRealtime && (
            <div className="flex items-center gap-1">
              {wsConnecting ? (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              ) : wsConnected ? (
                <Wifi className="h-3 w-3 text-green-500" />
              ) : (
                <WifiOff className="h-3 w-3 text-muted-foreground" />
              )}
              <span className="text-xs text-muted-foreground">
                {wsConnecting ? "连接中..." : wsConnected ? "实时更新" : "离线"}
              </span>
            </div>
          )}
          {/* 活跃 Flow 数量 */}
          {activeFlows.size > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {activeFlows.size} 进行中
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            className="rounded border bg-background px-2 py-1 text-sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as FlowSortBy)}
          >
            <option value="created_at">按时间</option>
            <option value="duration">按耗时</option>
            <option value="total_tokens">按 Token</option>
            <option value="model">按模型</option>
          </select>
          <button
            onClick={() => setSortDesc(!sortDesc)}
            className="rounded border px-2 py-1 text-sm hover:bg-muted"
          >
            {sortDesc ? "降序" : "升序"}
          </button>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-1 rounded border px-2 py-1 text-sm hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
            刷新
          </button>
        </div>
      </div>

      {/* Flow 列表 */}
      <div className="rounded-lg border bg-card">
        {flows.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            暂无 Flow 记录
          </div>
        ) : (
          <div className="divide-y max-h-[600px] overflow-y-auto">
            {flows.map((flow) => (
              <FlowListItem
                key={flow.id}
                flow={flow}
                expanded={expandedId === flow.id}
                selected={selectedFlowId === flow.id}
                onToggleExpand={() =>
                  setExpandedId(expandedId === flow.id ? null : flow.id)
                }
                onSelect={() => onFlowSelect?.(flow)}
                onToggleStar={(e) => handleToggleStar(e, flow.id)}
                onCopyId={(e) => handleCopyId(e, flow.id)}
                getStateIcon={getStateIcon}
                getProviderColor={getProviderColor}
                formatTime={formatTime}
              />
            ))}
          </div>
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded border px-3 py-1 text-sm hover:bg-muted disabled:opacity-50"
          >
            上一页
          </button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded border px-3 py-1 text-sm hover:bg-muted disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}

interface FlowListItemProps {
  flow: LLMFlow;
  expanded: boolean;
  selected: boolean;
  onToggleExpand: () => void;
  onSelect: () => void;
  onToggleStar: (e: React.MouseEvent) => void;
  onCopyId: (e: React.MouseEvent) => void;
  getStateIcon: (state: FlowState) => React.ReactNode;
  getProviderColor: (provider: string) => string;
  formatTime: (timestamp: string) => string;
}

function FlowListItem({
  flow,
  expanded,
  selected,
  onToggleExpand,
  onSelect,
  onToggleStar,
  onCopyId,
  getStateIcon,
  getProviderColor,
  formatTime,
}: FlowListItemProps) {
  const hasToolCalls =
    flow.response?.tool_calls && flow.response.tool_calls.length > 0;
  const hasThinking = !!flow.response?.thinking;
  const hasError = !!flow.error;

  return (
    <div
      className={cn(
        "hover:bg-muted/50 transition-colors",
        selected && "bg-muted",
      )}
    >
      {/* 主行 */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={onSelect}
      >
        {/* 展开按钮 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          className="p-0.5 hover:bg-muted rounded"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {/* 状态图标 */}
        {getStateIcon(flow.state)}

        {/* 时间 */}
        <span className="text-xs text-muted-foreground w-28 shrink-0">
          {formatTime(flow.timestamps.created)}
        </span>

        {/* 提供商 */}
        <span
          className={cn(
            "text-xs px-2 py-0.5 rounded-full shrink-0",
            getProviderColor(flow.metadata.provider),
          )}
        >
          {flow.metadata.provider}
        </span>

        {/* 模型 */}
        <span className="text-sm font-medium truncate flex-1 min-w-0">
          {flow.request.model}
        </span>

        {/* 特性标记 */}
        <div className="flex items-center gap-1 shrink-0">
          {hasToolCalls && (
            <span title="包含工具调用">
              <Wrench className="h-3.5 w-3.5 text-blue-500" />
            </span>
          )}
          {hasThinking && (
            <span title="包含思维链">
              <Brain className="h-3.5 w-3.5 text-purple-500" />
            </span>
          )}
          {hasError && (
            <span title="发生错误">
              <XCircle className="h-3.5 w-3.5 text-red-500" />
            </span>
          )}
        </div>

        {/* Token 数 */}
        <span className="text-xs text-muted-foreground w-20 text-right shrink-0">
          {flow.response?.usage
            ? formatTokenCount(flow.response.usage.total_tokens)
            : "-"}{" "}
          tokens
        </span>

        {/* 耗时 */}
        <span className="text-xs text-muted-foreground w-16 text-right shrink-0">
          {formatLatency(flow.timestamps.duration_ms)}
        </span>

        {/* 收藏按钮 */}
        <button
          onClick={onToggleStar}
          className="p-1 hover:bg-muted rounded shrink-0"
        >
          {flow.annotations.starred ? (
            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
          ) : (
            <StarOff className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* 展开详情 */}
      {expanded && (
        <div className="px-4 pb-3 pl-12 space-y-3">
          {/* 基本信息 */}
          <div className="grid grid-cols-3 gap-4 rounded bg-muted/50 p-3 text-sm">
            <div>
              <span className="text-muted-foreground">状态:</span>{" "}
              <span
                className={cn(
                  flow.state === "Completed" && "text-green-600",
                  flow.state === "Failed" && "text-red-600",
                  flow.state === "Streaming" && "text-blue-600",
                )}
              >
                {formatFlowState(flow.state)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">流式:</span>{" "}
              {flow.request.parameters.stream ? "是" : "否"}
            </div>
            <div>
              <span className="text-muted-foreground">TTFB:</span>{" "}
              {flow.timestamps.ttfb_ms
                ? formatLatency(flow.timestamps.ttfb_ms)
                : "-"}
            </div>
            {flow.response?.usage && (
              <>
                <div>
                  <span className="text-muted-foreground">输入 Token:</span>{" "}
                  {formatTokenCount(flow.response.usage.input_tokens)}
                </div>
                <div>
                  <span className="text-muted-foreground">输出 Token:</span>{" "}
                  {formatTokenCount(flow.response.usage.output_tokens)}
                </div>
                {flow.response.usage.cache_read_tokens && (
                  <div>
                    <span className="text-muted-foreground">缓存读取:</span>{" "}
                    {formatTokenCount(flow.response.usage.cache_read_tokens)}
                  </div>
                )}
              </>
            )}
            {flow.metadata.credential_name && (
              <div>
                <span className="text-muted-foreground">凭证:</span>{" "}
                {flow.metadata.credential_name}
              </div>
            )}
            {flow.metadata.retry_count > 0 && (
              <div>
                <span className="text-muted-foreground">重试次数:</span>{" "}
                {flow.metadata.retry_count}
              </div>
            )}
          </div>

          {/* 内容预览 */}
          {flow.response?.content && (
            <div className="rounded bg-muted/50 p-3">
              <div className="text-xs text-muted-foreground mb-1">
                响应内容预览:
              </div>
              <div className="text-sm whitespace-pre-wrap break-words">
                {truncateText(flow.response.content, 300)}
              </div>
            </div>
          )}

          {/* 错误信息 */}
          {flow.error && (
            <div className="rounded bg-red-50 dark:bg-red-950/20 p-3 text-red-600 dark:text-red-400">
              <div className="font-medium">错误: {flow.error.error_type}</div>
              <div className="text-sm mt-1">{flow.error.message}</div>
            </div>
          )}

          {/* 标签 */}
          {flow.annotations.tags.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">标签:</span>
              {flow.annotations.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 rounded-full bg-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex items-center gap-2">
            <button
              onClick={onCopyId}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Copy className="h-3 w-3" />
              复制 ID
            </button>
            <button
              onClick={onSelect}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" />
              查看详情
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default FlowList;
