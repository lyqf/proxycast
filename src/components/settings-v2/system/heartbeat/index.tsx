import { useState, useEffect, useCallback, useRef } from "react";
import { HeartPulse, Play, Clock, History, FileText, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getHeartbeatConfig,
  updateHeartbeatConfig,
  getHeartbeatStatus,
  getHeartbeatTasks,
  getHeartbeatHistory,
  getHeartbeatTaskHealth,
  deliverHeartbeatTaskHealthAlerts,
  getTaskTemplates,
  applyTaskTemplate,
  triggerHeartbeatNow,
  addHeartbeatTask,
  deleteHeartbeatTask,
  updateHeartbeatTask,
  HeartbeatConfig,
  HeartbeatSecurityConfig,
  HeartbeatStatus,
  HeartbeatTaskPreview,
  HeartbeatExecution,
  HeartbeatTaskHealth,
  HeartbeatRiskTaskInfo,
  TaskTemplate,
  CycleResult,
  generateContentCreatorTasks,
  TaskSchedule,
  DeliveryConfig,
  previewSchedule,
} from "@/lib/api/heartbeat";
import { safeListen } from "@/lib/dev-bridge";
import { LatestRunStatusBadge } from "@/components/execution/LatestRunStatusBadge";

const DEFAULT_DELIVERY: DeliveryConfig = {
  mode: "none",
  best_effort: true,
};

const DEFAULT_SECURITY: HeartbeatSecurityConfig = {
  enabled: false,
  allowed_commands: [],
  allowed_paths: [],
};

const DEFAULT_CONFIG: HeartbeatConfig = {
  enabled: false,
  interval_secs: 300,
  task_file: "HEARTBEAT.md",
  execution_mode: "intelligent",
  enable_history: true,
  max_retries: 3,
  delivery: DEFAULT_DELIVERY,
  security: DEFAULT_SECURITY,
};

const EXECUTION_MODE_LABELS: Record<string, string> = {
  intelligent: "智能模式",
  skill: "技能模式",
  log_only: "仅日志",
};

const EXECUTION_MODE_DESC: Record<string, string> = {
  intelligent: "通过 AI Agent 理解并执行任务",
  skill: "调用已注册的技能执行任务",
  log_only: "仅记录任务，不实际执行",
};

