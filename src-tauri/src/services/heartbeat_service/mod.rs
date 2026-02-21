//! 心跳引擎服务
//!
//! 提供 HEARTBEAT.md 任务解析、智能执行、技能调用和任务模板管理。
//! 支持灵活调度（固定间隔、Cron 表达式、指定时间点）和通知投递。

pub mod delivery;
pub mod engine;
pub mod schedule;
pub mod templates;

use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};

use chrono::Utc;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use tokio_util::sync::CancellationToken;

use crate::database::dao::agent_run::AgentRunStatus;
use crate::services::execution_tracker_service::{ExecutionTracker, RunSource};
use proxycast_core::config::{HeartbeatExecutionMode, HeartbeatSettings, TaskSchedule};
use proxycast_core::database::dao::heartbeat::{HeartbeatDao, HeartbeatExecution};
use proxycast_core::database::DbConnection;
use tauri::{Emitter, Manager};

use self::delivery::{deliver_cycle_summary, deliver_result, TaskResult};
use self::engine::{HeartbeatEngine, HeartbeatTask};
use self::schedule::{next_run_for_schedule, preview_next_run, validate_schedule};

// ============ 状态类型 ============

/// HeartbeatService 的 Tauri managed state
#[derive(Clone)]
pub struct HeartbeatServiceState(pub Arc<RwLock<HeartbeatService>>);

/// 心跳引擎运行状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeartbeatStatus {
    pub running: bool,
    pub last_run: Option<String>,
    pub next_run: Option<String>,
    pub last_task_count: usize,
    pub total_executions: u64,
    pub current_task: Option<String>,
    pub schedule_description: Option<String>,
}

/// 任务预览（前端展示用）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeartbeatTaskPreview {
    pub description: String,
    pub priority: Option<u8>,
    pub timeout_secs: Option<u64>,
    pub once: bool,
    pub model: Option<String>,
}

/// 任务执行结果
#[derive(Debug)]
pub struct TaskExecutionResult {
    pub status: ExecutionStatus,
    pub output: String,
    pub duration_ms: i64,
}

#[derive(Debug)]
pub enum ExecutionStatus {
    Success,
    Failed,
    Timeout,
}

/// 一次心跳周期的汇总结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CycleResult {
    pub task_count: usize,
    pub success_count: usize,
    pub failed_count: usize,
    pub timeout_count: usize,
}

// ============ HeartbeatService ============

pub struct HeartbeatService {
    config: HeartbeatSettings,
    cancel_token: Option<CancellationToken>,
    status: HeartbeatStatus,
    db: Option<DbConnection>,
    app_handle: Option<tauri::AppHandle>,
}

impl HeartbeatService {
    pub fn new(config: HeartbeatSettings) -> Self {
        let schedule_description = config.schedule.as_ref().map(schedule::describe_schedule);
        Self {
            config,
            cancel_token: None,
            status: HeartbeatStatus {
                running: false,
                last_run: None,
                next_run: None,
                last_task_count: 0,
                total_executions: 0,
                current_task: None,
                schedule_description,
            },
            db: None,
            app_handle: None,
        }
    }

    pub fn set_db(&mut self, db: DbConnection) {
        self.db = Some(db);
    }

    pub fn set_app_handle(&mut self, handle: tauri::AppHandle) {
        self.app_handle = Some(handle);
    }

    pub fn update_config(&mut self, config: HeartbeatSettings) {
        self.config = config;
    }

    pub fn get_config(&self) -> &HeartbeatSettings {
        &self.config
    }

    /// 启动心跳循环
    pub async fn start(
        &mut self,
        app_data_dir: PathBuf,
        self_ref: Arc<RwLock<HeartbeatService>>,
    ) -> Result<(), String> {
        if self.status.running {
            return Ok(());
        }

        // 验证调度配置
        if let Some(ref schedule) = self.config.schedule {
            if let Err(e) = validate_schedule(schedule, Utc::now()) {
                return Err(format!("调度配置无效: {}", e));
            }
        }

        // 自动创建 HEARTBEAT.md 文件（如果不存在）
        let task_file = app_data_dir.join(&self.config.task_file);
        let engine = HeartbeatEngine::new(task_file);
        if let Ok(created) = engine.ensure_file_exists() {
            if created {
                tracing::info!("[Heartbeat] 已创建默认任务文件");
            }
        }

        let cancel_token = CancellationToken::new();
        self.cancel_token = Some(cancel_token.clone());
        self.status.running = true;

        // 计算并设置下次执行时间
        self.update_next_run();

        let config = self.config.clone();
        let db = self.db.clone();
        let app_handle = self.app_handle.clone();

        tokio::spawn(async move {
            Self::run_loop(config, db, app_handle, cancel_token, app_data_dir, self_ref).await;
        });

        let schedule_desc = self
            .config
            .schedule
            .as_ref()
            .map(schedule::describe_schedule)
            .unwrap_or_else(|| format!("每 {} 秒", self.config.interval_secs));
        tracing::info!("[Heartbeat] 心跳引擎已启动，调度: {}", schedule_desc);
        Ok(())
    }

