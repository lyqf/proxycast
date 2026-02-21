//! Heartbeat Tool
//!
//! 为 Aster Agent 提供心跳任务管理能力，允许 AI 通过工具调用管理心跳系统。

use aster::tools::{Tool, ToolContext, ToolError, ToolResult};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::Arc;
use thiserror::Error;

/// Heartbeat 工具错误类型
#[derive(Debug, Error)]
pub enum HeartbeatToolError {
    #[error("服务未初始化")]
    ServiceNotInitialized,

    #[error("参数错误: {0}")]
    InvalidParams(String),

    #[error("执行失败: {0}")]
    ExecutionFailed(String),

    #[error("IO 错误: {0}")]
    IoError(String),
}

/// 心跳任务预览
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeartbeatTaskPreview {
    pub description: String,
    pub priority: Option<u8>,
    pub timeout_secs: Option<u64>,
    pub once: bool,
    pub model: Option<String>,
}

/// 心跳执行记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeartbeatExecutionRecord {
    pub id: i64,
    pub task_description: String,
    pub status: String,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub duration_ms: Option<i64>,
    pub output: Option<String>,
    pub retry_count: u32,
}

/// 心跳状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeartbeatStatus {
    pub running: bool,
    pub last_run: Option<String>,
    pub next_run: Option<String>,
    pub last_task_count: usize,
    pub total_executions: u64,
    pub schedule_description: Option<String>,
}

/// 心跳周期结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeartbeatCycleResult {
    pub task_count: usize,
    pub success_count: usize,
    pub failed_count: usize,
    pub timeout_count: usize,
}

/// Heartbeat 服务抽象 trait
///
/// 这样可以在测试时 mock，也可以避免直接依赖 Tauri 类型
#[async_trait]
pub trait HeartbeatService: Send + Sync {
    /// 获取心跳状态
    fn get_status(&self) -> Result<HeartbeatStatus, HeartbeatToolError>;

    /// 获取应用数据目录
    fn get_app_data_dir(&self) -> Result<PathBuf, HeartbeatToolError>;

    /// 预览任务列表
    fn preview_tasks(&self) -> Result<Vec<HeartbeatTaskPreview>, HeartbeatToolError>;

    /// 添加任务
    fn add_task(
        &self,
        description: String,
        priority: Option<u8>,
        timeout_secs: Option<u64>,
        once: Option<bool>,
        model: Option<String>,
    ) -> Result<(), HeartbeatToolError>;

    /// 删除任务
    fn delete_task(&self, index: usize) -> Result<(), HeartbeatToolError>;

    /// 更新任务
    fn update_task(
        &self,
        index: usize,
        description: String,
        priority: Option<u8>,
        timeout_secs: Option<u64>,
        once: Option<bool>,
        model: Option<String>,
    ) -> Result<(), HeartbeatToolError>;

    /// 获取执行历史
    fn get_history(
        &self,
        limit: usize,
    ) -> Result<Vec<HeartbeatExecutionRecord>, HeartbeatToolError>;

    /// 获取执行详情
    fn get_execution_detail(
        &self,
        id: i64,
    ) -> Result<Option<HeartbeatExecutionRecord>, HeartbeatToolError>;

    /// 手动触发执行
    async fn trigger_now(&self) -> Result<HeartbeatCycleResult, HeartbeatToolError>;
}

/// Heartbeat Tool 实现
pub struct HeartbeatTool {
    service: Arc<dyn HeartbeatService>,
}

impl HeartbeatTool {
    /// 创建新的 HeartbeatTool
    pub fn new(service: Arc<dyn HeartbeatService>) -> Self {
        Self { service }
    }

    /// 格式化任务列表为可读文本
    fn format_tasks(tasks: &[HeartbeatTaskPreview]) -> String {
        if tasks.is_empty() {
            return "当前没有心跳任务".to_string();
        }

        let mut lines = vec!["心跳任务列表:".to_string()];
        for (i, task) in tasks.iter().enumerate() {
            lines.push(format!("  [{}] {}", i, task.description));
            if let Some(priority) = task.priority {
                lines.push(format!("      优先级: {}", priority));
            }
            if let Some(timeout) = task.timeout_secs {
                lines.push(format!("      超时: {}秒", timeout));
            }
            if task.once {
                lines.push("      类型: 一次性任务".to_string());
            }
            if let Some(ref model) = task.model {
                lines.push(format!("      模型: {}", model));
            }
        }
        lines.join("\n")
    }

