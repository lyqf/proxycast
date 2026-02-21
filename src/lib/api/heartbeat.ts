import { safeInvoke } from "@/lib/dev-bridge";

// 调度类型
export type TaskSchedule =
  | { kind: "every"; every_secs: number }
  | { kind: "cron"; expr: string; tz?: string }
  | { kind: "at"; at: string };

// 通知投递配置
export interface DeliveryConfig {
  mode: "none" | "announce";
  channel?: "webhook" | "telegram";
  target?: string;
  best_effort: boolean;
}

// 安全策略配置
export interface HeartbeatSecurityConfig {
  enabled: boolean;
  allowed_commands: string[];
  allowed_paths: string[];
}

export interface HeartbeatConfig {
  enabled: boolean;
  interval_secs: number;
  schedule?: TaskSchedule;
  task_file: string;
  execution_mode: "intelligent" | "skill" | "log_only";
  enable_history: boolean;
  max_retries: number;
  delivery: DeliveryConfig;
  security: HeartbeatSecurityConfig;
}

export interface HeartbeatStatus {
  running: boolean;
  last_run: string | null;
  next_run: string | null;
  last_task_count: number;
  total_executions: number;
  current_task: string | null;
  schedule_description: string | null;
}

export interface HeartbeatTaskPreview {
  description: string;
  priority: number | null;
  timeout_secs: number | null;
  once: boolean;
  model: string | null;
}

export interface HeartbeatExecution {
  id: number;
  task_description: string;
  priority: number | null;
  execution_mode: string;
  status: "running" | "success" | "failed" | "timeout";
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  output: string | null;
  retry_count: number;
  metadata: string | null;
}

export interface HeartbeatTaskHealthQuery {
  running_timeout_minutes?: number;
  top_limit?: number;
  cooldown_alert_threshold?: number;
  stale_running_alert_threshold?: number;
  failed_24h_alert_threshold?: number;
}

export interface HeartbeatRiskTaskInfo {
  taskId: string;
  name: string;
  status: string;
  consecutiveFailures: number;
  retryCount: number;
  autoDisabledUntil?: string;
  updatedAt: string;
}

export interface HeartbeatFailureTrendPoint {
  bucketStart: string;
  label: string;
  errorCount: number;
  timeoutCount: number;
}

export interface HeartbeatHealthAlert {
  code: string;
  severity: "info" | "warning" | "critical" | string;
  message: string;
  currentValue: number;
  threshold: number;
}

export interface HeartbeatTaskHealth {
  totalTasks: number;
  pendingTasks: number;
  runningTasks: number;
  completedTasks: number;
  failedTasks: number;
  cancelledTasks: number;
  cooldownTasks: number;
  staleRunningTasks: number;
  failedLast24h: number;
  failureTrend24h: HeartbeatFailureTrendPoint[];
  alerts: HeartbeatHealthAlert[];
  topRiskyTasks: HeartbeatRiskTaskInfo[];
  generatedAt: string;
}

export interface HeartbeatTaskHealthAlertDeliveryResult {
  delivered: boolean;
  alert_count: number;
  channel?: string;
  message: string;
}

export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tasks: string[];
  recommended_interval: number;
}

// 配置
export async function getHeartbeatConfig(): Promise<HeartbeatConfig> {
  return await safeInvoke("get_heartbeat_config");
}

export async function updateHeartbeatConfig(
  config: HeartbeatConfig,
): Promise<void> {
  return await safeInvoke("update_heartbeat_config", { config });
}

// 状态和任务
export async function getHeartbeatStatus(): Promise<HeartbeatStatus> {
  return await safeInvoke("get_heartbeat_status");
}

export async function getHeartbeatTasks(): Promise<HeartbeatTaskPreview[]> {
  return await safeInvoke("get_heartbeat_tasks");
}

// 任务增删改
export async function addHeartbeatTask(
  description: string,
  priority?: number,
  timeoutSecs?: number,
  once?: boolean,
  model?: string,
): Promise<void> {
  return await safeInvoke("add_heartbeat_task", {
    description,
    priority: priority ?? null,
    timeoutSecs: timeoutSecs ?? null,
    once: once ?? null,
    model: model ?? null,
  });
}

export async function deleteHeartbeatTask(index: number): Promise<void> {
  return await safeInvoke("delete_heartbeat_task", { index });
}

export async function updateHeartbeatTask(
  index: number,
  description: string,
  priority?: number,
  timeoutSecs?: number,
  once?: boolean,
  model?: string,
): Promise<void> {
  return await safeInvoke("update_heartbeat_task", {
    index,
    description,
    priority: priority ?? null,
    timeoutSecs: timeoutSecs ?? null,
    once: once ?? null,
    model: model ?? null,
  });
}

// 执行历史
export async function getHeartbeatHistory(
  limit: number = 50,
): Promise<HeartbeatExecution[]> {
  return await safeInvoke("get_heartbeat_history", { limit });
}

export async function getHeartbeatExecutionDetail(
  executionId: number,
): Promise<HeartbeatExecution | null> {
  return await safeInvoke("get_heartbeat_execution_detail", { executionId });
}

export async function getHeartbeatTaskHealth(
  query?: HeartbeatTaskHealthQuery,
): Promise<HeartbeatTaskHealth> {
  return await safeInvoke("get_heartbeat_task_health", {
    query: query ?? null,
  });
}

export async function deliverHeartbeatTaskHealthAlerts(
  query?: HeartbeatTaskHealthQuery,
): Promise<HeartbeatTaskHealthAlertDeliveryResult> {
  return await safeInvoke("deliver_heartbeat_task_health_alerts", {
    query: query ?? null,
  });
}

// 任务模板
export async function getTaskTemplates(): Promise<TaskTemplate[]> {
  return await safeInvoke("get_task_templates");
}

export async function applyTaskTemplate(templateId: string): Promise<void> {
  return await safeInvoke("apply_task_template", { templateId });
}

export interface CycleResult {
  task_count: number;
  success_count: number;
  failed_count: number;
  timeout_count: number;
}

// 手动触发
export async function triggerHeartbeatNow(): Promise<CycleResult> {
  return await safeInvoke("trigger_heartbeat_now");
}

// 内容创作集成
export async function generateContentCreatorTasks(): Promise<number> {
  return await safeInvoke("generate_content_creator_tasks");
}

// 调度预览
export async function previewSchedule(
  schedule: TaskSchedule,
): Promise<string | null> {
  return await safeInvoke("preview_heartbeat_schedule", { schedule });
}

// 验证调度配置
export async function validateSchedule(
  schedule: TaskSchedule,
): Promise<{ valid: boolean; error?: string }> {
  return await safeInvoke("validate_heartbeat_schedule", { schedule });
}
