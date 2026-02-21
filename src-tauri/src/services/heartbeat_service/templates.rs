//! 心跳任务模板系统
//!
//! 提供预设的任务模板，用户可以快速应用到 HEARTBEAT.md

use serde::{Deserialize, Serialize};
use std::path::Path;

/// 任务模板
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskTemplate {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: TaskCategory,
    pub tasks: Vec<String>,
    pub recommended_interval: u64,
}

/// 任务分类
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskCategory {
    ContentCreation,
    ProjectMaintenance,
    DataAnalysis,
    Automation,
    Custom,
}

pub struct TaskTemplateRegistry;

impl TaskTemplateRegistry {
    pub fn get_all_templates() -> Vec<TaskTemplate> {
        vec![
            TaskTemplate {
                id: "daily_blog_post".into(),
                name: "每日博客文章生成".into(),
                description: "每天自动生成一篇博客文章".into(),
                category: TaskCategory::ContentCreation,
                tasks: vec![
                    "分析最近的热点话题，选择一个适合的主题 [priority:8]".into(),
                    "生成一篇 800-1200 字的博客文章 [priority:7] [timeout:300s]".into(),
                    "检查文章质量，确保语法正确、逻辑清晰 [priority:6]".into(),
                ],
                recommended_interval: 86400,
            },
            TaskTemplate {
                id: "social_media_content".into(),
                name: "社交媒体内容生成".into(),
                description: "定期生成社交媒体内容".into(),
                category: TaskCategory::ContentCreation,
                tasks: vec![
                    "生成 3 条适合社交媒体的短内容（每条 100-200 字） [priority:7]".into(),
                    "为每条内容添加合适的话题标签 [priority:6]".into(),
                ],
                recommended_interval: 3600,
            },
            TaskTemplate {
                id: "project_health_check".into(),
                name: "项目健康检查".into(),
                description: "检查项目依赖、代码质量、安全漏洞等".into(),
                category: TaskCategory::ProjectMaintenance,
                tasks: vec![
                    "检查项目依赖是否有更新 [priority:8]".into(),
                    "运行代码质量检查工具 [priority:7] [timeout:600s]".into(),
                    "扫描安全漏洞 [priority:9] [timeout:300s]".into(),
                    "生成项目健康报告 [priority:6]".into(),
                ],
                recommended_interval: 86400,
            },
            TaskTemplate {
                id: "database_backup".into(),
                name: "数据库备份".into(),
                description: "定期备份数据库到指定位置".into(),
                category: TaskCategory::ProjectMaintenance,
                tasks: vec![
                    "skill:backup_database /backups/daily [priority:10] [timeout:600s]".into(),
                    "验证备份文件完整性 [priority:9]".into(),
                    "清理 7 天前的旧备份 [priority:5]".into(),
                ],
                recommended_interval: 86400,
            },
            TaskTemplate {
                id: "usage_analytics".into(),
                name: "使用情况分析".into(),
                description: "分析应用使用情况，生成统计报告".into(),
                category: TaskCategory::DataAnalysis,
                tasks: vec![
                    "统计过去 24 小时的 API 调用次数 [priority:7]".into(),
                    "分析最常用的模型和功能 [priority:6]".into(),
                    "生成使用情况报告 [priority:5]".into(),
                ],
                recommended_interval: 86400,
            },
            TaskTemplate {
                id: "workspace_cleanup".into(),
                name: "工作区清理".into(),
                description: "清理临时文件、日志文件等".into(),
                category: TaskCategory::Automation,
                tasks: vec![
                    "清理 7 天前的日志文件 [priority:6]".into(),
                    "清理临时文件夹 [priority:5]".into(),
                    "压缩旧的会话记录 [priority:4]".into(),
                ],
                recommended_interval: 604800,
            },
        ]
    }

    pub fn get_template_by_id(id: &str) -> Option<TaskTemplate> {
        Self::get_all_templates().into_iter().find(|t| t.id == id)
    }

    /// 将模板任务追加到 HEARTBEAT.md
    pub fn apply_template(template: &TaskTemplate, app_data_dir: &Path) -> Result<(), String> {
        let heartbeat_file = app_data_dir.join("HEARTBEAT.md");
        let mut content = String::new();

        if heartbeat_file.exists() {
            content = std::fs::read_to_string(&heartbeat_file)
                .map_err(|e| format!("读取文件失败: {}", e))?;
            if !content.ends_with('\n') {
                content.push('\n');
            }
            content.push('\n');
        }

        content.push_str(&format!(
            "# {} ({})\n\n",
            template.name, template.description
        ));
        for task in &template.tasks {
            content.push_str(&format!("- {}\n", task));
        }

        std::fs::write(&heartbeat_file, content).map_err(|e| format!("写入文件失败: {}", e))?;

        Ok(())
    }
}

/// 内容创作任务生成器
///
/// 根据用户的 ContentCreatorConfig 生成对应的心跳任务
pub struct ContentCreatorTaskGenerator;

impl ContentCreatorTaskGenerator {
    /// 根据启用的主题生成心跳任务
    pub fn generate_tasks(enabled_themes: &[String]) -> Vec<String> {
        let mut tasks = Vec::new();

        for theme in enabled_themes {
            match theme.as_str() {
                "social-media" => {
                    tasks
                        .push("生成 3 条社交媒体内容（Twitter/微博风格） [priority:7]".to_string());
                }
                "poster" => {
                    tasks.push("设计一张海报的文案和布局建议 [priority:6]".to_string());
                }
                "novel" => {
                    tasks
                        .push("续写小说章节（500-1000字） [priority:5] [timeout:600s]".to_string());
                }
                "music" => {
                    tasks.push("生成歌词创作灵感和主题建议 [priority:6]".to_string());
                }
                "video" => {
                    tasks.push("生成短视频脚本大纲 [priority:6]".to_string());
                }
                _ => {}
            }
        }

        tasks
    }

    /// 将生成的任务追加到 HEARTBEAT.md
    pub fn append_to_heartbeat(tasks: Vec<String>, app_data_dir: &Path) -> Result<(), String> {
        if tasks.is_empty() {
            return Ok(());
        }

        let heartbeat_file = app_data_dir.join("HEARTBEAT.md");
        let mut content = String::new();

        if heartbeat_file.exists() {
            content = std::fs::read_to_string(&heartbeat_file)
                .map_err(|e| format!("读取文件失败: {}", e))?;
            if !content.ends_with('\n') {
                content.push('\n');
            }
            content.push('\n');
        }

        content.push_str("# 内容创作任务（自动生成）\n\n");
        for task in &tasks {
            content.push_str(&format!("- {}\n", task));
        }

        std::fs::write(&heartbeat_file, content).map_err(|e| format!("写入文件失败: {}", e))?;

        Ok(())
    }
}