    /// 格式化执行历史为可读文本
    fn format_history(records: &[HeartbeatExecutionRecord]) -> String {
        if records.is_empty() {
            return "暂无执行历史".to_string();
        }

        let mut lines = vec![
            format!("执行历史 (共 {} 条):", records.len()),
            String::new(),
        ];

        for record in records {
            lines.push(format!("[{}] {}", record.id, record.task_description));
            lines.push(format!("  状态: {}", record.status));
            lines.push(format!("  开始: {}", record.started_at));

            if let Some(ref completed) = record.completed_at {
                lines.push(format!("  完成: {}", completed));
            }

            if let Some(duration) = record.duration_ms {
                lines.push(format!("  耗时: {}ms", duration));
            }

            if let Some(ref output) = record.output {
                let output_preview = if output.len() > 100 {
                    format!("{}...", &output[..100])
                } else {
                    output.clone()
                };
                lines.push(format!("  输出: {}", output_preview));
            }

            if record.retry_count > 0 {
                lines.push(format!("  重试: {} 次", record.retry_count));
            }

            lines.push(String::new());
        }

        lines.join("\n")
    }

    /// 格式化心跳状态为可读文本
    fn format_status(status: &HeartbeatStatus) -> String {
        let mut lines = vec!["心跳引擎状态:".to_string()];

        lines.push(format!(
            "  运行中: {}",
            if status.running { "是" } else { "否" }
        ));

        if let Some(ref last_run) = status.last_run {
            lines.push(format!("  上次运行: {}", last_run));
        }

        if let Some(ref next_run) = status.next_run {
            lines.push(format!("  下次运行: {}", next_run));
        }

        if let Some(ref desc) = status.schedule_description {
            lines.push(format!("  调度: {}", desc));
        }

        lines.push(format!("  总执行次数: {}", status.total_executions));
        lines.push(format!("  上次任务数: {}", status.last_task_count));

        lines.join("\n")
    }

    /// 格式化周期结果为可读文本
    fn format_cycle_result(result: &HeartbeatCycleResult) -> String {
        format!(
            "心跳周期完成: 共 {} 个任务, 成功 {}, 失败 {}, 超时 {}",
            result.task_count, result.success_count, result.failed_count, result.timeout_count
        )
    }
}

#[async_trait]
impl Tool for HeartbeatTool {
    fn name(&self) -> &str {
        "heartbeat"
    }