    /// 更新下次执行时间
    fn update_next_run(&mut self) {
        let schedule = self.config.schedule.clone().unwrap_or(TaskSchedule::Every {
            every_secs: self.config.interval_secs,
        });

        self.status.next_run = preview_next_run(&schedule).ok().flatten();
        self.status.schedule_description = Some(schedule::describe_schedule(&schedule));
    }

    async fn run_loop(
        config: HeartbeatSettings,
        db: Option<DbConnection>,
        app_handle: Option<tauri::AppHandle>,
        cancel_token: CancellationToken,
        app_data_dir: PathBuf,
        self_ref: Arc<RwLock<HeartbeatService>>,
    ) {
        // 获取有效的调度配置
        let schedule = config.schedule.clone().unwrap_or(TaskSchedule::Every {
            every_secs: config.interval_secs.max(300),
        });

        loop {
            // 计算下次执行时间
            let now = Utc::now();
            let next_run = match next_run_for_schedule(&schedule, now) {
                Ok(Some(next)) => next,
                Ok(None) => {
                    // At 类型已过期，停止循环
                    tracing::info!("[Heartbeat] 一次性任务已完成，停止心跳循环");
                    let mut service = self_ref.write().await;
                    service.status.running = false;
                    service.status.next_run = None;
                    break;
                }
                Err(e) => {
                    tracing::error!("[Heartbeat] 计算下次执行时间失败: {}", e);
                    // 回退到默认间隔
                    now + chrono::Duration::seconds(300)
                }
            };

            // 更新状态中的下次执行时间
            {
                let mut service = self_ref.write().await;
                service.status.next_run = Some(next_run.to_rfc3339());
            }

            // 计算等待时间
            let wait_duration = (next_run - now)
                .to_std()
                .unwrap_or(Duration::from_secs(300));

            tracing::debug!(
                "[Heartbeat] 下次执行时间: {}, 等待 {} 秒",
                next_run.to_rfc3339(),
                wait_duration.as_secs()
            );

            // 等待直到下次执行时间或取消
            tokio::select! {
                _ = tokio::time::sleep(wait_duration) => {
                    let result = Self::execute_cycle(&config, &db, &app_handle, &app_data_dir).await;

                    // 发送周期汇总通知
                    if config.delivery.mode != "none" && result.task_count > 0 {
                        let delivery_result = deliver_cycle_summary(
                            &config.delivery,
                            result.task_count,
                            result.success_count,
                            result.failed_count,
                            result.timeout_count,
                        ).await;
                        if !delivery_result.success && !config.delivery.best_effort {
                            tracing::warn!("[Heartbeat] 通知投递失败: {}", delivery_result.message);
                        }
                    }

                    {
                        let mut service = self_ref.write().await;
                        service.update_status_after_cycle(&result);
                    }

                    // At 类型执行一次后停止
                    if matches!(schedule, TaskSchedule::At { .. }) {
                        tracing::info!("[Heartbeat] 一次性任务已执行，停止心跳循环");
                        let mut service = self_ref.write().await;
                        service.status.running = false;
                        service.status.next_run = None;
                        break;
                    }
                }
                _ = cancel_token.cancelled() => {
                    tracing::info!("[Heartbeat] 心跳循环已停止");
                    break;
                }
            }
        }
    }
    async fn execute_cycle(
        config: &HeartbeatSettings,
        db: &Option<DbConnection>,
        app_handle: &Option<tauri::AppHandle>,
        app_data_dir: &PathBuf,
    ) -> CycleResult {
        let task_file = app_data_dir.join(&config.task_file);
        let engine = HeartbeatEngine::new(task_file.clone());

        let tasks = match engine.collect_tasks() {
            Ok(t) => t,
            Err(e) => {
                tracing::warn!("[Heartbeat] 收集任务失败: {}", e);
                return CycleResult {
                    task_count: 0,
                    success_count: 0,
                    failed_count: 0,
                    timeout_count: 0,
                };
            }
        };

        if tasks.is_empty() {
            tracing::debug!("[Heartbeat] 无待执行任务");
            return CycleResult {
                task_count: 0,
                success_count: 0,
                failed_count: 0,
                timeout_count: 0,
            };
        }

        tracing::info!("[Heartbeat] 收集到 {} 个任务", tasks.len());

        let mut success_count: usize = 0;
        let mut failed_count: usize = 0;
        let mut timeout_count: usize = 0;
        let tracker = db.as_ref().map(|conn| ExecutionTracker::new(conn.clone()));

        for task in &tasks {
            // 发送事件：任务开始
            if let Some(ref handle) = app_handle {
                let _ = handle.emit("heartbeat:task_start", &task.description);
            }

            let start = Instant::now();
            let started_at = Utc::now().to_rfc3339();
            let run_handle = tracker.as_ref().and_then(|tracker| {
                tracker.start(
                    RunSource::Heartbeat,
                    Some(task.description.clone()),
                    None,
                    Some(serde_json::json!({
                        "priority": task.priority,
                        "timeout_secs": task.timeout.map(|d| d.as_secs()),
                        "once": task.once,
                        "model": task.model.clone(),
                        "execution_mode": format!("{:?}", config.execution_mode).to_lowercase(),
                    })),
                )
            });

            // Fix 3: 重试逻辑
            let max_attempts = config.max_retries.max(1); // 至少执行 1 次
            let mut result: Result<TaskExecutionResult, String> = Err("未执行".to_string());
            let mut retry_count: u32 = 0;

            for attempt in 0..max_attempts {
                if attempt > 0 {
                    tracing::info!(
                        "[Heartbeat] 重试任务 ({}/{}): {}",
                        attempt,
                        config.max_retries,
                        task.description
                    );
                }

                let exec = async {
                    match config.execution_mode {
                        HeartbeatExecutionMode::Intelligent => {
                            Self::execute_intelligent(task, app_handle).await
                        }
                        HeartbeatExecutionMode::Skill => {
                            Self::execute_skill(task, app_handle).await
                        }
                        HeartbeatExecutionMode::LogOnly => {
                            tracing::info!("[Heartbeat] 任务（仅记录）: {}", task.description);
                            Ok(TaskExecutionResult {
                                status: ExecutionStatus::Success,
                                output: "Log only mode".to_string(),
                                duration_ms: 0,
                            })
                        }
                    }
                };

                // Fix 4: 任务超时
                result = if let Some(timeout_duration) = task.timeout {
                    match tokio::time::timeout(timeout_duration, exec).await {
                        Ok(r) => r,
                        Err(_) => {
                            tracing::warn!(
                                "[Heartbeat] 任务超时（{}s）: {}",
                                timeout_duration.as_secs(),
                                task.description
                            );
                            Ok(TaskExecutionResult {
                                status: ExecutionStatus::Timeout,
                                output: format!("任务执行超时（{}s）", timeout_duration.as_secs()),
                                duration_ms: timeout_duration.as_millis() as i64,
                            })
                        }
                    }
                } else {
                    exec.await
                };

                // 判断是否需要重试（成功和超时不重试）
                let should_retry = match &result {
                    Ok(r) => matches!(r.status, ExecutionStatus::Failed),
                    Err(_) => true,
                };
                if !should_retry {
                    break;
                }
                retry_count = attempt + 1;
            }

            let elapsed = start.elapsed().as_millis() as i64;
            let (status_str, output_str) = match &result {
                Ok(r) => (
                    match r.status {
                        ExecutionStatus::Success => "success",
                        ExecutionStatus::Failed => "failed",
                        ExecutionStatus::Timeout => "timeout",
                    },
                    Some(r.output.as_str()),
                ),
                Err(e) => ("failed", Some(e.as_str())),
            };

            // 累计计数
            match status_str {
                "success" => success_count += 1,
                "failed" => failed_count += 1,
                "timeout" => timeout_count += 1,
                _ => failed_count += 1,
            }

            if let (Some(tracker), Some(handle)) = (tracker.as_ref(), run_handle.as_ref()) {
                let run_status = match status_str {
                    "success" => AgentRunStatus::Success,
                    "timeout" => AgentRunStatus::Timeout,
                    _ => AgentRunStatus::Error,
                };
                let error_code = match run_status {
                    AgentRunStatus::Error => Some("heartbeat_task_failed"),
                    AgentRunStatus::Timeout => Some("heartbeat_task_timeout"),
                    _ => None,
                };
                let error_message = if matches!(run_status, AgentRunStatus::Success) {
                    None
                } else {
                    output_str
                };
                tracker.finish_with_status(
                    handle,
                    run_status,
                    error_code,
                    error_message,
                    Some(serde_json::json!({
                        "task_description": task.description.clone(),
                        "execution_mode": format!("{:?}", config.execution_mode).to_lowercase(),
                        "status": status_str,
                        "duration_ms": elapsed,
                        "retry_count": retry_count,
                    })),
                );
            }

            // 保存执行记录
            if config.enable_history {
                if let Some(ref db) = db {
                    let exec = HeartbeatExecution {
                        id: 0,
                        task_description: task.description.clone(),
                        priority: task.priority,
                        execution_mode: format!("{:?}", config.execution_mode).to_lowercase(),
                        status: status_str.to_string(),
                        started_at: started_at.clone(),
                        completed_at: Some(Utc::now().to_rfc3339()),
                        duration_ms: Some(elapsed),
                        output: output_str.map(|s| s.to_string()),
                        retry_count,
                        metadata: None,
                    };
                    if let Ok(conn) = db.lock() {
                        if let Err(e) = HeartbeatDao::create_execution(&conn, &exec) {
                            tracing::warn!("[Heartbeat] 保存执行记录失败: {}", e);
                        }
                    }
                }
            }

            // 发送事件：任务完成
            if let Some(ref handle) = app_handle {
                let _ = handle.emit(
                    "heartbeat:task_complete",
                    serde_json::json!({
                        "description": task.description,
                        "status": status_str,
                        "duration_ms": elapsed,
                        "retry_count": retry_count,
                    }),
                );
            }

            // 单任务通知投递（如果配置了）
            if config.delivery.mode != "none" {
                let task_result = TaskResult {
                    task: task.description.clone(),
                    status: status_str.to_string(),
                    output: output_str.unwrap_or("").to_string(),
                    duration_ms: elapsed,
                    timestamp: Utc::now().to_rfc3339(),
                };
                let delivery_result = deliver_result(&config.delivery, &task_result).await;
                if !delivery_result.success && !config.delivery.best_effort {
                    tracing::warn!(
                        "[Heartbeat] 任务 '{}' 通知投递失败: {}",
                        task.description,
                        delivery_result.message
                    );
                }
            }
        }

        // 移除已执行的一次性任务
        let once_tasks: Vec<_> = tasks
            .iter()
            .filter(|t| t.once)
            .map(|t| t.description.clone())
            .collect();
        if !once_tasks.is_empty() {
            let task_file = app_data_dir.join(&config.task_file);
            if let Ok(all_tasks) = HeartbeatEngine::new(task_file.clone()).collect_tasks() {
                let remaining: Vec<_> = all_tasks
                    .into_iter()
                    .filter(|t| !t.once || !once_tasks.contains(&t.description))
                    .collect();
                if let Err(e) = HeartbeatEngine::write_tasks(&task_file, &remaining) {
                    tracing::warn!("[Heartbeat] 移除一次性任务失败: {}", e);
                } else {
                    tracing::info!("[Heartbeat] 已移除 {} 个一次性任务", once_tasks.len());
                }
            }
        }

        CycleResult {
            task_count: tasks.len(),
            success_count,
            failed_count,
            timeout_count,
        }
    }