export function HeartbeatSettings() {
  const [config, setConfig] = useState<HeartbeatConfig>(DEFAULT_CONFIG);
  const [status, setStatus] = useState<HeartbeatStatus | null>(null);
  const [tasks, setTasks] = useState<HeartbeatTaskPreview[]>([]);
  const [history, setHistory] = useState<HeartbeatExecution[]>([]);
  const [health, setHealth] = useState<HeartbeatTaskHealth | null>(null);
  const [selectedRiskTask, setSelectedRiskTask] =
    useState<HeartbeatRiskTaskInfo | null>(null);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "config" | "tasks" | "templates" | "history"
  >("config");
  const alertToastKeysRef = useRef<Set<string>>(new Set());

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, sts, tsk, hist, hlth, tmpl] = await Promise.all([
        getHeartbeatConfig().catch(() => DEFAULT_CONFIG),
        getHeartbeatStatus().catch(() => null),
        getHeartbeatTasks().catch(() => []),
        getHeartbeatHistory(20).catch(() => []),
        getHeartbeatTaskHealth({ top_limit: 5 }).catch(() => null),
        getTaskTemplates().catch(() => []),
      ]);
      setConfig(cfg);
      setStatus(sts);
      setTasks(tsk);
      setHistory(hist);
      setHealth(hlth);
      setTemplates(tmpl);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Fix 1: 监听后端心跳事件，实时更新状态
  useEffect(() => {
    const unlisteners: Array<() => void> = [];

    const setupListeners = async () => {
      try {
        const unlistenStart = await safeListen<string>(
          "heartbeat:task_start",
          (event) => {
            setStatus((prev) =>
              prev ? { ...prev, current_task: event.payload } : prev,
            );
          },
        );
        unlisteners.push(unlistenStart);

        const unlistenComplete = await safeListen<{
          description: string;
          status: string;
          duration_ms: number;
          retry_count: number;
        }>("heartbeat:task_complete", () => {
          // 任务完成后刷新 status 和 history
          getHeartbeatStatus().then(setStatus).catch(() => {});
          getHeartbeatHistory(20).then(setHistory).catch(() => {});
          getHeartbeatTaskHealth({ top_limit: 5 }).then(setHealth).catch(() => {});
          setStatus((prev) =>
            prev ? { ...prev, current_task: null } : prev,
          );
        });
        unlisteners.push(unlistenComplete);
      } catch (e) {
        console.error("[Heartbeat] 事件监听注册失败:", e);
      }
    };

    setupListeners();

    return () => {
      unlisteners.forEach((fn) => fn());
    };
  }, []);

  // Fix 1: 运行中时轮询 status
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (status?.running) {
      pollingRef.current = setInterval(() => {
        getHeartbeatStatus().then(setStatus).catch(() => {});
        getHeartbeatTaskHealth({ top_limit: 5 }).then(setHealth).catch(() => {});
      }, 10_000);
    } else if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [status?.running]);

  useEffect(() => {
    if (!health?.alerts?.length) return;
    for (const alert of health.alerts) {
      const key = `${alert.code}:${alert.currentValue}:${alert.threshold}`;
      if (alertToastKeysRef.current.has(key)) continue;
      alertToastKeysRef.current.add(key);
      if (alert.severity === "critical") {
        toast.error(`任务治理告警：${alert.message}`);
      } else if (alert.severity === "warning") {
        toast.warning(`任务治理告警：${alert.message}`);
      } else {
        toast.info(`任务治理提示：${alert.message}`);
      }
    }
  }, [health]);

  const saveConfig = async (newConfig: HeartbeatConfig) => {
    setConfig(newConfig);
    try {
      await updateHeartbeatConfig(newConfig);
      toast.success("心跳引擎配置已更新");
    } catch (e) {
      toast.error(`保存失败: ${e instanceof Error ? e.message : e}`);
    }
  };

  const handleTrigger = async () => {
    try {
      const result: CycleResult = await triggerHeartbeatNow();
      if (result.task_count === 0) {
        toast.info("没有待执行的任务");
      } else {
        const parts: string[] = [];
        if (result.success_count > 0) parts.push(`成功 ${result.success_count}`);
        if (result.failed_count > 0) parts.push(`失败 ${result.failed_count}`);
        if (result.timeout_count > 0) parts.push(`超时 ${result.timeout_count}`);
        toast.success(`执行完成: ${parts.join("、")}（共 ${result.task_count} 个任务）`);
      }
      await loadAll();
    } catch (e) {
      toast.error(`触发失败: ${e instanceof Error ? e.message : e}`);
    }
  };

  const handleApplyTemplate = async (templateId: string) => {
    try {
      await applyTaskTemplate(templateId);
      toast.success("模板已应用到 HEARTBEAT.md");
      const newTasks = await getHeartbeatTasks().catch(() => []);
      setTasks(newTasks);
    } catch (e) {
      toast.error(`应用模板失败: ${e instanceof Error ? e.message : e}`);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24, color: "hsl(var(--muted-foreground))" }}>
        加载中...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* 标题 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <HeartPulse size={24} />
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>心跳引擎</h1>
      </div>
      <div style={{ height: 1, background: "hsl(var(--border))" }} />
      <LatestRunStatusBadge source="heartbeat" label="统一执行状态" />

      {/* Tab 切换 */}
      <div style={{ display: "flex", gap: 8 }}>
        {(["config", "tasks", "templates", "history"] as const).map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab(tab)}
          >
            {tab === "config" && "配置"}
            {tab === "tasks" && "当前任务"}
            {tab === "templates" && "任务模板"}
            {tab === "history" && "执行历史"}
          </Button>
        ))}
      </div>


      {/* ===== 配置面板 ===== */}
      {activeTab === "config" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* 启用开关 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 500 }}>启用心跳引擎</div>
              <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))" }}>
                定期执行 HEARTBEAT.md 中的任务
              </div>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(checked) => saveConfig({ ...config, enabled: checked })}
            />
          </div>

          {/* 调度类型选择器 */}
          <ScheduleSelector
            schedule={config.schedule}
            intervalSecs={config.interval_secs}
            onChange={(schedule, intervalSecs) => {
              saveConfig({ ...config, schedule, interval_secs: intervalSecs });
            }}
          />

          {/* 执行模式 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 500 }}>执行模式</div>
              <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))" }}>
                {EXECUTION_MODE_DESC[config.execution_mode] ?? ""}
              </div>
            </div>
            <Select
              value={config.execution_mode}
              onValueChange={(v) =>
                saveConfig({ ...config, execution_mode: v as HeartbeatConfig["execution_mode"] })
              }
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={EXECUTION_MODE_LABELS[config.execution_mode]} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="intelligent">智能模式</SelectItem>
                <SelectItem value="skill">技能模式</SelectItem>
                <SelectItem value="log_only">仅日志</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 历史记录开关 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 500 }}>记录执行历史</div>
              <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))" }}>
                保存每次任务执行的结果
              </div>
            </div>
            <Switch
              checked={config.enable_history}
              onCheckedChange={(checked) => saveConfig({ ...config, enable_history: checked })}
            />
          </div>


          {/* 状态监控 */}
          {status && (
            <div
              style={{
                padding: 16,
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
                <Clock size={16} />
                运行状态
              </div>
              <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))" }}>
                状态: {status.running ? "运行中" : "已停止"} · 累计执行:{" "}
                {status.total_executions} 次
                {status.schedule_description && ` · 调度: ${status.schedule_description}`}
              </div>
              {status.last_run && (
                <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))" }}>
                  上次执行: {new Date(status.last_run).toLocaleString()}
                </div>
              )}
              {status.next_run && status.running && (
                <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))" }}>
                  下次执行: {new Date(status.next_run).toLocaleString()}
                </div>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleTrigger}
                style={{ alignSelf: "flex-start" }}
              >
                <Play size={14} style={{ marginRight: 4 }} />
                立即触发
              </Button>
            </div>
          )}

          {health && (
            <div
              style={{
                padding: 16,
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
                <HeartPulse size={16} />
                任务健康概览
              </div>
              <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))" }}>
                总任务: {health.totalTasks} · 待执行: {health.pendingTasks} · 运行中: {health.runningTasks} ·
                失败: {health.failedTasks}
              </div>
              <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))" }}>
                冷却中: {health.cooldownTasks} · 悬挂运行: {health.staleRunningTasks} · 24h 失败: {health.failedLast24h}
              </div>
              {health.alerts.length > 0 && (
                <div
                  style={{
                    fontSize: 12,
                    padding: 10,
                    borderRadius: 6,
                    border: "1px solid hsl(var(--destructive) / 0.35)",
                    background: "hsl(var(--destructive) / 0.08)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <div style={{ fontWeight: 500, color: "hsl(var(--destructive))" }}>
                    当前告警（{health.alerts.length}）
                  </div>
                  {health.alerts.map((alert) => (
                    <div key={alert.code}>
                      [{alert.severity}] {alert.message}
                    </div>
                  ))}
                  <div style={{ marginTop: 6 }}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          const result = await deliverHeartbeatTaskHealthAlerts({
                            top_limit: 5,
                          });
                          if (result.delivered) {
                            toast.success(
                              `告警已投递到 ${result.channel ?? "已配置渠道"}：${result.message}`,
                            );
                          } else {
                            toast.info(result.message);
                          }
                          const latest = await getHeartbeatTaskHealth({
                            top_limit: 5,
                          }).catch(() => null);
                          if (latest) setHealth(latest);
                        } catch (error) {
                          toast.error(
                            `告警投递失败: ${error instanceof Error ? error.message : error}`,
                          );
                        }
                      }}
                    >
                      推送当前告警
                    </Button>
                  </div>
                </div>
              )}
              {health.topRiskyTasks.length > 0 && (
                <div
                  style={{
                    fontSize: 12,
                    padding: 10,
                    borderRadius: 6,
                    background: "hsl(var(--muted))",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <div style={{ fontWeight: 500 }}>高风险任务 Top {health.topRiskyTasks.length}</div>
                  {health.topRiskyTasks.map((item) => (
                    <button
                      key={item.taskId}
                      style={{
                        textAlign: "left",
                        background: "transparent",
                        border: "none",
                        padding: "2px 0",
                        cursor: "pointer",
                        color: "hsl(var(--foreground))",
                      }}
                      onClick={() => setSelectedRiskTask(item)}
                    >
                      {item.name}（{item.taskId.slice(0, 8)}） · 状态: {item.status} · 连续失败:{" "}
                      {item.consecutiveFailures} · 重试: {item.retryCount}
                    </button>
                  ))}
                </div>
              )}
              {health.failureTrend24h.length > 0 && (
                <FailureTrendChart data={health.failureTrend24h} />
              )}
            </div>
          )}

          {/* 通知设置 */}
          <DeliverySettings
            delivery={config.delivery}
            onChange={(delivery) => saveConfig({ ...config, delivery })}
          />
        </div>
      )}

      {/* ===== 当前任务 ===== */}
      {activeTab === "tasks" && (
        <TasksPanel tasks={tasks} onRefresh={async () => {
          const newTasks = await getHeartbeatTasks().catch(() => []);
          setTasks(newTasks);
        }} />
      )}


      {/* ===== 任务模板 ===== */}
      {activeTab === "templates" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* 内容创作集成 */}
          <div
            style={{
              padding: 16,
              borderRadius: 8,
              border: "1px dashed hsl(var(--border))",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontWeight: 500 }}>从内容创作配置生成任务</div>
              <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", marginTop: 4 }}>
                根据已启用的创作主题自动生成心跳任务
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  const count = await generateContentCreatorTasks();
                  if (count > 0) {
                    toast.success(`已生成 ${count} 个内容创作任务`);
                    const newTasks = await getHeartbeatTasks().catch(() => []);
                    setTasks(newTasks);
                  } else {
                    toast.info("没有可生成的任务，请先启用内容创作主题");
                  }
                } catch (e) {
                  toast.error(`生成失败: ${e instanceof Error ? e.message : e}`);
                }
              }}
            >
              生成
            </Button>
          </div>

          {templates.map((tmpl) => (
            <div
              key={tmpl.id}
              style={{
                padding: 16,
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{tmpl.name}</div>
                <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", marginTop: 4 }}>
                  {tmpl.description}
                </div>
                <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginTop: 4 }}>
                  {tmpl.tasks.length} 个任务 · 推荐间隔:{" "}
                  {tmpl.recommended_interval >= 86400
                    ? `${tmpl.recommended_interval / 86400} 天`
                    : tmpl.recommended_interval >= 3600
                      ? `${tmpl.recommended_interval / 3600} 小时`
                      : `${tmpl.recommended_interval / 60} 分钟`}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => handleApplyTemplate(tmpl.id)}>
                应用
              </Button>
            </div>
          ))}
        </div>
      )}
      {/* ===== 执行历史 ===== */}
      {activeTab === "history" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <History size={16} />
            <span style={{ fontWeight: 500 }}>执行历史</span>
          </div>
          {history.length === 0 ? (
            <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", padding: 16 }}>
              暂无执行记录。
            </div>
          ) : (
            history.map((exec) => (
              <div
                key={exec.id}
                style={{
                  padding: 12,
                  borderRadius: 6,
                  border: "1px solid hsl(var(--border))",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 14 }}>{exec.task_description}</div>
                  <span
                    style={{
                      fontSize: 12,
                      padding: "2px 8px",
                      borderRadius: 4,
                      background:
                        exec.status === "success"
                          ? "hsl(var(--chart-2) / 0.15)"
                          : exec.status === "failed"
                            ? "hsl(var(--destructive) / 0.15)"
                            : exec.status === "running"
                              ? "hsl(var(--chart-4) / 0.15)"
                              : "hsl(var(--muted))",
                      color:
                        exec.status === "success"
                          ? "hsl(var(--chart-2))"
                          : exec.status === "failed"
                            ? "hsl(var(--destructive))"
                            : "hsl(var(--foreground))",
                    }}
                  >
                    {exec.status === "success" && "成功"}
                    {exec.status === "failed" && "失败"}
                    {exec.status === "running" && "运行中"}
                    {exec.status === "timeout" && "超时"}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                  {new Date(exec.started_at).toLocaleString()}
                  {exec.duration_ms != null && ` · 耗时: ${exec.duration_ms}ms`}
                  {exec.retry_count > 0 && ` · 重试: ${exec.retry_count} 次`}
                </div>
                {exec.output && (
                  <div
                    style={{
                      fontSize: 12,
                      padding: 8,
                      borderRadius: 4,
                      background: "hsl(var(--muted))",
                      whiteSpace: "pre-wrap",
                      maxHeight: 120,
                      overflow: "auto",
                    }}
                  >
                    {exec.output}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      <Dialog
        open={!!selectedRiskTask}
        onOpenChange={(open) => {
          if (!open) setSelectedRiskTask(null);
        }}
      >
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>高风险任务详情</DialogTitle>
            <DialogDescription>用于排查失败趋势和治理状态</DialogDescription>
          </DialogHeader>
          {selectedRiskTask && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                fontSize: 13,
                color: "hsl(var(--muted-foreground))",
              }}
            >
              <div>任务名：{selectedRiskTask.name}</div>
              <div>任务 ID：{selectedRiskTask.taskId}</div>
              <div>状态：{selectedRiskTask.status}</div>
              <div>连续失败：{selectedRiskTask.consecutiveFailures}</div>
              <div>重试次数：{selectedRiskTask.retryCount}</div>
              <div>
                冷却截止：
                {selectedRiskTask.autoDisabledUntil
                  ? new Date(selectedRiskTask.autoDisabledUntil).toLocaleString()
                  : "无"}
              </div>
              <div>
                更新时间：
                {selectedRiskTask.updatedAt
                  ? new Date(selectedRiskTask.updatedAt).toLocaleString()
                  : "-"}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FailureTrendChart({
  data,
}: {
  data: HeartbeatTaskHealth["failureTrend24h"];
}) {
  const points = data.slice(-24);
  const maxCount = Math.max(
    1,
    ...points.map((item) => item.errorCount + item.timeoutCount),
  );

  return (
    <div
      style={{
        padding: 10,
        borderRadius: 6,
        background: "hsl(var(--muted))",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 500 }}>最近 24h 失败趋势（error + timeout）</div>
      <div style={{ display: "flex", alignItems: "end", gap: 4, height: 84 }}>
        {points.map((item) => {
          const total = item.errorCount + item.timeoutCount;
          const height = total > 0 ? Math.max(6, Math.round((total / maxCount) * 72)) : 4;
          return (
            <div
              key={item.bucketStart}
              title={`${item.label} 失败 ${total}（error=${item.errorCount}, timeout=${item.timeoutCount}）`}
              style={{
                flex: 1,
                minWidth: 4,
                height,
                borderRadius: 3,
                background:
                  item.timeoutCount > 0
                    ? "hsl(var(--destructive) / 0.75)"
                    : "hsl(var(--destructive) / 0.45)",
              }}
            />
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: "hsl(var(--muted-foreground))",
        }}
      >
        <span>{points[0]?.label ?? "-"}</span>
        <span>{points[points.length - 1]?.label ?? "-"}</span>
      </div>
    </div>
  );
}

// ===== 内联任务编辑表单 =====

interface TaskFormData {
  description: string;
  priority: string;
  timeoutSecs: string;
  once: boolean;
  model: string;
}

function TaskInlineForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: { description: string; priority: number | null; timeout_secs: number | null; once: boolean; model: string | null };
  onSave: (data: TaskFormData) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<TaskFormData>({
    description: initial?.description ?? "",
    priority: initial?.priority != null ? String(initial.priority) : "",
    timeoutSecs: initial?.timeout_secs != null ? String(initial.timeout_secs) : "",
    once: initial?.once ?? false,
    model: initial?.model ?? "",
  });

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 6,
        border: "1px solid hsl(var(--primary) / 0.3)",
        background: "hsl(var(--muted) / 0.3)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <Input
        placeholder="任务描述"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        autoFocus
      />
      <div style={{ display: "flex", gap: 8 }}>
        <Input
          placeholder="优先级 (1-10)"
          type="number"
          min={1}
          max={10}
          value={form.priority}
          onChange={(e) => setForm({ ...form, priority: e.target.value })}
          style={{ width: 100 }}
        />
        <Input
          placeholder="超时 (秒)"
          type="number"
          min={0}
          value={form.timeoutSecs}
          onChange={(e) => setForm({ ...form, timeoutSecs: e.target.value })}
          style={{ width: 100 }}
        />
        <Input
          placeholder="模型 (可选)"
          value={form.model}
          onChange={(e) => setForm({ ...form, model: e.target.value })}
          style={{ width: 150 }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="checkbox"
            checked={form.once}
            onChange={(e) => setForm({ ...form, once: e.target.checked })}
          />
          <span style={{ fontSize: 12 }}>一次性</span>
        </div>
        <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            <X size={14} />
          </Button>
          <Button
            size="sm"
            onClick={() => onSave(form)}
            disabled={!form.description.trim()}
          >
            <Check size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ===== 任务面板（含增删改） =====

function TasksPanel({
  tasks,
  onRefresh,
}: {
  tasks: HeartbeatTaskPreview[];
  onRefresh: () => Promise<void>;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  const handleAdd = async (data: TaskFormData) => {
    try {
      await addHeartbeatTask(
        data.description.trim(),
        data.priority ? Number(data.priority) : undefined,
        data.timeoutSecs ? Number(data.timeoutSecs) : undefined,
        data.once || undefined,
        data.model || undefined,
      );
      toast.success("任务已添加");
      setAdding(false);
      await onRefresh();
    } catch (e) {
      toast.error(`添加失败: ${e instanceof Error ? e.message : e}`);
    }
  };

  const handleUpdate = async (index: number, data: TaskFormData) => {
    try {
      await updateHeartbeatTask(
        index,
        data.description.trim(),
        data.priority ? Number(data.priority) : undefined,
        data.timeoutSecs ? Number(data.timeoutSecs) : undefined,
        data.once || undefined,
        data.model || undefined,
      );
      toast.success("任务已更新");
      setEditingIndex(null);
      await onRefresh();
    } catch (e) {
      toast.error(`更新失败: ${e instanceof Error ? e.message : e}`);
    }
  };

  const handleDelete = async (index: number) => {
    try {
      await deleteHeartbeatTask(index);
      toast.success("任务已删除");
      await onRefresh();
    } catch (e) {
      toast.error(`删除失败: ${e instanceof Error ? e.message : e}`);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FileText size={16} />
          <span style={{ fontWeight: 500 }}>HEARTBEAT.md 中的任务</span>
        </div>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => { setAdding(true); setEditingIndex(null); }}>
            <Plus size={14} style={{ marginRight: 4 }} />
            添加任务
          </Button>
        )}
      </div>

      {tasks.length === 0 && !adding && (
        <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", padding: 16 }}>
          暂无任务。点击"添加任务"或使用任务模板。
        </div>
      )}

      {tasks.map((task, i) =>
        editingIndex === i ? (
          <TaskInlineForm
            key={i}
            initial={task}
            onSave={(data) => handleUpdate(i, data)}
            onCancel={() => setEditingIndex(null)}
          />
        ) : (
          <div
            key={i}
            style={{
              padding: 12,
              borderRadius: 6,
              border: "1px solid hsl(var(--border))",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14 }}>{task.description}</div>
              <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginTop: 4 }}>
                {task.priority != null && `优先级: ${task.priority}`}
                {task.timeout_secs != null && ` · 超时: ${task.timeout_secs}s`}
                {task.once && ` · 一次性`}
                {task.model && ` · 模型: ${task.model}`}
              </div>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <Button size="sm" variant="ghost" onClick={() => { setEditingIndex(i); setAdding(false); }}>
                <Pencil size={14} />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleDelete(i)}>
                <Trash2 size={14} />
              </Button>
            </div>
          </div>
        ),
      )}

      {adding && (
        <TaskInlineForm onSave={handleAdd} onCancel={() => setAdding(false)} />
      )}
    </div>
  );
}

// ===== 调度类型选择器 =====

const SCHEDULE_TYPES = [
  { value: "every", label: "固定间隔" },
  { value: "cron", label: "Cron 表达式" },
  { value: "at", label: "指定时间" },
];

const INTERVAL_OPTIONS = [
  { value: 300, label: "5 分钟" },
  { value: 600, label: "10 分钟" },
  { value: 900, label: "15 分钟" },
  { value: 1800, label: "30 分钟" },
  { value: 3600, label: "1 小时" },
  { value: 86400, label: "24 小时" },
];

function ScheduleSelector({
  schedule,
  intervalSecs,
  onChange,
}: {
  schedule?: TaskSchedule;
  intervalSecs: number;
  onChange: (schedule: TaskSchedule | undefined, intervalSecs: number) => void;
}) {
  const [scheduleType, setScheduleType] = useState<"every" | "cron" | "at">(
    schedule?.kind ?? "every"
  );
  const [cronExpr, setCronExpr] = useState(
    schedule?.kind === "cron" ? schedule.expr : "0 9 * * *"
  );
  const [cronTz, setCronTz] = useState(
    schedule?.kind === "cron" ? schedule.tz ?? "" : ""
  );
  const [atTime, setAtTime] = useState(
    schedule?.kind === "at" ? schedule.at : ""
  );
  const [nextRun, setNextRun] = useState<string | null>(null);

  // 预览下次执行时间
  useEffect(() => {
    const fetchPreview = async () => {
      let sched: TaskSchedule;
      if (scheduleType === "every") {
        sched = { kind: "every", every_secs: intervalSecs };
      } else if (scheduleType === "cron") {
        sched = { kind: "cron", expr: cronExpr, tz: cronTz || undefined };
      } else {
        sched = { kind: "at", at: atTime };
      }
      try {
        const preview = await previewSchedule(sched);
        setNextRun(preview);
      } catch {
        setNextRun(null);
      }
    };
    fetchPreview();
  }, [scheduleType, intervalSecs, cronExpr, cronTz, atTime]);

  const handleTypeChange = (type: "every" | "cron" | "at") => {
    setScheduleType(type);
    if (type === "every") {
      onChange(undefined, intervalSecs);
    } else if (type === "cron") {
      onChange({ kind: "cron", expr: cronExpr, tz: cronTz || undefined }, intervalSecs);
    } else {
      onChange({ kind: "at", at: atTime }, intervalSecs);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 500 }}>调度类型</div>
          <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))" }}>
            选择任务执行的调度方式
          </div>
        </div>
        <Select
          value={scheduleType}
          onValueChange={(v) => handleTypeChange(v as "every" | "cron" | "at")}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCHEDULE_TYPES.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {scheduleType === "every" && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 500 }}>执行间隔</div>
          </div>
          <Select
            value={String(intervalSecs)}
            onValueChange={(v) => onChange(undefined, Number(v))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERVAL_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {scheduleType === "cron" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <Input
              placeholder="Cron 表达式 (如 0 9 * * *)"
              value={cronExpr}
              onChange={(e) => {
                setCronExpr(e.target.value);
                onChange({ kind: "cron", expr: e.target.value, tz: cronTz || undefined }, intervalSecs);
              }}
              style={{ flex: 1 }}
            />
            <Input
              placeholder="时区 (可选)"
              value={cronTz}
              onChange={(e) => {
                setCronTz(e.target.value);
                onChange({ kind: "cron", expr: cronExpr, tz: e.target.value || undefined }, intervalSecs);
              }}
              style={{ width: 150 }}
            />
          </div>
          <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
            格式: 分 时 日 月 周 (如 "0 9 * * *" 表示每天 9:00)
          </div>
        </div>
      )}

      {scheduleType === "at" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Input
            type="datetime-local"
            value={atTime ? atTime.slice(0, 16) : ""}
            onChange={(e) => {
              const isoTime = e.target.value ? new Date(e.target.value).toISOString() : "";
              setAtTime(isoTime);
              onChange({ kind: "at", at: isoTime }, intervalSecs);
            }}
          />
          <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
            一次性任务，执行后自动停止
          </div>
        </div>
      )}

      {nextRun && (
        <div style={{ fontSize: 12, color: "hsl(var(--chart-2))" }}>
          下次执行: {new Date(nextRun).toLocaleString()}
        </div>
      )}
    </div>
  );
}

