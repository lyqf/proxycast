//! HEARTBEAT.md 任务解析引擎
//!
//! 解析 HEARTBEAT.md 文件中的任务列表，支持优先级、超时、一次性任务和模型覆盖。
//!
//! 格式：
//! ```markdown
//! - 任务描述 [priority:N] [timeout:Ns] [once] [model:xxx]
//! ```

use std::path::PathBuf;
use std::time::Duration;

use serde::{Deserialize, Serialize};

/// 心跳任务
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HeartbeatTask {
    pub description: String,
    pub priority: Option<u8>,
    pub timeout: Option<Duration>,
    /// 一次性任务，执行后自动移除
    #[serde(default)]
    pub once: bool,
    /// 模型覆盖（用于智能模式）
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}

/// HEARTBEAT.md 解析引擎
pub struct HeartbeatEngine {
    task_file: PathBuf,
}

impl HeartbeatEngine {
    pub fn new(task_file: PathBuf) -> Self {
        Self { task_file }
    }

    /// 确保 HEARTBEAT.md 文件存在，如果不存在则创建默认模板
    pub fn ensure_file_exists(&self) -> Result<bool, String> {
        if self.task_file.exists() {
            return Ok(false);
        }

        let template = r#"# 心跳任务

# 每行一个任务，以 `- ` 开头
# 支持标记：[priority:N] [timeout:Ns] [once] [model:xxx]
#
# 示例：
# - 检查系统健康状态 [priority:8]
# - 每日数据备份 [timeout:300s]
# - 一次性清理任务 [once]
# - 使用特定模型执行 [model:claude-3-haiku]

"#;

        // 确保父目录存在
        if let Some(parent) = self.task_file.parent() {
            std::fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
        }

        std::fs::write(&self.task_file, template)
            .map_err(|e| format!("创建任务文件失败: {}", e))?;

        Ok(true)
    }

    /// 从 HEARTBEAT.md 收集任务
    pub fn collect_tasks(&self) -> Result<Vec<HeartbeatTask>, String> {
        if !self.task_file.exists() {
            return Ok(vec![]);
        }

        let content = std::fs::read_to_string(&self.task_file)
            .map_err(|e| format!("读取任务文件失败: {}", e))?;

        self.parse_tasks(&content)
    }

    /// 将任务列表序列化回 HEARTBEAT.md 格式并写入文件
    pub fn write_tasks(task_file: &PathBuf, tasks: &[HeartbeatTask]) -> Result<(), String> {
        let mut lines = Vec::new();
        for task in tasks {
            let mut line = format!("- {}", task.description);
            if let Some(p) = task.priority {
                line.push_str(&format!(" [priority:{}]", p));
            }
            if let Some(t) = task.timeout {
                line.push_str(&format!(" [timeout:{}s]", t.as_secs()));
            }
            if task.once {
                line.push_str(" [once]");
            }
            if let Some(ref m) = task.model {
                line.push_str(&format!(" [model:{}]", m));
            }
            lines.push(line);
        }
        let content = lines.join("\n");
        std::fs::write(
            task_file,
            if content.is_empty() {
                String::new()
            } else {
                content + "\n"
            },
        )
        .map_err(|e| format!("写入任务文件失败: {}", e))
    }