    /// 智能模式：通过 Aster Agent 执行任务
    async fn execute_intelligent(
        task: &HeartbeatTask,
        app_handle: &Option<tauri::AppHandle>,
    ) -> Result<TaskExecutionResult, String> {
        // 获取 AsterAgentState 并发送消息
        if let Some(ref handle) = app_handle {
            use crate::agent::AsterAgentState;
            use crate::database::DbConnection;

            let agent_state = handle.try_state::<AsterAgentState>();
            let db_state = handle.try_state::<DbConnection>();

            if let (Some(agent_state), Some(db)) = (agent_state, db_state) {
                let model_info = task
                    .model
                    .as_ref()
                    .map(|m| format!("\n使用模型：{}", m))
                    .unwrap_or_default();

                let prompt = format!(
                    "你是一个自动化任务执行助手。请执行以下心跳任务：\n\n{}\n\n优先级：{}{}{}请理解任务意图并完成任务。如果任务不明确或无法执行，请说明原因。",
                    task.description,
                    task.priority.unwrap_or(5),
                    model_info,
                    if model_info.is_empty() { "\n\n" } else { "\n\n" },
                );

                let session_id = format!("heartbeat-{}", Utc::now().timestamp());
                let event_name = format!("heartbeat:agent:{}", session_id);

                // TODO: 当 AsterAgentWrapper 支持模型覆盖时，传入 task.model
                match crate::agent::AsterAgentWrapper::send_message(
                    &agent_state,
                    &db,
                    handle,
                    prompt,
                    session_id,
                    event_name,
                )
                .await
                {
                    Ok(()) => {
                        return Ok(TaskExecutionResult {
                            status: ExecutionStatus::Success,
                            output: format!(
                                "Agent 执行完成{}",
                                task.model
                                    .as_ref()
                                    .map(|m| format!(" (模型: {})", m))
                                    .unwrap_or_default()
                            ),
                            duration_ms: 0,
                        });
                    }
                    Err(e) => {
                        tracing::warn!("[Heartbeat] Agent 执行失败，降级为日志模式: {}", e);
                        return Ok(TaskExecutionResult {
                            status: ExecutionStatus::Success,
                            output: format!("任务已记录（Agent 不可用: {}）", e),
                            duration_ms: 0,
                        });
                    }
                }
            }
        }

        // Agent 不可用，降级为日志模式
        tracing::warn!(
            "[Heartbeat] Agent 未初始化，任务 '{}' 降级为日志模式",
            task.description
        );
        Ok(TaskExecutionResult {
            status: ExecutionStatus::Success,
            output: "任务已记录（Agent 未初始化）".to_string(),
            duration_ms: 0,
        })
    }

