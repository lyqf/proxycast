/**
 * 数据统计页面组件
 *
 * 参考 LobeHub 的 stats 实现
 * 功能包括：使用统计数据展示、Token 消耗统计等
 */

import { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  MessageSquare,
  Timer,
  Coins,
  TrendingUp,
  Download,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UsageStats {
  /** 总对话数 */
  total_conversations: number;
  /** 总消息数 */
  total_messages: number;
  /** 总 Token 消耗 */
  total_tokens: number;
  /** 总使用时间（分钟） */
  total_time_minutes: number;
  /** 本月对话数 */
  monthly_conversations: number;
  /** 本月消息数 */
  monthly_messages: number;
  /** 本月 Token 消耗 */
  monthly_tokens: number;
  /** 今日对话数 */
  today_conversations: number;
  /** 今日消息数 */
  today_messages: number;
  /** 今日 Token 消耗 */
  today_tokens: number;
}

interface ModelUsage {
  model: string;
  conversations: number;
  tokens: number;
  percentage: number;
}

interface DailyUsage {
  date: string;
  conversations: number;
  tokens: number;
}

export function StatsSettings() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [modelUsage, setModelUsage] = useState<ModelUsage[]>([]);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [timeRange, setTimeRange] = useState<"week" | "month" | "all">("month");

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      // TODO: 实现获取统计数据 API
      // const data = await getUsageStats(timeRange);
      // setStats(data.stats);
      // setModelUsage(data.modelUsage);
      // setDailyUsage(data.dailyUsage);

      // 模拟数据
      setStats({
        total_conversations: 328,
        total_messages: 4521,
        total_tokens: 1258000,
        total_time_minutes: 1840,
        monthly_conversations: 67,
        monthly_messages: 892,
        monthly_tokens: 245000,
        today_conversations: 5,
        today_messages: 42,
        today_tokens: 12000,
      });

      setModelUsage([
        { model: "GPT-4", conversations: 145, tokens: 580000, percentage: 46 },
        {
          model: "GPT-3.5",
          conversations: 128,
          tokens: 420000,
          percentage: 33,
        },
        {
          model: "Claude 3",
          conversations: 55,
          tokens: 258000,
          percentage: 21,
        },
      ]);

      // 生成模拟的每日数据
      const days = timeRange === "week" ? 7 : timeRange === "month" ? 30 : 90;
      const mockDaily: DailyUsage[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        mockDaily.push({
          date: date.toISOString().split("T")[0],
          conversations: Math.floor(Math.random() * 10) + 1,
          tokens: Math.floor(Math.random() * 15000) + 2000,
        });
      }
      setDailyUsage(mockDaily);
    } catch (e) {
      console.error("加载统计数据失败:", e);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatTime = (minutes: number): string => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h ${mins}m`;
    }
    return `${minutes}m`;
  };

  const StatCard = ({
    icon: Icon,
    label,
    value,
    subvalue,
    trend,
  }: {
    icon: any;
    label: string;
    value: string;
    subvalue?: string;
    trend?: number;
  }) => (
    <div className="flex-1 min-w-[140px] p-4 rounded-lg border bg-gradient-to-br from-primary/5 to-primary/10">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-bold text-primary mb-1">{value}</div>
      {subvalue && (
        <div className="text-xs text-muted-foreground">{subvalue}</div>
      )}
      {trend !== undefined && (
        <div className="flex items-center gap-1 mt-1">
          <TrendingUp className="h-3 w-3 text-green-500" />
          <span className="text-xs text-green-500">{trend}%</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4 max-w-4xl">
      {/* 时间范围选择 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">使用统计</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTimeRange("week")}
            className={cn(
              "px-3 py-1.5 rounded text-sm transition-colors",
              timeRange === "week"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted",
            )}
          >
            本周
          </button>
          <button
            onClick={() => setTimeRange("month")}
            className={cn(
              "px-3 py-1.5 rounded text-sm transition-colors",
              timeRange === "month"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted",
            )}
          >
            本月
          </button>
          <button
            onClick={() => setTimeRange("all")}
            className={cn(
              "px-3 py-1.5 rounded text-sm transition-colors",
              timeRange === "all"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted",
            )}
          >
            全部
          </button>
          <button
            onClick={loadStats}
            disabled={loading}
            className="p-2 rounded hover:bg-muted transition-colors"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : stats ? (
        <>
          {/* 今日统计 */}
          <div>
            <h3 className="text-sm font-medium mb-3">今日</h3>
            <div className="flex gap-3 overflow-x-auto pb-2">
              <StatCard
                icon={MessageSquare}
                label="对话"
                value={stats.today_conversations.toString()}
                subvalue={`${stats.today_messages} 条消息`}
              />
              <StatCard
                icon={Coins}
                label="Token"
                value={formatNumber(stats.today_tokens)}
                trend={12}
              />
              <StatCard
                icon={Timer}
                label="时长"
                value={formatTime(
                  Math.round(
                    (stats.today_tokens / (stats.total_tokens || 1)) *
                      stats.total_time_minutes,
                  ),
                )}
              />
            </div>
          </div>

          {/* 本月统计 */}
          <div>
            <h3 className="text-sm font-medium mb-3">本月</h3>
            <div className="flex gap-3 overflow-x-auto pb-2">
              <StatCard
                icon={MessageSquare}
                label="对话"
                value={stats.monthly_conversations.toString()}
                subvalue={`${stats.monthly_messages} 条消息`}
                trend={8}
              />
              <StatCard
                icon={Coins}
                label="Token"
                value={formatNumber(stats.monthly_tokens)}
                trend={15}
              />
              <StatCard
                icon={Timer}
                label="时长"
                value={formatTime(
                  Math.round(
                    (stats.monthly_tokens / (stats.total_tokens || 1)) *
                      stats.total_time_minutes,
                  ),
                )}
              />
            </div>
          </div>

          {/* 总计 */}
          <div>
            <h3 className="text-sm font-medium mb-3">总计</h3>
            <div className="flex gap-3 overflow-x-auto pb-2">
              <StatCard
                icon={MessageSquare}
                label="对话"
                value={stats.total_conversations.toString()}
                subvalue={`${stats.total_messages} 条消息`}
              />
              <StatCard
                icon={Coins}
                label="Token"
                value={formatNumber(stats.total_tokens)}
              />
              <StatCard
                icon={Timer}
                label="时长"
                value={formatTime(stats.total_time_minutes)}
              />
            </div>
          </div>

          {/* 模型使用排行 */}
          <div className="rounded-lg border p-4">
            <h3 className="text-sm font-medium mb-4">模型使用排行</h3>
            <div className="space-y-3">
              {modelUsage.map((model, index) => (
                <div key={model.model} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        #{index + 1}
                      </span>
                      <span className="font-medium">{model.model}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{model.conversations} 次对话</span>
                      <span>{formatNumber(model.tokens)} Token</span>
                      <span className="text-primary font-medium">
                        {model.percentage}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${model.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 每日使用趋势 */}
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">每日使用趋势</h3>
              <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <Download className="h-3 w-3" />
                导出
              </button>
            </div>
            <div className="h-40 flex items-end gap-1">
              {dailyUsage.map((day, _index) => {
                const maxTokens = Math.max(...dailyUsage.map((d) => d.tokens));
                const height =
                  maxTokens > 0 ? (day.tokens / maxTokens) * 100 : 0;
                return (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col items-center gap-1 group"
                  >
                    <div
                      className="w-full bg-primary/60 hover:bg-primary rounded-t transition-colors relative"
                      style={{ height: `${Math.max(height, 4)}%` }}
                    >
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover border px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {formatNumber(day.tokens)} Token
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate w-full text-center">
                      {new Date(day.date).toLocaleDateString("zh-CN", {
                        month: "numeric",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 使用日历热力图（简化版） */}
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">活跃度日历</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>少</span>
                <div className="flex gap-0.5">
                  <div className="w-3 h-3 rounded-sm bg-primary/10" />
                  <div className="w-3 h-3 rounded-sm bg-primary/30" />
                  <div className="w-3 h-3 rounded-sm bg-primary/50" />
                  <div className="w-3 h-3 rounded-sm bg-primary/70" />
                  <div className="w-3 h-3 rounded-sm bg-primary" />
                </div>
                <span>多</span>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
                <div
                  key={day}
                  className="text-xs text-muted-foreground text-center py-1"
                >
                  {day}
                </div>
              ))}
              {Array.from({ length: 35 }).map((_, index) => {
                const dayData = dailyUsage[index];
                const getIntensity = (tokens: number) => {
                  if (!dayData) return "bg-muted";
                  const max = Math.max(...dailyUsage.map((d) => d.tokens));
                  const ratio = tokens / max;
                  if (ratio < 0.2) return "bg-primary/10";
                  if (ratio < 0.4) return "bg-primary/30";
                  if (ratio < 0.6) return "bg-primary/50";
                  if (ratio < 0.8) return "bg-primary/70";
                  return "bg-primary";
                };
                return (
                  <div
                    key={index}
                    className={cn(
                      "aspect-square rounded-sm",
                      dayData ? getIntensity(dayData.tokens) : "bg-muted",
                    )}
                    title={
                      dayData ? `${dayData.date}: ${dayData.tokens} Token` : ""
                    }
                  />
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default StatsSettings;
