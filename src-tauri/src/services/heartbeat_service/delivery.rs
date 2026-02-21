//! 心跳任务通知投递模块
//!
//! 支持将任务执行结果通知到外部渠道（Webhook、Telegram 等）

use proxycast_core::config::DeliveryConfig;
use serde::Serialize;

/// 投递结果
#[derive(Debug)]
pub struct DeliveryResult {
    pub success: bool,
    pub message: String,
}

/// 任务执行结果（用于通知）
#[derive(Debug, Clone, Serialize)]
pub struct TaskResult {
    pub task: String,
    pub status: String,
    pub output: String,
    pub duration_ms: i64,
    pub timestamp: String,
}

/// 投递任务执行结果到配置的渠道
pub async fn deliver_result(config: &DeliveryConfig, result: &TaskResult) -> DeliveryResult {
    // 检查是否启用通知
    if config.mode == "none" {
        return DeliveryResult {
            success: true,
            message: "通知已禁用".to_string(),
        };
    }

    let channel = match &config.channel {
        Some(c) => c.as_str(),
        None => {
            return DeliveryResult {
                success: false,
                message: "未配置通知渠道".to_string(),
            };
        }
    };

    let target = match &config.target {
        Some(t) => t.as_str(),
        None => {
            return DeliveryResult {
                success: false,
                message: "未配置通知目标".to_string(),
            };
        }
    };

    match channel {
        "webhook" => deliver_webhook(target, result).await,
        "telegram" => deliver_telegram(target, result).await,
        _ => DeliveryResult {
            success: false,
            message: format!("不支持的通知渠道: {}", channel),
        },
    }
}

/// 通过 Webhook 投递通知
async fn deliver_webhook(url: &str, result: &TaskResult) -> DeliveryResult {
    let payload = WebhookPayload {
        event: "heartbeat_task_complete".to_string(),
        task: result.task.clone(),
        status: result.status.clone(),
        output: result.output.clone(),
        duration_ms: result.duration_ms,
        timestamp: result.timestamp.clone(),
    };

    let client = reqwest::Client::new();
    match client
        .post(url)
        .json(&payload)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                DeliveryResult {
                    success: true,
                    message: "Webhook 通知已发送".to_string(),
                }
            } else {
                DeliveryResult {
                    success: false,
                    message: format!("Webhook 返回错误: {}", response.status()),
                }
            }
        }
        Err(e) => DeliveryResult {
            success: false,
            message: format!("Webhook 请求失败: {}", e),
        },
    }
}

/// Webhook 通知载荷
#[derive(Debug, Serialize)]
struct WebhookPayload {
    event: String,
    task: String,
    status: String,
    output: String,
    duration_ms: i64,
    timestamp: String,
}

/// 通过 Telegram Bot API 投递通知
async fn deliver_telegram(target: &str, result: &TaskResult) -> DeliveryResult {
    // target 格式: "bot_token:chat_id"
    let parts: Vec<&str> = target.splitn(2, ':').collect();
    if parts.len() != 2 {
        return DeliveryResult {
            success: false,
            message: "Telegram 目标格式错误，应为 bot_token:chat_id".to_string(),
        };
    }

    let bot_token = parts[0];
    let chat_id = parts[1];

    let status_emoji = match result.status.as_str() {
        "success" => "✅",
        "failed" => "❌",
        "timeout" => "⏰",
        _ => "📋",
    };

    let message = format!(
        "{} *心跳任务完成*\n\n*任务*: {}\n*状态*: {}\n*耗时*: {}ms\n\n```\n{}\n```",
        status_emoji,
        escape_markdown(&result.task),
        result.status,
        result.duration_ms,
        escape_markdown(&result.output),
    );

    let url = format!("https://api.telegram.org/bot{}/sendMessage", bot_token);

    let payload = TelegramPayload {
        chat_id: chat_id.to_string(),
        text: message,
        parse_mode: "MarkdownV2".to_string(),
    };

    let client = reqwest::Client::new();
    match client
        .post(&url)
        .json(&payload)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                DeliveryResult {
                    success: true,
                    message: "Telegram 通知已发送".to_string(),
                }
            } else {
                let body = response.text().await.unwrap_or_default();
                DeliveryResult {
                    success: false,
                    message: format!("Telegram API 错误: {}", body),
                }
            }
        }
        Err(e) => DeliveryResult {
            success: false,
            message: format!("Telegram 请求失败: {}", e),
        },
    }
}

/// Telegram 消息载荷
#[derive(Debug, Serialize)]
struct TelegramPayload {
    chat_id: String,
    text: String,
    parse_mode: String,
}

/// 转义 Telegram MarkdownV2 特殊字符
fn escape_markdown(text: &str) -> String {
    let special_chars = [
        '_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!',
    ];
    let mut result = String::with_capacity(text.len() * 2);
    for c in text.chars() {
        if special_chars.contains(&c) {
            result.push('\\');
        }
        result.push(c);
    }
    result
}

/// 批量投递周期结果
pub async fn deliver_cycle_summary(
    config: &DeliveryConfig,
    task_count: usize,
    success_count: usize,
    failed_count: usize,
    timeout_count: usize,
) -> DeliveryResult {
    if config.mode == "none" {
        return DeliveryResult {
            success: true,
            message: "通知已禁用".to_string(),
        };
    }

    let summary = TaskResult {
        task: format!("心跳周期完成 ({} 个任务)", task_count),
        status: if failed_count == 0 && timeout_count == 0 {
            "success".to_string()
        } else {
            "partial".to_string()
        },
        output: format!(
            "成功: {}, 失败: {}, 超时: {}",
            success_count, failed_count, timeout_count
        ),
        duration_ms: 0,
        timestamp: chrono::Utc::now().to_rfc3339(),
    };

    deliver_result(config, &summary).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_escape_markdown() {
        assert_eq!(escape_markdown("hello"), "hello");
        assert_eq!(escape_markdown("hello_world"), "hello\\_world");
        assert_eq!(escape_markdown("*bold*"), "\\*bold\\*");
    }

    #[test]
    fn test_delivery_disabled() {
        let config = DeliveryConfig {
            mode: "none".to_string(),
            channel: None,
            target: None,
            best_effort: true,
        };
        let result = TaskResult {
            task: "test".to_string(),
            status: "success".to_string(),
            output: "ok".to_string(),
            duration_ms: 100,
            timestamp: "2024-01-01T00:00:00Z".to_string(),
        };
        let rt = tokio::runtime::Runtime::new().unwrap();
        let delivery_result = rt.block_on(deliver_result(&config, &result));
        assert!(delivery_result.success);
    }

    #[test]
    fn test_delivery_no_channel() {
        let config = DeliveryConfig {
            mode: "announce".to_string(),
            channel: None,
            target: Some("http://example.com".to_string()),
            best_effort: true,
        };
        let result = TaskResult {
            task: "test".to_string(),
            status: "success".to_string(),
            output: "ok".to_string(),
            duration_ms: 100,
            timestamp: "2024-01-01T00:00:00Z".to_string(),
        };
        let rt = tokio::runtime::Runtime::new().unwrap();
        let delivery_result = rt.block_on(deliver_result(&config, &result));
        assert!(!delivery_result.success);
        assert!(delivery_result.message.contains("未配置通知渠道"));
    }
}
