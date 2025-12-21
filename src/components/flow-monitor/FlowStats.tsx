import React, { useState, useEffect, useCallback } from "react";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  BarChart3,
  PieChart,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  flowMonitorApi,
  type FlowStats as FlowStatsType,
  type FlowFilter,
  type ProviderStats,
  type ModelStats,
  formatLatency,
  formatTokenCount,
} from "@/lib/api/flowMonitor";
import { cn } from "@/lib/utils";

interface FlowStatsProps {
  /** 过滤条件 */
  filter?: FlowFilter;
  /** 自动刷新间隔（毫秒），0 表示不自动刷新 */
  autoRefreshInterval?: number;
  /** 刷新回调 */
  onRefresh?: () => void;
  /** 是否显示紧凑模式 */
  compact?: boolean;
}

export function FlowStats({
  filter = {},
  autoRefreshInterval = 0,
  onRefresh,
  compact = false,
}: FlowStatsProps) {
  const [stats, setStats] = useState<FlowStatsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await flowMonitorApi.getFlowStats(filter);
      setStats(result);
      setLastUpdated(new Date());
    } catch (e) {
      console.error("Failed to fetch flow stats:", e);
      setError(e instanceof Error ? e.message : "加载统计数据失败");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // 自动刷新
  useEffect(() => {
    if (autoRefreshInterval > 0) {
      const interval = setInterval(fetchStats, autoRefreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefreshInterval, fetchStats]);

  const handleRefresh = () => {
    fetchStats();
    onRefresh?.();
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-4">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
        <button
          onClick={handleRefresh}
          className="mt-2 text-sm underline hover:no-underline"
        >
          重试
        </button>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  if (compact) {
    return (
      <CompactStats
        stats={stats}
        loading={loading}
        onRefresh={handleRefresh}
        lastUpdated={lastUpdated}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* 头部工具栏 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          统计仪表板
        </h2>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              更新于 {lastUpdated.toLocaleTimeString("zh-CN")}
            </span>
          )}
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

      {/* 核心指标卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="总请求数"
          value={stats.total_requests.toString()}
          icon={<Activity className="h-5 w-5 text-blue-500" />}
          trend={null}
        />
        <StatCard
          title="成功率"
          value={`${(stats.success_rate * 100).toFixed(1)}%`}
          icon={
            stats.success_rate >= 0.95 ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : stats.success_rate >= 0.8 ? (
              <CheckCircle2 className="h-5 w-5 text-yellow-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )
          }
          trend={
            stats.success_rate >= 0.95
              ? "up"
              : stats.success_rate < 0.8
                ? "down"
                : null
          }
          valueColor={
            stats.success_rate >= 0.95
              ? "text-green-600"
              : stats.success_rate >= 0.8
                ? "text-yellow-600"
                : "text-red-600"
          }
        />
        <StatCard
          title="平均延迟"
          value={formatLatency(stats.avg_latency_ms)}
          icon={<Clock className="h-5 w-5 text-purple-500" />}
          subtitle={`${formatLatency(stats.min_latency_ms)} - ${formatLatency(stats.max_latency_ms)}`}
        />
        <StatCard
          title="总 Token"
          value={formatTokenCount(
            stats.total_input_tokens + stats.total_output_tokens,
          )}
          icon={<Zap className="h-5 w-5 text-orange-500" />}
          subtitle={`输入 ${formatTokenCount(stats.total_input_tokens)} / 输出 ${formatTokenCount(stats.total_output_tokens)}`}
        />
      </div>

      {/* 成功/失败统计 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            请求状态
          </h3>
          <div className="space-y-3">
            <StatusBar
              label="成功"
              value={stats.successful_requests}
              total={stats.total_requests}
              color="bg-green-500"
            />
            <StatusBar
              label="失败"
              value={stats.failed_requests}
              total={stats.total_requests}
              color="bg-red-500"
            />
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-orange-500" />
            Token 统计
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">平均输入</div>
              <div className="text-lg font-semibold">
                {formatTokenCount(stats.avg_input_tokens)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">平均输出</div>
              <div className="text-lg font-semibold">
                {formatTokenCount(stats.avg_output_tokens)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">总输入</div>
              <div className="text-sm text-muted-foreground">
                {formatTokenCount(stats.total_input_tokens)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">总输出</div>
              <div className="text-sm text-muted-foreground">
                {formatTokenCount(stats.total_output_tokens)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 按提供商分布 */}
      {stats.by_provider.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <PieChart className="h-4 w-4 text-blue-500" />
            按提供商分布
          </h3>
          <ProviderDistribution
            providers={stats.by_provider}
            total={stats.total_requests}
          />
        </div>
      )}

      {/* 按模型分布 */}
      {stats.by_model.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-purple-500" />
            按模型分布
          </h3>
          <ModelDistribution
            models={stats.by_model}
            total={stats.total_requests}
          />
        </div>
      )}

      {/* 按状态分布 */}
      {stats.by_state.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-green-500" />
            按状态分布
          </h3>
          <StateDistribution
            states={stats.by_state}
            total={stats.total_requests}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 紧凑模式组件
// ============================================================================

interface CompactStatsProps {
  stats: FlowStatsType;
  loading: boolean;
  onRefresh: () => void;
  lastUpdated: Date | null;
}

function CompactStats({
  stats,
  loading,
  onRefresh,
  lastUpdated,
}: CompactStatsProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">统计概览</span>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-1 rounded hover:bg-muted disabled:opacity-50"
          title={
            lastUpdated
              ? `更新于 ${lastUpdated.toLocaleTimeString("zh-CN")}`
              : "刷新"
          }
        >
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-3 text-center">
        <div>
          <div className="text-lg font-semibold">{stats.total_requests}</div>
          <div className="text-xs text-muted-foreground">请求</div>
        </div>
        <div>
          <div
            className={cn(
              "text-lg font-semibold",
              stats.success_rate >= 0.95
                ? "text-green-600"
                : stats.success_rate >= 0.8
                  ? "text-yellow-600"
                  : "text-red-600",
            )}
          >
            {(stats.success_rate * 100).toFixed(0)}%
          </div>
          <div className="text-xs text-muted-foreground">成功率</div>
        </div>
        <div>
          <div className="text-lg font-semibold">
            {formatLatency(stats.avg_latency_ms)}
          </div>
          <div className="text-xs text-muted-foreground">平均延迟</div>
        </div>
        <div>
          <div className="text-lg font-semibold">
            {formatTokenCount(
              stats.total_input_tokens + stats.total_output_tokens,
            )}
          </div>
          <div className="text-xs text-muted-foreground">Token</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 统计卡片组件
// ============================================================================

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | null;
  subtitle?: string;
  valueColor?: string;
}

function StatCard({
  title,
  value,
  icon,
  trend,
  subtitle,
  valueColor,
}: StatCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{title}</span>
        {icon}
      </div>
      <div className="flex items-center gap-2">
        <span className={cn("text-2xl font-bold", valueColor)}>{value}</span>
        {trend === "up" && <TrendingUp className="h-4 w-4 text-green-500" />}
        {trend === "down" && <TrendingDown className="h-4 w-4 text-red-500" />}
      </div>
      {subtitle && (
        <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>
      )}
    </div>
  );
}

// ============================================================================
// 状态条组件
// ============================================================================

interface StatusBarProps {
  label: string;
  value: number;
  total: number;
  color: string;
}

function StatusBar({ label, value, total, color }: StatusBarProps) {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="text-muted-foreground">
          {value} ({percentage.toFixed(1)}%)
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// 提供商分布组件
// ============================================================================

interface ProviderDistributionProps {
  providers: ProviderStats[];
  total: number;
}

function ProviderDistribution({ providers, total }: ProviderDistributionProps) {
  const providerColors: Record<string, string> = {
    Kiro: "bg-purple-500",
    Gemini: "bg-blue-500",
    OpenAI: "bg-green-500",
    Claude: "bg-orange-500",
    Qwen: "bg-cyan-500",
    Antigravity: "bg-pink-500",
    Vertex: "bg-indigo-500",
    GeminiApiKey: "bg-blue-400",
    Codex: "bg-emerald-500",
    ClaudeOAuth: "bg-amber-500",
    IFlow: "bg-rose-500",
  };

  const sortedProviders = [...providers].sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-4">
      {/* 分布条 */}
      <div className="h-4 bg-muted rounded-full overflow-hidden flex">
        {sortedProviders.map((provider) => {
          const percentage = total > 0 ? (provider.count / total) * 100 : 0;
          if (percentage < 1) return null;
          return (
            <div
              key={provider.provider}
              className={cn(
                "h-full transition-all",
                providerColors[provider.provider] || "bg-gray-500",
              )}
              style={{ width: `${percentage}%` }}
              title={`${provider.provider}: ${provider.count} (${percentage.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {/* 详细列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {sortedProviders.map((provider) => {
          const percentage = total > 0 ? (provider.count / total) * 100 : 0;
          return (
            <div
              key={provider.provider}
              className="flex items-center gap-3 p-2 rounded bg-muted/50"
            >
              <div
                className={cn(
                  "w-3 h-3 rounded-full shrink-0",
                  providerColors[provider.provider] || "bg-gray-500",
                )}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {provider.provider}
                </div>
                <div className="text-xs text-muted-foreground">
                  {provider.count} 次 ({percentage.toFixed(1)}%)
                </div>
              </div>
              <div className="text-right shrink-0">
                <div
                  className={cn(
                    "text-xs",
                    provider.success_rate >= 0.95
                      ? "text-green-600"
                      : provider.success_rate >= 0.8
                        ? "text-yellow-600"
                        : "text-red-600",
                  )}
                >
                  {(provider.success_rate * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatLatency(provider.avg_latency_ms)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// 模型分布组件
// ============================================================================

interface ModelDistributionProps {
  models: ModelStats[];
  total: number;
}

function ModelDistribution({ models, total }: ModelDistributionProps) {
  const sortedModels = [...models].sort((a, b) => b.count - a.count);
  const topModels = sortedModels.slice(0, 10); // 只显示前 10 个模型

  return (
    <div className="space-y-2">
      {topModels.map((model, index) => {
        const percentage = total > 0 ? (model.count / total) * 100 : 0;
        return (
          <div key={model.model} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-muted-foreground w-4">
                  {index + 1}.
                </span>
                <span className="truncate font-medium" title={model.model}>
                  {model.model}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span
                  className={cn(
                    "text-xs",
                    model.success_rate >= 0.95
                      ? "text-green-600"
                      : model.success_rate >= 0.8
                        ? "text-yellow-600"
                        : "text-red-600",
                  )}
                >
                  {(model.success_rate * 100).toFixed(0)}%
                </span>
                <span className="text-xs text-muted-foreground w-16 text-right">
                  {formatLatency(model.avg_latency_ms)}
                </span>
                <span className="text-xs text-muted-foreground w-20 text-right">
                  {model.count} ({percentage.toFixed(1)}%)
                </span>
              </div>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
      {sortedModels.length > 10 && (
        <div className="text-xs text-muted-foreground text-center pt-2">
          还有 {sortedModels.length - 10} 个模型未显示
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 状态分布组件
// ============================================================================

interface StateDistributionProps {
  states: { state: string; count: number }[];
  total: number;
}

function StateDistribution({ states, total }: StateDistributionProps) {
  const stateColors: Record<string, string> = {
    Completed: "bg-green-500",
    Failed: "bg-red-500",
    Streaming: "bg-blue-500",
    Pending: "bg-yellow-500",
    Cancelled: "bg-gray-500",
  };

  const stateLabels: Record<string, string> = {
    Completed: "已完成",
    Failed: "失败",
    Streaming: "流式传输中",
    Pending: "等待中",
    Cancelled: "已取消",
  };

  const sortedStates = [...states].sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-4">
      {/* 分布条 */}
      <div className="h-4 bg-muted rounded-full overflow-hidden flex">
        {sortedStates.map((state) => {
          const percentage = total > 0 ? (state.count / total) * 100 : 0;
          if (percentage < 1) return null;
          return (
            <div
              key={state.state}
              className={cn(
                "h-full transition-all",
                stateColors[state.state] || "bg-gray-500",
              )}
              style={{ width: `${percentage}%` }}
              title={`${stateLabels[state.state] || state.state}: ${state.count} (${percentage.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {/* 图例 */}
      <div className="flex flex-wrap gap-4">
        {sortedStates.map((state) => {
          const percentage = total > 0 ? (state.count / total) * 100 : 0;
          return (
            <div key={state.state} className="flex items-center gap-2">
              <div
                className={cn(
                  "w-3 h-3 rounded-full",
                  stateColors[state.state] || "bg-gray-500",
                )}
              />
              <span className="text-sm">
                {stateLabels[state.state] || state.state}
              </span>
              <span className="text-xs text-muted-foreground">
                {state.count} ({percentage.toFixed(1)}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default FlowStats;
