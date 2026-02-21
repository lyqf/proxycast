import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Copy, Eye, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AgentRun,
  AgentRunSource,
  AgentRunStatus,
  executionRunGet,
  executionRunList,
} from "@/lib/api/executionRun";

const PAGE_SIZE = 50;
const AUTO_REFRESH_INTERVAL_MS = 15_000;

type SourceFilter = "all" | AgentRunSource;
type StatusFilter = "all" | AgentRunStatus;

const SOURCE_OPTIONS: Array<{ value: SourceFilter; label: string }> = [
  { value: "all", label: "全部来源" },
  { value: "chat", label: "Chat" },
  { value: "skill", label: "Skill" },
  { value: "heartbeat", label: "Heartbeat" },
];

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "全部状态" },
  { value: "running", label: "运行中" },
  { value: "success", label: "成功" },
  { value: "error", label: "失败" },
  { value: "timeout", label: "超时" },
  { value: "canceled", label: "已取消" },
  { value: "queued", label: "排队中" },
];

function formatTime(time: string | null | undefined): string {
  if (!time) return "-";
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return time;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function formatDuration(durationMs: number | null | undefined): string {
  if (durationMs === null || durationMs === undefined) return "-";
  if (durationMs < 1000) return `${durationMs}ms`;
  if (durationMs < 60_000) return `${(durationMs / 1000).toFixed(2)}s`;
  return `${(durationMs / 60_000).toFixed(2)}m`;
}

function parseMetadata(raw: string | null | undefined): string {
  if (!raw) return "-";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function statusBadgeVariant(status: AgentRunStatus) {
  if (status === "success") return "default" as const;
  if (status === "running" || status === "queued") return "secondary" as const;
  if (status === "error" || status === "timeout") return "destructive" as const;
  return "outline" as const;
}

function statusLabel(status: AgentRunStatus): string {
  switch (status) {
    case "queued":
      return "排队中";
    case "running":
      return "运行中";
    case "success":
      return "成功";
    case "error":
      return "失败";
    case "canceled":
      return "已取消";
    case "timeout":
      return "超时";
    default:
      return status;
  }
}

function sourceLabel(source: AgentRunSource): string {
  switch (source) {
    case "chat":
      return "Chat";
    case "skill":
      return "Skill";
    case "heartbeat":
      return "Heartbeat";
    default:
      return source;
  }
}

export function ExecutionTrackerSettings() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sessionKeyword, setSessionKeyword] = useState("");
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null);

  const loadRuns = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) {
      setLoading(true);
    }
    try {
      const list = await executionRunList(PAGE_SIZE, 0);
      setRuns(list);
      setHasMore(list.length >= PAGE_SIZE);
      setLastSyncedAt(new Date().toLocaleString("zh-CN", { hour12: false }));
    } catch (error) {
      toast.error(`加载执行轨迹失败: ${error instanceof Error ? error.message : error}`);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const timer = window.setInterval(() => {
      void loadRuns({ silent: true });
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [autoRefreshEnabled, loadRuns]);

  const copyText = useCallback(async (text: string, successText: string) => {
    const value = text.trim();
    if (!value || value === "-") {
      toast.info("无可复制内容");
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successText);
    } catch {
      toast.error("复制失败，请手动复制");
    }
  }, []);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const list = await executionRunList(PAGE_SIZE, runs.length);
      setRuns((prev) => [...prev, ...list]);
      setHasMore(list.length >= PAGE_SIZE);
    } catch (error) {
      toast.error(`加载更多失败: ${error instanceof Error ? error.message : error}`);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleViewDetail = async (run: AgentRun) => {
    setSelectedRun(run);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const latest = await executionRunGet(run.id);
      if (latest) {
        setSelectedRun(latest);
      }
    } catch (error) {
      toast.error(`加载详情失败: ${error instanceof Error ? error.message : error}`);
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredRuns = useMemo(() => {
    const keyword = sessionKeyword.trim().toLowerCase();
    return runs.filter((run) => {
      if (sourceFilter !== "all" && run.source !== sourceFilter) return false;
      if (statusFilter !== "all" && run.status !== statusFilter) return false;
      if (!keyword) return true;
      const sessionId = (run.session_id || "").toLowerCase();
      return sessionId.includes(keyword);
    });
  }, [runs, sourceFilter, statusFilter, sessionKeyword]);

  const selectedMetadata = useMemo(() => {
    return parseMetadata(selectedRun?.metadata);
  }, [selectedRun?.metadata]);

  const selectedErrorMessage = selectedRun?.error_message || "-";
  const selectedSessionId = selectedRun?.session_id || "-";
  const autoRefreshHint = autoRefreshEnabled
    ? `自动刷新中（${AUTO_REFRESH_INTERVAL_MS / 1000}s）`
    : "自动刷新已关闭";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-sm font-medium">执行轨迹</h3>
            <p className="text-xs text-muted-foreground">
              统一查看 Chat / Skill / Heartbeat 执行记录
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch checked={autoRefreshEnabled} onCheckedChange={setAutoRefreshEnabled} />
            <span className="text-xs text-muted-foreground">{autoRefreshHint}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadRuns()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            刷新
          </Button>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Select
            value={sourceFilter}
            onValueChange={(value) => setSourceFilter(value as SourceFilter)}
          >
            <SelectTrigger>
              <SelectValue placeholder="来源过滤" />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          >
            <SelectTrigger>
              <SelectValue placeholder="状态过滤" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={sessionKeyword}
            onChange={(event) => setSessionKeyword(event.target.value)}
            placeholder="按 session_id 搜索"
          />
          <div className="flex items-center text-sm text-muted-foreground px-2">
            当前结果 {filteredRuns.length} 条
            {lastSyncedAt ? ` · 最近同步 ${lastSyncedAt}` : ""}
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>开始时间</TableHead>
              <TableHead>来源</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>耗时</TableHead>
              <TableHead>会话 ID</TableHead>
              <TableHead>引用</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRuns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  暂无执行记录
                </TableCell>
              </TableRow>
            ) : (
              filteredRuns.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="whitespace-nowrap">{formatTime(run.started_at)}</TableCell>
                  <TableCell>{sourceLabel(run.source)}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(run.status)}>
                      {statusLabel(run.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDuration(run.duration_ms)}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {run.session_id || "-"}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate">
                    {run.source_ref || "-"}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => handleViewDetail(run)}>
                      <Eye className="h-4 w-4 mr-1" />
                      详情
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {hasMore && (
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={handleLoadMore} disabled={loadingMore}>
              {loadingMore ? "加载中..." : "加载更多"}
            </Button>
          </div>
        )}
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle>执行详情</DialogTitle>
            <DialogDescription>
              run_id: <code>{selectedRun?.id || "-"}</code>
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="py-6 text-sm text-muted-foreground">加载详情中...</div>
          ) : selectedRun ? (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-muted-foreground">来源</div>
                  <div>{sourceLabel(selectedRun.source)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">状态</div>
                  <div>{statusLabel(selectedRun.status)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">开始时间</div>
                  <div>{formatTime(selectedRun.started_at)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">结束时间</div>
                  <div>{formatTime(selectedRun.finished_at)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">耗时</div>
                  <div>{formatDuration(selectedRun.duration_ms)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">会话 ID</div>
                  <div className="flex items-center gap-2">
                    <div className="truncate">{selectedSessionId}</div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyText(selectedSessionId, "会话 ID 已复制")}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      复制
                    </Button>
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-muted-foreground">来源引用</div>
                  <div>{selectedRun.source_ref || "-"}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-muted-foreground">错误码</div>
                  <div>{selectedRun.error_code || "-"}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-muted-foreground mb-1">错误信息</div>
                  <div className="flex items-start gap-2">
                    <div className="whitespace-pre-wrap break-words flex-1">{selectedErrorMessage}</div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyText(selectedErrorMessage, "错误信息已复制")}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      复制
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-muted-foreground mb-1 flex items-center justify-between">
                  <span>Metadata</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyText(selectedMetadata, "Metadata 已复制")}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    复制
                  </Button>
                </div>
                <pre className="rounded-md border bg-muted/30 p-3 overflow-x-auto text-xs leading-5">
                  {selectedMetadata}
                </pre>
              </div>
            </div>
          ) : (
            <div className="py-6 text-sm text-muted-foreground">未找到执行详情</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