    /// 技能模式：解析 skill:name 格式，通过 Agent 代理执行
    async fn execute_skill(
        task: &HeartbeatTask,
        app_handle: &Option<tauri::AppHandle>,
    ) -> Result<TaskExecutionResult, String> {
        let (skill_name, skill_args) =
            if let Some(stripped) = task.description.strip_prefix("skill:") {
                let parts: Vec<&str> = stripped.splitn(2, ' ').collect();
                (
                    parts[0].trim().to_string(),
                    parts
                        .get(1)
                        .map(|s| s.trim().to_string())
                        .unwrap_or_default(),
                )
            } else {
                (task.description.clone(), String::new())
            };

        tracing::info!(
            "[Heartbeat] 技能模式执行: {} (args: {})",
            skill_name,
            skill_args
        );

        // 通过 Agent 代理执行技能
        if let Some(ref handle) = app_handle {
            use crate::agent::AsterAgentState;
            use crate::database::DbConnection;

            let agent_state = handle.try_state::<AsterAgentState>();
            let db_state = handle.try_state::<DbConnection>();

            if let (Some(agent_state), Some(db)) = (agent_state, db_state) {
                let prompt = format!(
                    "你是一个技能执行助手。请执行以下技能任务：\n\n技能名称：{}\n参数：{}\n\n请理解技能意图并完成任务。",
                    skill_name,
                    if skill_args.is_empty() { "无".to_string() } else { skill_args.clone() },
                );

                let session_id = format!("heartbeat-skill-{}", Utc::now().timestamp());
                let event_name = format!("heartbeat:agent:{}", session_id);

                match crate::agent::AsterAgentWrapper::send_message(
                    &agent_state,
                    &db,
                    handle,
                    prompt,
                    session_id,
                    event_name,
                )
                .await
                {
                    Ok(()) => {
                        return Ok(TaskExecutionResult {
                            status: ExecutionStatus::Success,
                            output: format!("技能 '{}' 已通过 Agent 执行", skill_name),
                            duration_ms: 0,
                        });
                    }
                    Err(e) => {
                        tracing::warn!("[Heartbeat] Agent 执行技能失败，降级为日志模式: {}", e);
                        return Ok(TaskExecutionResult {
                            status: ExecutionStatus::Success,
                            output: format!("技能 '{}' 已记录（Agent 不可用: {}）", skill_name, e),
                            duration_ms: 0,
                        });
                    }
                }
            }
        }

        // Agent 不可用，降级为日志模式
        tracing::warn!(
            "[Heartbeat] Agent 未初始化，技能 '{}' 降级为日志模式",
            skill_name
        );
        Ok(TaskExecutionResult {
            status: ExecutionStatus::Success,
            output: format!("技能 '{}' 已记录（Agent 未初始化）", skill_name),
            duration_ms: 0,
        })
    }