    fn description(&self) -> &str {
        "管理心跳任务系统。支持查看/添加/更新/删除任务、查看执行历史、手动触发执行等操作。"
    }

    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "description": "心跳任务管理工具",
            "properties": {
                "action": {
                    "type": "string",
                    "description": "要执行的操作",
                    "enum": [
                        "list_tasks",
                        "add_task",
                        "update_task",
                        "delete_task",
                        "get_history",
                        "get_detail",
                        "get_status",
                        "trigger"
                    ],
                    "default": "list_tasks"
                },
                "index": {
                    "type": "number",
                    "description": "任务索引 (用于 update_task, delete_task)"
                },
                "description": {
                    "type": "string",
                    "description": "任务描述 (用于 add_task, update_task)"
                },
                "priority": {
                    "type": "number",
                    "description": "任务优先级 1-10 (可选，用于 add_task, update_task)"
                },
                "timeout_secs": {
                    "type": "number",
                    "description": "超时时间秒数 (可选，用于 add_task, update_task)"
                },
                "once": {
                    "type": "boolean",
                    "description": "是否为一次性任务 (可选，用于 add_task, update_task)"
                },
                "model": {
                    "type": "string",
                    "description": "指定模型 (可选，用于 add_task, update_task)"
                },
                "execution_id": {
                    "type": "number",
                    "description": "执行记录 ID (用于 get_detail)"
                },
                "limit": {
                    "type": "number",
                    "description": "历史记录数量限制 (可选，用于 get_history，默认 50)"
                }
            },
            "required": ["action"]
        })
    }

    async fn execute(
        &self,
        params: Value,
        _context: &ToolContext,
    ) -> Result<ToolResult, ToolError> {
        let action = params
            .get("action")
            .and_then(|v| v.as_str())
            .unwrap_or("list_tasks");

        match action {
            "list_tasks" => {
                let tasks = self
                    .service
                    .preview_tasks()
                    .map_err(|e| ToolError::execution_failed(format!("获取任务列表失败: {}", e)))?;

                let output = Self::format_tasks(&tasks);

                Ok(ToolResult::success(output)
                    .with_metadata("task_count", json!(tasks.len()))
                    .with_metadata(
                        "tasks",
                        json!(tasks.iter().map(|t| &t.description).collect::<Vec<_>>()),
                    ))
            }

            "add_task" => {
                let description = params
                    .get("description")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| ToolError::invalid_params("缺少 description 参数"))?;

                let priority = params
                    .get("priority")
                    .and_then(|v| v.as_u64())
                    .map(|v| v as u8);
                let timeout_secs = params.get("timeout_secs").and_then(|v| v.as_u64());
                let once = params.get("once").and_then(|v| v.as_bool());
                let model = params
                    .get("model")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());

                self.service
                    .add_task(description.to_string(), priority, timeout_secs, once, model)
                    .map_err(|e| ToolError::execution_failed(format!("添加任务失败: {}", e)))?;

                Ok(ToolResult::success(format!("已添加任务: {}", description)))
            }

            "update_task" => {
                let index = params
                    .get("index")
                    .and_then(|v| v.as_u64())
                    .ok_or_else(|| ToolError::invalid_params("缺少 index 参数"))?
                    as usize;

                let description = params
                    .get("description")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| ToolError::invalid_params("缺少 description 参数"))?;

                let priority = params
                    .get("priority")
                    .and_then(|v| v.as_u64())
                    .map(|v| v as u8);
                let timeout_secs = params.get("timeout_secs").and_then(|v| v.as_u64());
                let once = params.get("once").and_then(|v| v.as_bool());
                let model = params
                    .get("model")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());

                self.service
                    .update_task(
                        index,
                        description.to_string(),
                        priority,
                        timeout_secs,
                        once,
                        model,
                    )
                    .map_err(|e| ToolError::execution_failed(format!("更新任务失败: {}", e)))?;

                Ok(ToolResult::success(format!(
                    "已更新任务 [{}]: {}",
                    index, description
                )))
            }

            "delete_task" => {
                let index = params
                    .get("index")
                    .and_then(|v| v.as_u64())
                    .ok_or_else(|| ToolError::invalid_params("缺少 index 参数"))?
                    as usize;

                // 先获取要删除的任务描述用于确认
                let tasks = self
                    .service
                    .preview_tasks()
                    .map_err(|e| ToolError::execution_failed(format!("获取任务列表失败: {}", e)))?;

                let deleted_desc = tasks
                    .get(index)
                    .map(|t| t.description.clone())
                    .unwrap_or_else(|| "未知任务".to_string());

                self.service
                    .delete_task(index)
                    .map_err(|e| ToolError::execution_failed(format!("删除任务失败: {}", e)))?;

                Ok(ToolResult::success(format!(
                    "已删除任务 [{}]: {}",
                    index, deleted_desc
                )))
            }

            "get_history" => {
                let limit = params.get("limit").and_then(|v| v.as_u64()).unwrap_or(50) as usize;

                let records = self
                    .service
                    .get_history(limit)
                    .map_err(|e| ToolError::execution_failed(format!("获取历史失败: {}", e)))?;

                let output = Self::format_history(&records);

                Ok(ToolResult::success(output).with_metadata("record_count", json!(records.len())))
            }

            "get_detail" => {
                let execution_id = params
                    .get("execution_id")
                    .and_then(|v| v.as_i64())
                    .ok_or_else(|| ToolError::invalid_params("缺少 execution_id 参数"))?;

                let record = self
                    .service
                    .get_execution_detail(execution_id)
                    .map_err(|e| ToolError::execution_failed(format!("获取详情失败: {}", e)))?;

                match record {
                    Some(record) => {
                        let output = format!(
                            "执行记录详情:\n\
                             \n  ID: {}\n  任务: {}\n  状态: {}\n  开始: {}\n  完成: {}\n  耗时: {}ms\n  \
                             重试: {}\n  输出: {}",
                            record.id,
                            record.task_description,
                            record.status,
                            record.started_at,
                            record.completed_at.as_deref().unwrap_or("未完成"),
                            record.duration_ms.unwrap_or(0),
                            record.retry_count,
                            record.output.as_deref().unwrap_or("无")
                        );
                        Ok(ToolResult::success(output))
                    }
                    None => Ok(ToolResult::success(format!(
                        "未找到执行记录 ID: {}",
                        execution_id
                    ))),
                }
            }

            "get_status" => {
                let status = self
                    .service
                    .get_status()
                    .map_err(|e| ToolError::execution_failed(format!("获取状态失败: {}", e)))?;

                let output = Self::format_status(&status);

                Ok(ToolResult::success(output))
            }

            "trigger" => {
                let result = self
                    .service
                    .trigger_now()
                    .await
                    .map_err(|e| ToolError::execution_failed(format!("触发执行失败: {}", e)))?;

                let output = Self::format_cycle_result(&result);

                Ok(ToolResult::success(output)
                    .with_metadata("task_count", json!(result.task_count))
                    .with_metadata("success_count", json!(result.success_count))
                    .with_metadata("failed_count", json!(result.failed_count)))
            }

            _ => Ok(ToolResult::error(format!("未知操作: {}", action))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Mock service for testing
    struct MockHeartbeatService;

    #[async_trait]
    impl HeartbeatService for MockHeartbeatService {
        fn get_status(&self) -> Result<HeartbeatStatus, HeartbeatToolError> {
            Ok(HeartbeatStatus {
                running: true,
                last_run: Some("2024-01-01T12:00:00Z".to_string()),
                next_run: Some("2024-01-01T13:00:00Z".to_string()),
                last_task_count: 5,
                total_executions: 100,
                schedule_description: Some("每 300 秒".to_string()),
            })
        }

        fn get_app_data_dir(&self) -> Result<PathBuf, HeartbeatToolError> {
            Ok(PathBuf::from("/tmp"))
        }

        fn preview_tasks(&self) -> Result<Vec<HeartbeatTaskPreview>, HeartbeatToolError> {
            Ok(vec![
                HeartbeatTaskPreview {
                    description: "检查系统状态".to_string(),
                    priority: Some(8),
                    timeout_secs: Some(60),
                    once: false,
                    model: None,
                },
                HeartbeatTaskPreview {
                    description: "备份数据".to_string(),
                    priority: Some(5),
                    timeout_secs: Some(300),
                    once: false,
                    model: Some("claude-3-haiku".to_string()),
                },
            ])
        }

        fn add_task(
            &self,
            _description: String,
            _priority: Option<u8>,
            _timeout_secs: Option<u64>,
            _once: Option<bool>,
            _model: Option<String>,
        ) -> Result<(), HeartbeatToolError> {
            Ok(())
        }

        fn delete_task(&self, _index: usize) -> Result<(), HeartbeatToolError> {
            Ok(())
        }

        fn update_task(
            &self,
            _index: usize,
            _description: String,
            _priority: Option<u8>,
            _timeout_secs: Option<u64>,
            _once: Option<bool>,
            _model: Option<String>,
        ) -> Result<(), HeartbeatToolError> {
            Ok(())
        }

        fn get_history(
            &self,
            _limit: usize,
        ) -> Result<Vec<HeartbeatExecutionRecord>, HeartbeatToolError> {
            Ok(vec![HeartbeatExecutionRecord {
                id: 1,
                task_description: "检查系统状态".to_string(),
                status: "success".to_string(),
                started_at: "2024-01-01T12:00:00Z".to_string(),
                completed_at: Some("2024-01-01T12:00:05Z".to_string()),
                duration_ms: Some(5000),
                output: Some("系统正常".to_string()),
                retry_count: 0,
            }])
        }

        fn get_execution_detail(
            &self,
            _id: i64,
        ) -> Result<Option<HeartbeatExecutionRecord>, HeartbeatToolError> {
            Ok(Some(HeartbeatExecutionRecord {
                id: 1,
                task_description: "检查系统状态".to_string(),
                status: "success".to_string(),
                started_at: "2024-01-01T12:00:00Z".to_string(),
                completed_at: Some("2024-01-01T12:00:05Z".to_string()),
                duration_ms: Some(5000),
                output: Some("系统正常".to_string()),
                retry_count: 0,
            }))
        }

        async fn trigger_now(&self) -> Result<HeartbeatCycleResult, HeartbeatToolError> {
            Ok(HeartbeatCycleResult {
                task_count: 2,
                success_count: 2,
                failed_count: 0,
                timeout_count: 0,
            })
        }
    }

    #[test]
    fn test_tool_name() {
        let tool = HeartbeatTool::new(Arc::new(MockHeartbeatService));
        assert_eq!(tool.name(), "heartbeat");
    }

    #[test]
    fn test_tool_description() {
        let tool = HeartbeatTool::new(Arc::new(MockHeartbeatService));
        assert!(!tool.description().is_empty());
    }

    #[test]
    fn test_input_schema() {
        let tool = HeartbeatTool::new(Arc::new(MockHeartbeatService));
        let schema = tool.input_schema();
        assert!(schema.is_object());
        assert!(schema["properties"].is_object());
        assert!(schema["properties"]["action"].is_object());
    }

    #[test]
    fn test_format_tasks() {
        let tasks = vec![
            HeartbeatTaskPreview {
                description: "任务1".to_string(),
                priority: Some(5),
                timeout_secs: Some(60),
                once: false,
                model: None,
            },
            HeartbeatTaskPreview {
                description: "一次性任务".to_string(),
                priority: None,
                timeout_secs: None,
                once: true,
                model: Some("claude-3-haiku".to_string()),
            },
        ];

        let output = HeartbeatTool::format_tasks(&tasks);
        assert!(output.contains("任务1"));
        assert!(output.contains("一次性任务"));
        assert!(output.contains("优先级: 5"));
        assert!(output.contains("一次性任务"));
    }

    #[test]
    fn test_format_empty_tasks() {
        let tasks: Vec<HeartbeatTaskPreview> = vec![];
        let output = HeartbeatTool::format_tasks(&tasks);
        assert_eq!(output, "当前没有心跳任务");
    }

    #[test]
    fn test_format_status() {
        let status = HeartbeatStatus {
            running: true,
            last_run: Some("2024-01-01T12:00:00Z".to_string()),
            next_run: Some("2024-01-01T13:00:00Z".to_string()),
            last_task_count: 5,
            total_executions: 100,
            schedule_description: Some("每 300 秒".to_string()),
        };

        let output = HeartbeatTool::format_status(&status);
        assert!(output.contains("运行中: 是"));
        assert!(output.contains("总执行次数: 100"));
        assert!(output.contains("上次任务数: 5"));
    }

    #[test]
    fn test_format_history() {
        let records = vec![HeartbeatExecutionRecord {
            id: 1,
            task_description: "测试任务".to_string(),
            status: "success".to_string(),
            started_at: "2024-01-01T12:00:00Z".to_string(),
            completed_at: Some("2024-01-01T12:00:05Z".to_string()),
            duration_ms: Some(5000),
            output: Some("测试输出".to_string()),
            retry_count: 0,
        }];

        let output = HeartbeatTool::format_history(&records);
        assert!(output.contains("测试任务"));
        assert!(output.contains("success"));
        assert!(output.contains("测试输出"));
    }

    #[tokio::test]
    async fn test_execute_list_tasks() {
        let tool = HeartbeatTool::new(Arc::new(MockHeartbeatService));
        let params = json!({ "action": "list_tasks" });
        let result = tool.execute(params, &ToolContext::default()).await.unwrap();
        assert!(result.is_success());
        let content = result.content();
        assert!(content.contains("检查系统状态"));
        assert!(content.contains("备份数据"));
    }

    #[tokio::test]
    async fn test_execute_get_status() {
        let tool = HeartbeatTool::new(Arc::new(MockHeartbeatService));
        let params = json!({ "action": "get_status" });
        let result = tool.execute(params, &ToolContext::default()).await.unwrap();
        assert!(result.is_success());
        let content = result.content();
        assert!(content.contains("运行中: 是"));
    }

    #[tokio::test]
    async fn test_execute_trigger() {
        let tool = HeartbeatTool::new(Arc::new(MockHeartbeatService));
        let params = json!({ "action": "trigger" });
        let result = tool.execute(params, &ToolContext::default()).await.unwrap();
        assert!(result.is_success());
        let content = result.content();
        assert!(content.contains("共 2 个任务"));
        assert!(content.contains("成功 2"));
    }

    #[tokio::test]
    async fn test_execute_add_task() {
        let tool = HeartbeatTool::new(Arc::new(MockHeartbeatService));
        let params = json!({
            "action": "add_task",
            "description": "新任务",
            "priority": 7
        });
        let result = tool.execute(params, &ToolContext::default()).await.unwrap();
        assert!(result.is_success());
        let content = result.content();
        assert!(content.contains("已添加任务"));
    }

    #[tokio::test]
    async fn test_execute_invalid_action() {
        let tool = HeartbeatTool::new(Arc::new(MockHeartbeatService));
        let params = json!({ "action": "invalid_action" });
        let result = tool.execute(params, &ToolContext::default()).await.unwrap();
        assert!(result.is_error());
        let content = result.content();
        assert!(content.contains("未知操作"));
    }
}