// ===== 通知设置组件 =====

function DeliverySettings({
  delivery,
  onChange,
}: {
  delivery: DeliveryConfig;
  onChange: (delivery: DeliveryConfig) => void;
}) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 8,
        border: "1px solid hsl(var(--border))",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ fontWeight: 500 }}>通知设置</div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 14 }}>启用通知</div>
          <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
            任务完成后发送通知
          </div>
        </div>
        <Switch
          checked={delivery.mode === "announce"}
          onCheckedChange={(checked) =>
            onChange({ ...delivery, mode: checked ? "announce" : "none" })
          }
        />
      </div>

      {delivery.mode === "announce" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 14 }}>通知渠道</div>
            <Select
              value={delivery.channel ?? "webhook"}
              onValueChange={(v) =>
                onChange({ ...delivery, channel: v as "webhook" | "telegram" })
              }
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="webhook">Webhook</SelectItem>
                <SelectItem value="telegram">Telegram</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 14 }}>
              {delivery.channel === "telegram" ? "Bot Token:Chat ID" : "Webhook URL"}
            </div>
            <Input
              placeholder={
                delivery.channel === "telegram"
                  ? "123456:ABC-DEF:chat_id"
                  : "https://example.com/webhook"
              }
              value={delivery.target ?? ""}
              onChange={(e) => onChange({ ...delivery, target: e.target.value })}
            />
            {delivery.channel === "telegram" && (
              <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                格式: bot_token:chat_id
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14 }}>尽力投递</div>
              <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                投递失败不影响任务状态
              </div>
            </div>
            <Switch
              checked={delivery.best_effort}
              onCheckedChange={(checked) =>
                onChange({ ...delivery, best_effort: checked })
              }
            />
          </div>
        </>
      )}
    </div>
  );
}