    /// 停止心跳循环
    pub async fn stop(&mut self) -> Result<(), String> {
        if let Some(token) = self.cancel_token.take() {
            token.cancel();
        }
        self.status.running = false;
        tracing::info!("[Heartbeat] 心跳引擎已停止");
        Ok(())
    }

    pub fn get_status(&self) -> HeartbeatStatus {
        self.status.clone()
    }

    /// 预览当前 HEARTBEAT.md 中的任务
    pub fn preview_tasks(
        &self,
        app_data_dir: &PathBuf,
    ) -> Result<Vec<HeartbeatTaskPreview>, String> {
        let task_file = app_data_dir.join(&self.config.task_file);
        let engine = HeartbeatEngine::new(task_file);
        let tasks = engine.collect_tasks().map_err(|e| e.to_string())?;
        Ok(tasks
            .into_iter()
            .map(|t| HeartbeatTaskPreview {
                description: t.description,
                priority: t.priority,
                timeout_secs: t.timeout.map(|d| d.as_secs()),
                once: t.once,
                model: t.model,
            })
            .collect())
    }

    /// 读取原始任务列表（不排序，保持文件顺序）
    fn read_raw_tasks(&self, app_data_dir: &PathBuf) -> Result<Vec<HeartbeatTask>, String> {
        let task_file = app_data_dir.join(&self.config.task_file);
        let engine = HeartbeatEngine::new(task_file);
        engine.collect_tasks()
    }

