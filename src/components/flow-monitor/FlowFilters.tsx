import React, { useState, useEffect } from "react";
import {
  Filter,
  X,
  Search,
  Star,
  Clock,
  Tag,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  flowMonitorApi,
  type FlowFilter,
  type FlowState,
  type ProviderType,
} from "@/lib/api/flowMonitor";
import { cn } from "@/lib/utils";

interface FlowFiltersProps {
  filter: FlowFilter;
  onChange: (filter: FlowFilter) => void;
  onSearch?: (query: string) => void;
}

const PROVIDERS: ProviderType[] = [
  "Kiro",
  "Gemini",
  "Qwen",
  "Antigravity",
  "OpenAI",
  "Claude",
  "Vertex",
  "GeminiApiKey",
  "Codex",
  "ClaudeOAuth",
  "IFlow",
];

const STATES: FlowState[] = [
  "Pending",
  "Streaming",
  "Completed",
  "Failed",
  "Cancelled",
];

const TIME_PRESETS = [
  { label: "最近 1 小时", hours: 1 },
  { label: "最近 6 小时", hours: 6 },
  { label: "最近 24 小时", hours: 24 },
  { label: "最近 7 天", hours: 168 },
  { label: "全部", hours: 0 },
];

export function FlowFilters({ filter, onChange, onSearch }: FlowFiltersProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  // 加载可用标签
  useEffect(() => {
    flowMonitorApi.getAllTags().then(setAvailableTags).catch(console.error);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch?.(searchQuery.trim());
    }
  };

  const handleTimePreset = (hours: number) => {
    if (hours === 0) {
      onChange({ ...filter, time_range: undefined });
    } else {
      const end = new Date();
      const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
      onChange({
        ...filter,
        time_range: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
      });
    }
  };

  const handleProviderToggle = (provider: ProviderType) => {
    const current = filter.providers || [];
    const updated = current.includes(provider)
      ? current.filter((p) => p !== provider)
      : [...current, provider];
    onChange({
      ...filter,
      providers: updated.length > 0 ? updated : undefined,
    });
  };

  const handleStateToggle = (state: FlowState) => {
    const current = filter.states || [];
    const updated = current.includes(state)
      ? current.filter((s) => s !== state)
      : [...current, state];
    onChange({
      ...filter,
      states: updated.length > 0 ? updated : undefined,
    });
  };

  const handleTagToggle = (tag: string) => {
    const current = filter.tags || [];
    const updated = current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag];
    onChange({
      ...filter,
      tags: updated.length > 0 ? updated : undefined,
    });
  };

  const handleClearFilters = () => {
    onChange({});
    setSearchQuery("");
  };

  const hasActiveFilters =
    filter.providers?.length ||
    filter.states?.length ||
    filter.tags?.length ||
    filter.time_range ||
    filter.has_error !== undefined ||
    filter.has_tool_calls !== undefined ||
    filter.has_thinking !== undefined ||
    filter.starred_only ||
    filter.content_search ||
    filter.models?.length;

  const activeFilterCount = [
    filter.providers?.length,
    filter.states?.length,
    filter.tags?.length,
    filter.time_range ? 1 : 0,
    filter.has_error !== undefined ? 1 : 0,
    filter.has_tool_calls !== undefined ? 1 : 0,
    filter.has_thinking !== undefined ? 1 : 0,
    filter.starred_only ? 1 : 0,
    filter.content_search ? 1 : 0,
    filter.models?.length,
  ].reduce((sum: number, val) => sum + (val || 0), 0);

  return (
    <div className="space-y-3">
      {/* 搜索栏 */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="搜索内容..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border bg-background pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
        >
          搜索
        </button>
      </form>

      {/* 快捷过滤器 */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* 时间预设 */}
        <div className="flex items-center gap-1">
          <Clock className="h-4 w-4 text-muted-foreground" />
          {TIME_PRESETS.map((preset) => (
            <button
              key={preset.hours}
              onClick={() => handleTimePreset(preset.hours)}
              className={cn(
                "text-xs px-2 py-1 rounded hover:bg-muted",
                (preset.hours === 0 && !filter.time_range) ||
                  (filter.time_range &&
                    preset.hours > 0 &&
                    isTimeRangeMatch(filter.time_range, preset.hours))
                  ? "bg-primary text-primary-foreground"
                  : "",
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* 收藏过滤 */}
        <button
          onClick={() =>
            onChange({ ...filter, starred_only: !filter.starred_only })
          }
          className={cn(
            "flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-muted",
            filter.starred_only &&
              "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
          )}
        >
          <Star className="h-3 w-3" />
          收藏
        </button>

        {/* 展开/收起高级过滤器 */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-muted ml-auto"
        >
          <Filter className="h-3 w-3" />
          高级过滤
          {activeFilterCount > 0 && (
            <span className="bg-primary text-primary-foreground text-xs px-1.5 rounded-full">
              {activeFilterCount}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>

        {/* 清除过滤器 */}
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
          >
            <X className="h-3 w-3" />
            清除
          </button>
        )}
      </div>

      {/* 高级过滤器面板 */}
      {expanded && (
        <div className="rounded-lg border bg-card p-4 space-y-4">
          {/* 提供商过滤 */}
          <FilterSection title="提供商">
            <div className="flex flex-wrap gap-2">
              {PROVIDERS.map((provider) => (
                <FilterChip
                  key={provider}
                  label={provider}
                  active={filter.providers?.includes(provider)}
                  onClick={() => handleProviderToggle(provider)}
                />
              ))}
            </div>
          </FilterSection>

          {/* 状态过滤 */}
          <FilterSection title="状态">
            <div className="flex flex-wrap gap-2">
              {STATES.map((state) => (
                <FilterChip
                  key={state}
                  label={getStateLabel(state)}
                  active={filter.states?.includes(state)}
                  onClick={() => handleStateToggle(state)}
                />
              ))}
            </div>
          </FilterSection>

          {/* 特性过滤 */}
          <FilterSection title="特性">
            <div className="flex flex-wrap gap-2">
              <FilterChip
                label="有错误"
                active={filter.has_error === true}
                onClick={() =>
                  onChange({
                    ...filter,
                    has_error: filter.has_error === true ? undefined : true,
                  })
                }
              />
              <FilterChip
                label="有工具调用"
                active={filter.has_tool_calls === true}
                onClick={() =>
                  onChange({
                    ...filter,
                    has_tool_calls:
                      filter.has_tool_calls === true ? undefined : true,
                  })
                }
              />
              <FilterChip
                label="有思维链"
                active={filter.has_thinking === true}
                onClick={() =>
                  onChange({
                    ...filter,
                    has_thinking:
                      filter.has_thinking === true ? undefined : true,
                  })
                }
              />
              <FilterChip
                label="流式响应"
                active={filter.is_streaming === true}
                onClick={() =>
                  onChange({
                    ...filter,
                    is_streaming:
                      filter.is_streaming === true ? undefined : true,
                  })
                }
              />
            </div>
          </FilterSection>

          {/* 标签过滤 */}
          {availableTags.length > 0 && (
            <FilterSection title="标签">
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => (
                  <FilterChip
                    key={tag}
                    label={tag}
                    active={filter.tags?.includes(tag)}
                    onClick={() => handleTagToggle(tag)}
                    icon={<Tag className="h-3 w-3" />}
                  />
                ))}
              </div>
            </FilterSection>
          )}

          {/* Token 范围 */}
          <FilterSection title="Token 范围">
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="最小"
                value={filter.token_range?.min || ""}
                onChange={(e) =>
                  onChange({
                    ...filter,
                    token_range: {
                      ...filter.token_range,
                      min: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    },
                  })
                }
                className="w-24 rounded border bg-background px-2 py-1 text-sm"
              />
              <span className="text-muted-foreground">-</span>
              <input
                type="number"
                placeholder="最大"
                value={filter.token_range?.max || ""}
                onChange={(e) =>
                  onChange({
                    ...filter,
                    token_range: {
                      ...filter.token_range,
                      max: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    },
                  })
                }
                className="w-24 rounded border bg-background px-2 py-1 text-sm"
              />
            </div>
          </FilterSection>

          {/* 延迟范围 */}
          <FilterSection title="延迟范围 (ms)">
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="最小"
                value={filter.latency_range?.min_ms || ""}
                onChange={(e) =>
                  onChange({
                    ...filter,
                    latency_range: {
                      ...filter.latency_range,
                      min_ms: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    },
                  })
                }
                className="w-24 rounded border bg-background px-2 py-1 text-sm"
              />
              <span className="text-muted-foreground">-</span>
              <input
                type="number"
                placeholder="最大"
                value={filter.latency_range?.max_ms || ""}
                onChange={(e) =>
                  onChange({
                    ...filter,
                    latency_range: {
                      ...filter.latency_range,
                      max_ms: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    },
                  })
                }
                className="w-24 rounded border bg-background px-2 py-1 text-sm"
              />
            </div>
          </FilterSection>

          {/* 模型过滤 */}
          <FilterSection title="模型">
            <input
              type="text"
              placeholder="输入模型名称（支持通配符 *）"
              value={filter.models?.[0] || ""}
              onChange={(e) =>
                onChange({
                  ...filter,
                  models: e.target.value ? [e.target.value] : undefined,
                })
              }
              className="w-full rounded border bg-background px-3 py-1.5 text-sm"
            />
          </FilterSection>
        </div>
      )}
    </div>
  );
}

interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
}

function FilterSection({ title, children }: FilterSectionProps) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-2">
        {title}
      </div>
      {children}
    </div>
  );
}

interface FilterChipProps {
  label: string;
  active?: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}

function FilterChip({ label, active, onClick, icon }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "hover:bg-muted border-transparent",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function getStateLabel(state: FlowState): string {
  const labels: Record<FlowState, string> = {
    Pending: "等待中",
    Streaming: "流式传输中",
    Completed: "已完成",
    Failed: "失败",
    Cancelled: "已取消",
  };
  return labels[state] || state;
}

function isTimeRangeMatch(
  timeRange: { start?: string; end?: string },
  hours: number,
): boolean {
  if (!timeRange.start || !timeRange.end) return false;
  const start = new Date(timeRange.start);
  const end = new Date(timeRange.end);
  const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  // 允许 5% 的误差
  return Math.abs(diff - hours) < hours * 0.05;
}

export default FlowFilters;