    /// 解析 markdown 内容为任务列表
    pub fn parse_tasks(&self, content: &str) -> Result<Vec<HeartbeatTask>, String> {
        let mut tasks: Vec<HeartbeatTask> = Vec::new();

        for line in content.lines() {
            let trimmed = line.trim();

            // 跳过空行、注释、标题
            if trimmed.is_empty() || trimmed.starts_with("<!--") || trimmed.starts_with('#') {
                continue;
            }

            // 匹配列表项：- 或 *
            let item = if let Some(rest) = trimmed.strip_prefix("- ") {
                rest.trim()
            } else if let Some(rest) = trimmed.strip_prefix("* ") {
                rest.trim()
            } else {
                continue;
            };

            if item.is_empty() {
                continue;
            }

            let mut description = item.to_string();
            let mut priority: Option<u8> = None;
            let mut timeout: Option<Duration> = None;
            let mut once = false;
            let mut model: Option<String> = None;

            // 解析 [priority:N]
            if let Some(start) = description.find("[priority:") {
                if let Some(end) = description[start..].find(']') {
                    let val_str = &description[start + 10..start + end];
                    if let Ok(p) = val_str.trim().parse::<u8>() {
                        priority = Some(p.clamp(1, 10));
                    }
                    description = format!(
                        "{}{}",
                        description[..start].trim(),
                        description[start + end + 1..].trim()
                    )
                    .trim()
                    .to_string();
                }
            }

            // 解析 [timeout:Ns]
            if let Some(start) = description.find("[timeout:") {
                if let Some(end) = description[start..].find(']') {
                    let val_str = &description[start + 9..start + end];
                    let val_str = val_str.trim().trim_end_matches('s');
                    if let Ok(secs) = val_str.parse::<u64>() {
                        timeout = Some(Duration::from_secs(secs));
                    }
                    description = format!(
                        "{}{}",
                        description[..start].trim(),
                        description[start + end + 1..].trim()
                    )
                    .trim()
                    .to_string();
                }
            }

            // 解析 [once]
            if description.contains("[once]") {
                once = true;
                description = description.replace("[once]", "").trim().to_string();
            }

            // 解析 [model:xxx]
            if let Some(start) = description.find("[model:") {
                if let Some(end) = description[start..].find(']') {
                    let val_str = &description[start + 7..start + end];
                    let model_name = val_str.trim();
                    if !model_name.is_empty() {
                        model = Some(model_name.to_string());
                    }
                    description = format!(
                        "{}{}",
                        description[..start].trim(),
                        description[start + end + 1..].trim()
                    )
                    .trim()
                    .to_string();
                }
            }

            if !description.is_empty() {
                tasks.push(HeartbeatTask {
                    description,
                    priority,
                    timeout,
                    once,
                    model,
                });
            }
        }

        // 按优先级降序排序（高优先级先执行）
        tasks.sort_by(|a, b| {
            let pa = a.priority.unwrap_or(5);
            let pb = b.priority.unwrap_or(5);
            pb.cmp(&pa)
        });

        Ok(tasks)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_basic_tasks() {
        let engine = HeartbeatEngine::new(PathBuf::from("/tmp/test.md"));
        let content = "- 任务1\n- 任务2\n- 任务3";
        let tasks = engine.parse_tasks(content).unwrap();
        assert_eq!(tasks.len(), 3);
        assert_eq!(tasks[0].description, "任务1");
    }

    #[test]
    fn test_parse_with_priority_and_timeout() {
        let engine = HeartbeatEngine::new(PathBuf::from("/tmp/test.md"));
        let content = "- 高优先级任务 [priority:9] [timeout:300s]\n- 低优先级任务 [priority:2]";
        let tasks = engine.parse_tasks(content).unwrap();
        assert_eq!(tasks.len(), 2);
        // 高优先级排前面
        assert_eq!(tasks[0].priority, Some(9));
        assert_eq!(tasks[0].timeout, Some(Duration::from_secs(300)));
        assert_eq!(tasks[1].priority, Some(2));
    }

    #[test]
    fn test_skip_comments_and_headers() {
        let engine = HeartbeatEngine::new(PathBuf::from("/tmp/test.md"));
        let content = "# 标题\n<!-- 注释 -->\n- 任务1\n\n- 任务2";
        let tasks = engine.parse_tasks(content).unwrap();
        assert_eq!(tasks.len(), 2);
    }

    #[test]
    fn test_empty_file() {
        let engine = HeartbeatEngine::new(PathBuf::from("/tmp/test.md"));
        let tasks = engine.parse_tasks("").unwrap();
        assert_eq!(tasks.len(), 0);
    }

    #[test]
    fn test_priority_clamped() {
        let engine = HeartbeatEngine::new(PathBuf::from("/tmp/test.md"));
        let content = "- 超高 [priority:99]\n- 超低 [priority:0]";
        let tasks = engine.parse_tasks(content).unwrap();
        assert_eq!(tasks[0].priority, Some(10));
        assert_eq!(tasks[1].priority, Some(1));
    }

    #[test]
    fn test_write_then_read_roundtrip() {
        let tmp = tempfile::TempDir::new().unwrap();
        let file = tmp.path().join("HEARTBEAT.md");

        let tasks = vec![
            HeartbeatTask {
                description: "任务A".to_string(),
                priority: Some(8),
                timeout: Some(Duration::from_secs(120)),
                once: false,
                model: None,
            },
            HeartbeatTask {
                description: "任务B".to_string(),
                priority: None,
                timeout: None,
                once: false,
                model: None,
            },
        ];

        HeartbeatEngine::write_tasks(&file, &tasks).unwrap();

        let engine = HeartbeatEngine::new(file);
        let parsed = engine.collect_tasks().unwrap();
        assert_eq!(parsed.len(), 2);
        // 高优先级排前面
        assert_eq!(parsed[0].description, "任务A");
        assert_eq!(parsed[0].priority, Some(8));
        assert_eq!(parsed[0].timeout, Some(Duration::from_secs(120)));
        assert_eq!(parsed[1].description, "任务B");
        assert_eq!(parsed[1].priority, None);
    }

    #[test]
    fn test_write_empty_tasks() {
        let tmp = tempfile::TempDir::new().unwrap();
        let file = tmp.path().join("HEARTBEAT.md");

        HeartbeatEngine::write_tasks(&file, &[]).unwrap();

        let engine = HeartbeatEngine::new(file);
        let parsed = engine.collect_tasks().unwrap();
        assert_eq!(parsed.len(), 0);
    }

    #[test]
    fn test_parse_once_task() {
        let engine = HeartbeatEngine::new(PathBuf::from("/tmp/test.md"));
        let content = "- 一次性任务 [once]";
        let tasks = engine.parse_tasks(content).unwrap();
        assert_eq!(tasks.len(), 1);
        assert!(tasks[0].once);
    }

    #[test]
    fn test_parse_model_override() {
        let engine = HeartbeatEngine::new(PathBuf::from("/tmp/test.md"));
        let content = "- 使用特定模型 [model:claude-3-haiku]";
        let tasks = engine.parse_tasks(content).unwrap();
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].model, Some("claude-3-haiku".to_string()));
    }

    #[test]
    fn test_parse_combined_tags() {
        let engine = HeartbeatEngine::new(PathBuf::from("/tmp/test.md"));
        let content = "- 复杂任务 [priority:7] [timeout:60s] [once] [model:gpt-4o]";
        let tasks = engine.parse_tasks(content).unwrap();
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].description, "复杂任务");
        assert_eq!(tasks[0].priority, Some(7));
        assert_eq!(tasks[0].timeout, Some(Duration::from_secs(60)));
        assert!(tasks[0].once);
        assert_eq!(tasks[0].model, Some("gpt-4o".to_string()));
    }

    #[test]
    fn test_write_once_and_model() {
        let tmp = tempfile::TempDir::new().unwrap();
        let file = tmp.path().join("HEARTBEAT.md");

        let tasks = vec![HeartbeatTask {
            description: "测试任务".to_string(),
            priority: Some(5),
            timeout: None,
            once: true,
            model: Some("claude-3-haiku".to_string()),
        }];

        HeartbeatEngine::write_tasks(&file, &tasks).unwrap();

        let content = std::fs::read_to_string(&file).unwrap();
        assert!(content.contains("[once]"));
        assert!(content.contains("[model:claude-3-haiku]"));
    }

    #[test]
    fn test_ensure_file_creates_template() {
        let tmp = tempfile::TempDir::new().unwrap();
        let file = tmp.path().join("HEARTBEAT.md");

        let engine = HeartbeatEngine::new(file.clone());
        assert!(!file.exists());

        let created = engine.ensure_file_exists().unwrap();
        assert!(created);
        assert!(file.exists());

        let content = std::fs::read_to_string(&file).unwrap();
        assert!(content.contains("# 心跳任务"));
        assert!(content.contains("[priority:N]"));
        assert!(content.contains("[once]"));
        assert!(content.contains("[model:xxx]"));
    }
}