    /// 添加任务
    pub fn add_task(
        &self,
        app_data_dir: &PathBuf,
        description: String,
        priority: Option<u8>,
        timeout_secs: Option<u64>,
        once: Option<bool>,
        model: Option<String>,
    ) -> Result<(), String> {
        let task_file = app_data_dir.join(&self.config.task_file);
        let mut tasks = self.read_raw_tasks(app_data_dir)?;
        tasks.push(HeartbeatTask {
            description,
            priority,
            timeout: timeout_secs.map(Duration::from_secs),
            once: once.unwrap_or(false),
            model,
        });
        HeartbeatEngine::write_tasks(&task_file, &tasks)
    }

    /// 删除任务
    pub fn delete_task(&self, app_data_dir: &PathBuf, index: usize) -> Result<(), String> {
        let task_file = app_data_dir.join(&self.config.task_file);
        let mut tasks = self.read_raw_tasks(app_data_dir)?;
        if index >= tasks.len() {
            return Err(format!(
                "任务索引越界: {} (共 {} 个任��)",
                index,
                tasks.len()
            ));
        }
        tasks.remove(index);
        HeartbeatEngine::write_tasks(&task_file, &tasks)
    }

    /// 更新任务
    pub fn update_task(
        &self,
        app_data_dir: &PathBuf,
        index: usize,
        description: String,
        priority: Option<u8>,
        timeout_secs: Option<u64>,
        once: Option<bool>,
        model: Option<String>,
    ) -> Result<(), String> {
        let task_file = app_data_dir.join(&self.config.task_file);
        let mut tasks = self.read_raw_tasks(app_data_dir)?;
        if index >= tasks.len() {
            return Err(format!(
                "任务索引越界: {} (共 {} 个任务)",
                index,
                tasks.len()
            ));
        }
        tasks[index] = HeartbeatTask {
            description,
            priority,
            timeout: timeout_secs.map(Duration::from_secs),
            once: once.unwrap_or(false),
            model,
        };
        HeartbeatEngine::write_tasks(&task_file, &tasks)
    }

    /// 获取执行历史
    pub fn get_execution_history(&self, limit: usize) -> Result<Vec<HeartbeatExecution>, String> {
        if let Some(ref db) = self.db {
            let conn = db.lock().map_err(|e| format!("数据库锁定失败: {}", e))?;
            HeartbeatDao::get_recent_executions(&conn, limit).map_err(|e| e.to_string())
        } else {
            Ok(vec![])
        }
    }

    /// 获取单条执行记录详情
    pub fn get_execution_detail(&self, id: i64) -> Result<Option<HeartbeatExecution>, String> {
        if let Some(ref db) = self.db {
            let conn = db.lock().map_err(|e| format!("数据库锁定失败: {}", e))?;
            HeartbeatDao::get_execution_by_id(&conn, id).map_err(|e| e.to_string())
        } else {
            Ok(None)
        }
    }

    /// 手动触发一次心跳
    pub async fn trigger_now(
        &self,
        app_data_dir: PathBuf,
        app_handle: Option<tauri::AppHandle>,
    ) -> CycleResult {
        let handle = if app_handle.is_some() {
            app_handle
        } else {
            self.app_handle.clone()
        };
        Self::execute_cycle(&self.config, &self.db, &handle, &app_data_dir).await
    }

    /// 根据 CycleResult 更新内部状态
    pub fn update_status_after_cycle(&mut self, result: &CycleResult) {
        self.status.last_run = Some(chrono::Utc::now().to_rfc3339());
        self.status.last_task_count = result.task_count;
        self.status.total_executions += 1;
        self.status.current_task = None;
        // 更新下次执行时间
        self.update_next_run();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use proxycast_core::config::{HeartbeatExecutionMode, HeartbeatSettings};
    use proxycast_core::database::dao::heartbeat::HeartbeatDao;
    use proxycast_core::database::schema::create_tables;
    use std::sync::{Arc, Mutex};
    use tempfile::TempDir;

    fn make_test_db() -> proxycast_core::database::DbConnection {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        create_tables(&conn).unwrap();
        Arc::new(Mutex::new(conn))
    }

    fn make_log_only_config() -> HeartbeatSettings {
        HeartbeatSettings {
            enabled: true,
            interval_secs: 300,
            schedule: None,
            task_file: "HEARTBEAT.md".to_string(),
            execution_mode: HeartbeatExecutionMode::LogOnly,
            enable_history: true,
            max_retries: 1,
            delivery: proxycast_core::config::DeliveryConfig::default(),
            security: proxycast_core::config::HeartbeatSecurityConfig::default(),
        }
    }

    /// 模板应用 → 写入 HEARTBEAT.md → engine 能解析出任务
    #[test]
    fn test_apply_template_then_parse() {
        let tmp = TempDir::new().unwrap();
        let app_data_dir = tmp.path().to_path_buf();

        let template = templates::TaskTemplateRegistry::get_template_by_id("daily_blog_post")
            .expect("模板应存在");
        assert!(!template.tasks.is_empty());

        templates::TaskTemplateRegistry::apply_template(&template, &app_data_dir).unwrap();

        // 验证文件已写入
        let heartbeat_file = app_data_dir.join("HEARTBEAT.md");
        assert!(heartbeat_file.exists(), "HEARTBEAT.md 应已创建");

        // 验证 engine 能解析出相同数量的任务
        let engine = engine::HeartbeatEngine::new(heartbeat_file);
        let tasks = engine.collect_tasks().unwrap();
        assert_eq!(
            tasks.len(),
            template.tasks.len(),
            "解析出的任务数应与模板任务数一致"
        );
    }

    /// execute_cycle (log_only) 端到端：文件 → 执行 → DB 记录
    #[tokio::test]
    async fn test_execute_cycle_log_only_writes_history() {
        let tmp = TempDir::new().unwrap();
        let app_data_dir = tmp.path().to_path_buf();
        let db = make_test_db();
        let config = make_log_only_config();

        // 写入任务文件
        let task_content = "- 测试任务A [priority:8]\n- 测试任务B\n";
        std::fs::write(app_data_dir.join("HEARTBEAT.md"), task_content).unwrap();

        // 执行
        let result =
            HeartbeatService::execute_cycle(&config, &Some(db.clone()), &None, &app_data_dir).await;

        // 验证 CycleResult
        assert_eq!(result.task_count, 2, "应有 2 个任务");
        assert_eq!(result.success_count, 2, "应有 2 个成功");
        assert_eq!(result.failed_count, 0);
        assert_eq!(result.timeout_count, 0);

        // 验证 DB 中有 2 条记录
        let conn = db.lock().unwrap();
        let records = HeartbeatDao::get_recent_executions(&conn, 10).unwrap();
        assert_eq!(records.len(), 2, "应有 2 条执行记录");

        // 验证记录内容
        for rec in &records {
            assert_eq!(rec.status, "success");
            assert_eq!(rec.execution_mode, "logonly");
            assert_eq!(rec.output.as_deref(), Some("Log only mode"));
            assert_eq!(rec.retry_count, 0);
        }
    }

    /// 无任务文件时 execute_cycle 不崩溃、不写记录
    #[tokio::test]
    async fn test_execute_cycle_no_file_is_noop() {
        let tmp = TempDir::new().unwrap();
        let app_data_dir = tmp.path().to_path_buf();
        let db = make_test_db();
        let config = make_log_only_config();

        // 不创建 HEARTBEAT.md
        let result =
            HeartbeatService::execute_cycle(&config, &Some(db.clone()), &None, &app_data_dir).await;

        assert_eq!(result.task_count, 0, "无任务文件时 task_count 应为 0");

        let conn = db.lock().unwrap();
        let records = HeartbeatDao::get_recent_executions(&conn, 10).unwrap();
        assert_eq!(records.len(), 0, "无任务文件时不应有执行记录");
    }

    /// 空任务文件时 execute_cycle 不崩溃、不写记录
    #[tokio::test]
    async fn test_execute_cycle_empty_file_is_noop() {
        let tmp = TempDir::new().unwrap();
        let app_data_dir = tmp.path().to_path_buf();
        let db = make_test_db();
        let config = make_log_only_config();

        std::fs::write(app_data_dir.join("HEARTBEAT.md"), "# 空文件\n").unwrap();

        let result =
            HeartbeatService::execute_cycle(&config, &Some(db.clone()), &None, &app_data_dir).await;

        assert_eq!(result.task_count, 0, "空任务文件时 task_count 应为 0");

        let conn = db.lock().unwrap();
        let records = HeartbeatDao::get_recent_executions(&conn, 10).unwrap();
        assert_eq!(records.len(), 0, "空任务文件时不应有执行记录");
    }

    /// 完整链路：模板应用 → trigger_now → DB 有记录
    #[tokio::test]
    async fn test_full_pipeline_template_to_execution() {
        let tmp = TempDir::new().unwrap();
        let app_data_dir = tmp.path().to_path_buf();
        let db = make_test_db();

        // 1. 应用模板
        let template = templates::TaskTemplateRegistry::get_template_by_id("project_health_check")
            .expect("模板应存在");
        templates::TaskTemplateRegistry::apply_template(&template, &app_data_dir).unwrap();

        // 2. 创建 service 并 trigger
        let mut service = HeartbeatService::new(make_log_only_config());
        service.set_db(db.clone());
        // 不设置 app_handle，模拟用户未启动引擎的场景
        let result = service.trigger_now(app_data_dir, None).await;

        // 验证 CycleResult
        assert_eq!(
            result.task_count,
            template.tasks.len(),
            "task_count 应与模板任务数一致"
        );
        assert_eq!(result.success_count, template.tasks.len(), "所有任务应成功");

        // 3. 验证 DB 记录数 == 模板任务数
        let conn = db.lock().unwrap();
        let records = HeartbeatDao::get_recent_executions(&conn, 50).unwrap();
        assert_eq!(
            records.len(),
            template.tasks.len(),
            "执行记录数应与模板任务数一致"
        );
        for rec in &records {
            assert_eq!(rec.status, "success");
        }
    }

    /// trigger_now 优先使用外部传入的 app_handle（None 回退到 self）
    #[tokio::test]
    async fn test_trigger_now_falls_back_to_self_handle() {
        let tmp = TempDir::new().unwrap();
        let app_data_dir = tmp.path().to_path_buf();
        let db = make_test_db();

        std::fs::write(app_data_dir.join("HEARTBEAT.md"), "- 回退测试\n").unwrap();

        let mut service = HeartbeatService::new(make_log_only_config());
        service.set_db(db.clone());
        // self.app_handle = None, 传入也是 None → 应该仍能执行 log_only
        let result = service.trigger_now(app_data_dir, None).await;

        assert_eq!(result.task_count, 1);
        assert_eq!(result.success_count, 1);

        let conn = db.lock().unwrap();
        let records = HeartbeatDao::get_recent_executions(&conn, 10).unwrap();
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].status, "success");
    }

    /// update_status_after_cycle 正确更新 status 字段
    #[test]
    fn test_update_status_after_cycle() {
        let mut service = HeartbeatService::new(make_log_only_config());
        assert_eq!(service.status.total_executions, 0);
        assert!(service.status.last_run.is_none());

        let result = CycleResult {
            task_count: 3,
            success_count: 2,
            failed_count: 1,
            timeout_count: 0,
        };
        service.update_status_after_cycle(&result);

        assert_eq!(service.status.total_executions, 1);
        assert_eq!(service.status.last_task_count, 3);
        assert!(service.status.last_run.is_some());
        assert!(service.status.current_task.is_none());

        // 再执行一次
        service.update_status_after_cycle(&result);
        assert_eq!(service.status.total_executions, 2);
    }

    /// add_task / delete_task / update_task 端到端
    #[test]
    fn test_task_crud_operations() {
        let tmp = TempDir::new().unwrap();
        let app_data_dir = tmp.path().to_path_buf();
        let service = HeartbeatService::new(make_log_only_config());

        // 添加
        service
            .add_task(&app_data_dir, "任务1".into(), Some(5), None, None, None)
            .unwrap();
        service
            .add_task(&app_data_dir, "任务2".into(), None, Some(60), None, None)
            .unwrap();
        let tasks = service.preview_tasks(&app_data_dir).unwrap();
        assert_eq!(tasks.len(), 2);

        // 更新
        service
            .update_task(
                &app_data_dir,
                0,
                "任务1-改".into(),
                Some(9),
                Some(120),
                None,
                None,
            )
            .unwrap();
        let tasks = service.preview_tasks(&app_data_dir).unwrap();
        // 排序后高优先级在前
        assert!(tasks
            .iter()
            .any(|t| t.description == "任务1-改" && t.priority == Some(9)));

        // 删除
        service.delete_task(&app_data_dir, 0).unwrap();
        let tasks = service.preview_tasks(&app_data_dir).unwrap();
        assert_eq!(tasks.len(), 1);

        // 越界检查
        assert!(service.delete_task(&app_data_dir, 99).is_err());
        assert!(service
            .update_task(&app_data_dir, 99, "x".into(), None, None, None, None)
            .is_err());
    }
}
