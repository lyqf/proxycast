//! 对话统计后端服务
//!
//! 从数据库查询真实的对话和使用统计数据

use chrono::{DateTime, Datelike, Duration, Local, Timelike};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

/// 使用统计数据响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageStatsResponse {
    /// 总对话数
    pub total_conversations: u32,
    /// 总消息数
    pub total_messages: u32,
    /// 总 Token 消耗
    pub total_tokens: u64,
    /// 总使用时间（分钟）
    pub total_time_minutes: u32,
    /// 本月对话数
    pub monthly_conversations: u32,
    /// 本月消息数
    pub monthly_messages: u32,
    /// 本月 Token 消耗
    pub monthly_tokens: u64,
    /// 今日对话数
    pub today_conversations: u32,
    /// 今日消息数
    pub today_messages: u32,
    /// 今日 Token 消耗
    pub today_tokens: u64,
}

/// 模型使用统计
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelUsage {
    /// 模型名称
    pub model: String,
    /// 对话次数
    pub conversations: u32,
    /// Token 消耗
    pub tokens: u64,
    /// 使用百分比
    pub percentage: f32,
}

/// 每日使用统计
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyUsage {
    /// 日期 (YYYY-MM-DD)
    pub date: String,
    /// 对话数
    pub conversations: u32,
    /// Token 消耗
    pub tokens: u64,
}

#[derive(Debug, Clone, Copy, Default)]
struct ConversationStats {
    total_conversations: u32,
    total_messages: u32,
    monthly_conversations: u32,
    monthly_messages: u32,
    today_conversations: u32,
    today_messages: u32,
}

#[derive(Debug, Clone, Copy, Default)]
struct TokenStats {
    total_tokens: u64,
    monthly_tokens: u64,
    today_tokens: u64,
}

#[derive(Debug, Clone)]
struct RawModelUsage {
    model: String,
    conversations: u64,
    tokens: u64,
}

/// 获取使用统计数据
pub fn get_usage_stats_from_db(
    time_range: &str,
    conn: &Connection,
) -> Result<UsageStatsResponse, String> {
    validate_time_range(time_range)?;

    let now = Local::now();
    let today_start = start_of_day(now);
    let month_start = start_of_month(now);

    // 查询通用对话统计
    let general_stats = query_general_chat_stats(conn, &today_start, &month_start)?;

    // 查询 Agent 对话统计
    let agent_stats = query_agent_chat_stats(conn, &today_start, &month_start)?;

    // 合并统计
    let total_conversations = general_stats.total_conversations + agent_stats.total_conversations;
    let total_messages = general_stats.total_messages + agent_stats.total_messages;

    let today_conversations = general_stats.today_conversations + agent_stats.today_conversations;
    let today_messages = general_stats.today_messages + agent_stats.today_messages;

    let monthly_conversations =
        general_stats.monthly_conversations + agent_stats.monthly_conversations;
    let monthly_messages = general_stats.monthly_messages + agent_stats.monthly_messages;

    // Token 优先使用真实统计表；无记录时回退到基于消息内容长度的估算
    let token_stats = query_token_stats(conn, &today_start, &month_start)?;
    let total_tokens = token_stats.total_tokens;
    let monthly_tokens = token_stats.monthly_tokens;
    let today_tokens = token_stats.today_tokens;

    // 计算总使用时间（基于 token 估算，约 10 token/s）
    let total_time_minutes = (total_tokens / 600) as u32;

    Ok(UsageStatsResponse {
        total_conversations,
        total_messages,
        total_tokens,
        total_time_minutes,
        monthly_conversations,
        monthly_messages,
        monthly_tokens,
        today_conversations,
        today_messages,
        today_tokens,
    })
}

fn validate_time_range(time_range: &str) -> Result<(), String> {
    match time_range {
        "week" | "month" | "all" => Ok(()),
        _ => Err("无效的时间范围".to_string()),
    }
}

fn resolve_range_days(time_range: &str) -> Result<i64, String> {
    match time_range {
        "week" => Ok(7),
        "month" => Ok(30),
        "all" => Ok(90),
        _ => Err("无效的时间范围".to_string()),
    }
}

fn resolve_range_start(time_range: &str) -> Result<Option<DateTime<Local>>, String> {
    let now = Local::now();
    match time_range {
        "week" => Ok(Some(now - Duration::days(7))),
        "month" => Ok(Some(now - Duration::days(30))),
        "all" => Ok(None),
        _ => Err("无效的时间范围".to_string()),
    }
}

fn start_of_day(now: DateTime<Local>) -> DateTime<Local> {
    now.with_hour(0)
        .and_then(|dt| dt.with_minute(0))
        .and_then(|dt| dt.with_second(0))
        .and_then(|dt| dt.with_nanosecond(0))
        .unwrap_or(now)
}

fn start_of_month(now: DateTime<Local>) -> DateTime<Local> {
    now.with_day(1)
        .and_then(|dt| dt.with_hour(0))
        .and_then(|dt| dt.with_minute(0))
        .and_then(|dt| dt.with_second(0))
        .and_then(|dt| dt.with_nanosecond(0))
        .unwrap_or_else(|| start_of_day(now))
}

fn clamp_i64_to_u32(value: i64) -> u32 {
    value.clamp(0, u32::MAX as i64) as u32
}

fn clamp_i64_to_u64(value: i64) -> u64 {
    value.max(0) as u64
}

fn chars_to_estimated_tokens(chars: i64) -> u64 {
    if chars <= 0 {
        return 0;
    }
    ((chars as f64) / 4.0).ceil() as u64
}

/// 查询通用对话统计
fn query_general_chat_stats(
    conn: &Connection,
    today_start: &DateTime<Local>,
    month_start: &DateTime<Local>,
) -> Result<ConversationStats, String> {
    // 转换为 Unix 时间戳（毫秒）
    let today_ts = today_start.timestamp_millis();
    let month_ts = month_start.timestamp_millis();

    // 今日对话数
    let today_conversations: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM general_chat_sessions WHERE created_at >= ?",
            [today_ts],
            |row| row.get(0),
        )
        .map_err(|e| format!("查询今日通用会话数失败: {e}"))?;

    // 今日消息数
    let today_messages: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM general_chat_messages WHERE created_at >= ?",
            [today_ts],
            |row| row.get(0),
        )
        .map_err(|e| format!("查询今日通用消息数失败: {e}"))?;

    // 本月对话数
    let monthly_conversations: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM general_chat_sessions WHERE created_at >= ?",
            [month_ts],
            |row| row.get(0),
        )
        .map_err(|e| format!("查询本月通用会话数失败: {e}"))?;

    // 本月消息数
    let monthly_messages: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM general_chat_messages WHERE created_at >= ?",
            [month_ts],
            |row| row.get(0),
        )
        .map_err(|e| format!("查询本月通用消息数失败: {e}"))?;

    // 总对话数
    let total_conversations: i64 = conn
        .query_row("SELECT COUNT(*) FROM general_chat_sessions", [], |row| {
            row.get(0)
        })
        .map_err(|e| format!("查询总通用会话数失败: {e}"))?;

    // 总消息数
    let total_messages: i64 = conn
        .query_row("SELECT COUNT(*) FROM general_chat_messages", [], |row| {
            row.get(0)
        })
        .map_err(|e| format!("查询总通用消息数失败: {e}"))?;

    Ok(ConversationStats {
        total_conversations: clamp_i64_to_u32(total_conversations),
        total_messages: clamp_i64_to_u32(total_messages),
        monthly_conversations: clamp_i64_to_u32(monthly_conversations),
        monthly_messages: clamp_i64_to_u32(monthly_messages),
        today_conversations: clamp_i64_to_u32(today_conversations),
        today_messages: clamp_i64_to_u32(today_messages),
    })
}

/// 查询 Agent 对话统计
fn query_agent_chat_stats(
    conn: &Connection,
    today_start: &DateTime<Local>,
    month_start: &DateTime<Local>,
) -> Result<ConversationStats, String> {
    // Agent sessions 使用 TEXT 格式的日期时间
    let today_str = today_start.format("%Y-%m-%d %H:%M:%S").to_string();
    let month_str = month_start.format("%Y-%m-%d %H:%M:%S").to_string();

    // 今日对话数
    let today_conversations: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM agent_sessions WHERE datetime(created_at) >= datetime(?)",
            [today_str.clone()],
            |row| row.get(0),
        )
        .map_err(|e| format!("查询今日 Agent 会话数失败: {e}"))?;

    // 今日消息数
    let today_messages: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM agent_messages WHERE datetime(timestamp) >= datetime(?)",
            [today_str],
            |row| row.get(0),
        )
        .map_err(|e| format!("查询今日 Agent 消息数失败: {e}"))?;

    // 本月对话数
    let monthly_conversations: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM agent_sessions WHERE datetime(created_at) >= datetime(?)",
            [month_str.clone()],
            |row| row.get(0),
        )
        .map_err(|e| format!("查询本月 Agent 会话数失败: {e}"))?;

    // 本月消息数
    let monthly_messages: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM agent_messages WHERE datetime(timestamp) >= datetime(?)",
            [month_str],
            |row| row.get(0),
        )
        .map_err(|e| format!("查询本月 Agent 消息数失败: {e}"))?;

    // 总对话数
    let total_conversations: i64 = conn
        .query_row("SELECT COUNT(*) FROM agent_sessions", [], |row| row.get(0))
        .map_err(|e| format!("查询总 Agent 会话数失败: {e}"))?;

    // 总消息数
    let total_messages: i64 = conn
        .query_row("SELECT COUNT(*) FROM agent_messages", [], |row| row.get(0))
        .map_err(|e| format!("查询总 Agent 消息数失败: {e}"))?;

    Ok(ConversationStats {
        total_conversations: clamp_i64_to_u32(total_conversations),
        total_messages: clamp_i64_to_u32(total_messages),
        monthly_conversations: clamp_i64_to_u32(monthly_conversations),
        monthly_messages: clamp_i64_to_u32(monthly_messages),
        today_conversations: clamp_i64_to_u32(today_conversations),
        today_messages: clamp_i64_to_u32(today_messages),
    })
}

fn query_token_stats(
    conn: &Connection,
    today_start: &DateTime<Local>,
    month_start: &DateTime<Local>,
) -> Result<TokenStats, String> {
    if let Some(actual_tokens) = query_model_usage_table_tokens(conn, today_start, month_start)? {
        return Ok(actual_tokens);
    }

    query_estimated_tokens_from_messages(conn, today_start, month_start)
}

fn query_model_usage_table_tokens(
    conn: &Connection,
    today_start: &DateTime<Local>,
    month_start: &DateTime<Local>,
) -> Result<Option<TokenStats>, String> {
    let row_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM model_usage_stats", [], |row| {
            row.get(0)
        })
        .map_err(|e| format!("查询 model_usage_stats 行数失败: {e}"))?;

    if row_count <= 0 {
        return Ok(None);
    }

    let today_key = today_start.format("%Y-%m-%d").to_string();
    let month_key = month_start.format("%Y-%m-%d").to_string();

    let total_tokens: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(total_tokens), 0) FROM model_usage_stats",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("查询总 Token 失败: {e}"))?;

    let monthly_tokens: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(total_tokens), 0) FROM model_usage_stats WHERE date >= ?",
            [month_key],
            |row| row.get(0),
        )
        .map_err(|e| format!("查询本月 Token 失败: {e}"))?;

    let today_tokens: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(total_tokens), 0) FROM model_usage_stats WHERE date = ?",
            [today_key],
            |row| row.get(0),
        )
        .map_err(|e| format!("查询今日 Token 失败: {e}"))?;

    Ok(Some(TokenStats {
        total_tokens: clamp_i64_to_u64(total_tokens),
        monthly_tokens: clamp_i64_to_u64(monthly_tokens),
        today_tokens: clamp_i64_to_u64(today_tokens),
    }))
}

fn query_estimated_tokens_from_messages(
    conn: &Connection,
    today_start: &DateTime<Local>,
    month_start: &DateTime<Local>,
) -> Result<TokenStats, String> {
    let today_ts = today_start.timestamp_millis();
    let month_ts = month_start.timestamp_millis();
    let today_str = today_start.format("%Y-%m-%d %H:%M:%S").to_string();
    let month_str = month_start.format("%Y-%m-%d %H:%M:%S").to_string();

    let general_total_chars: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(LENGTH(content)), 0) FROM general_chat_messages",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("估算总 Token（通用消息）失败: {e}"))?;

    let general_monthly_chars: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(LENGTH(content)), 0) FROM general_chat_messages WHERE created_at >= ?",
            [month_ts],
            |row| row.get(0),
        )
        .map_err(|e| format!("估算本月 Token（通用消息）失败: {e}"))?;

    let general_today_chars: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(LENGTH(content)), 0) FROM general_chat_messages WHERE created_at >= ?",
            [today_ts],
            |row| row.get(0),
        )
        .map_err(|e| format!("估算今日 Token（通用消息）失败: {e}"))?;

    let agent_total_chars: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(LENGTH(content_json)), 0) FROM agent_messages",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("估算总 Token（Agent 消息）失败: {e}"))?;

    let agent_monthly_chars: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(LENGTH(content_json)), 0) FROM agent_messages
             WHERE datetime(timestamp) >= datetime(?)",
            [month_str],
            |row| row.get(0),
        )
        .map_err(|e| format!("估算本月 Token（Agent 消息）失败: {e}"))?;

    let agent_today_chars: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(LENGTH(content_json)), 0) FROM agent_messages
             WHERE datetime(timestamp) >= datetime(?)",
            [today_str],
            |row| row.get(0),
        )
        .map_err(|e| format!("估算今日 Token（Agent 消息）失败: {e}"))?;

    Ok(TokenStats {
        total_tokens: chars_to_estimated_tokens(general_total_chars + agent_total_chars),
        monthly_tokens: chars_to_estimated_tokens(general_monthly_chars + agent_monthly_chars),
        today_tokens: chars_to_estimated_tokens(general_today_chars + agent_today_chars),
    })
}

/// 获取模型使用排行
pub fn get_model_usage_ranking_from_db(
    time_range: &str,
    conn: &Connection,
) -> Result<Vec<ModelUsage>, String> {
    let range_start = resolve_range_start(time_range)?;

    let mut usages = query_model_usage_from_stats_table(conn, range_start)?;
    if usages.is_empty() {
        usages = query_model_usage_from_agent_messages(conn, range_start)?;
    }

    Ok(build_model_usage_response(usages))
}

fn query_model_usage_from_stats_table(
    conn: &Connection,
    range_start: Option<DateTime<Local>>,
) -> Result<Vec<RawModelUsage>, String> {
    let mut result = Vec::new();

    if let Some(start) = range_start {
        let start_key = start.format("%Y-%m-%d").to_string();
        let mut stmt = conn
            .prepare(
                "SELECT model_id,
                        COALESCE(SUM(request_count), 0) AS conversations,
                        COALESCE(SUM(total_tokens), 0) AS tokens
                 FROM model_usage_stats
                 WHERE date >= ?
                 GROUP BY model_id
                 ORDER BY tokens DESC, conversations DESC
                 LIMIT 20",
            )
            .map_err(|e| format!("准备模型统计查询失败: {e}"))?;

        let rows = stmt
            .query_map([start_key], |row| {
                let model: String = row.get(0)?;
                let conversations: i64 = row.get(1)?;
                let tokens: i64 = row.get(2)?;
                Ok(RawModelUsage {
                    model,
                    conversations: clamp_i64_to_u64(conversations),
                    tokens: clamp_i64_to_u64(tokens),
                })
            })
            .map_err(|e| format!("执行模型统计查询失败: {e}"))?;

        for row in rows {
            result.push(row.map_err(|e| format!("读取模型统计行失败: {e}"))?);
        }

        return Ok(result);
    }

    let mut stmt = conn
        .prepare(
            "SELECT model_id,
                    COALESCE(SUM(request_count), 0) AS conversations,
                    COALESCE(SUM(total_tokens), 0) AS tokens
             FROM model_usage_stats
             GROUP BY model_id
             ORDER BY tokens DESC, conversations DESC
             LIMIT 20",
        )
        .map_err(|e| format!("准备模型统计查询失败: {e}"))?;

    let rows = stmt
        .query_map([], |row| {
            let model: String = row.get(0)?;
            let conversations: i64 = row.get(1)?;
            let tokens: i64 = row.get(2)?;
            Ok(RawModelUsage {
                model,
                conversations: clamp_i64_to_u64(conversations),
                tokens: clamp_i64_to_u64(tokens),
            })
        })
        .map_err(|e| format!("执行模型统计查询失败: {e}"))?;

    for row in rows {
        result.push(row.map_err(|e| format!("读取模型统计行失败: {e}"))?);
    }

    Ok(result)
}

fn query_model_usage_from_agent_messages(
    conn: &Connection,
    range_start: Option<DateTime<Local>>,
) -> Result<Vec<RawModelUsage>, String> {
    let mut result = Vec::new();

    if let Some(start) = range_start {
        let start_str = start.format("%Y-%m-%d %H:%M:%S").to_string();
        let mut stmt = conn
            .prepare(
                "SELECT s.model,
                        COUNT(DISTINCT m.session_id) AS conversations,
                        COALESCE(SUM(LENGTH(m.content_json)), 0) AS content_chars
                 FROM agent_messages m
                 JOIN agent_sessions s ON s.id = m.session_id
                 WHERE datetime(m.timestamp) >= datetime(?)
                 GROUP BY s.model
                 ORDER BY content_chars DESC, conversations DESC
                 LIMIT 20",
            )
            .map_err(|e| format!("准备 Agent 模型排行查询失败: {e}"))?;

        let rows = stmt
            .query_map([start_str], |row| {
                let model: String = row.get(0)?;
                let conversations: i64 = row.get(1)?;
                let chars: i64 = row.get(2)?;
                Ok(RawModelUsage {
                    model,
                    conversations: clamp_i64_to_u64(conversations),
                    tokens: chars_to_estimated_tokens(chars),
                })
            })
            .map_err(|e| format!("执行 Agent 模型排行查询失败: {e}"))?;

        for row in rows {
            result.push(row.map_err(|e| format!("读取 Agent 模型排行行失败: {e}"))?);
        }

        return Ok(result);
    }

    let mut stmt = conn
        .prepare(
            "SELECT s.model,
                    COUNT(DISTINCT m.session_id) AS conversations,
                    COALESCE(SUM(LENGTH(m.content_json)), 0) AS content_chars
             FROM agent_messages m
             JOIN agent_sessions s ON s.id = m.session_id
             GROUP BY s.model
             ORDER BY content_chars DESC, conversations DESC
             LIMIT 20",
        )
        .map_err(|e| format!("准备 Agent 模型排行查询失败: {e}"))?;

    let rows = stmt
        .query_map([], |row| {
            let model: String = row.get(0)?;
            let conversations: i64 = row.get(1)?;
            let chars: i64 = row.get(2)?;
            Ok(RawModelUsage {
                model,
                conversations: clamp_i64_to_u64(conversations),
                tokens: chars_to_estimated_tokens(chars),
            })
        })
        .map_err(|e| format!("执行 Agent 模型排行查询失败: {e}"))?;

    for row in rows {
        result.push(row.map_err(|e| format!("读取 Agent 模型排行行失败: {e}"))?);
    }

    Ok(result)
}

fn build_model_usage_response(usages: Vec<RawModelUsage>) -> Vec<ModelUsage> {
    if usages.is_empty() {
        return Vec::new();
    }

    let total_tokens: u64 = usages.iter().map(|item| item.tokens).sum();
    let total_conversations: u64 = usages.iter().map(|item| item.conversations).sum();

    usages
        .into_iter()
        .map(|item| {
            let denominator = if total_tokens > 0 {
                total_tokens as f64
            } else {
                total_conversations.max(1) as f64
            };
            let numerator = if total_tokens > 0 {
                item.tokens as f64
            } else {
                item.conversations as f64
            };
            let percentage = ((numerator / denominator) * 1000.0).round() / 10.0;

            ModelUsage {
                model: if item.model.trim().is_empty() {
                    "unknown".to_string()
                } else {
                    item.model
                },
                conversations: item.conversations.min(u32::MAX as u64) as u32,
                tokens: item.tokens,
                percentage: percentage as f32,
            }
        })
        .collect()
}

/// 获取每日使用趋势
pub fn get_daily_usage_trends_from_db(
    time_range: &str,
    conn: &Connection,
) -> Result<Vec<DailyUsage>, String> {
    let days = resolve_range_days(time_range)?;

    let has_model_usage_data: i64 = conn
        .query_row("SELECT COUNT(*) FROM model_usage_stats", [], |row| {
            row.get(0)
        })
        .map_err(|e| format!("检查 model_usage_stats 失败: {e}"))?;
    let use_actual_tokens = has_model_usage_data > 0;

    let mut daily_usage = Vec::new();

    // 查询每日统计（从最早日期到今天）
    for i in (0..days).rev() {
        let date = Local::now() - Duration::days(i);
        let day_start = start_of_day(date);
        let day_end = day_start + Duration::days(1);

        // 当天开始/结束（时间戳 + 文本）
        let day_start_ts = day_start.timestamp_millis();
        let day_end_ts = day_end.timestamp_millis();
        let day_start_str = day_start.format("%Y-%m-%d %H:%M:%S").to_string();
        let day_end_str = day_end.format("%Y-%m-%d %H:%M:%S").to_string();
        let day_key = day_start.format("%Y-%m-%d").to_string();

        let conversations: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM general_chat_sessions WHERE created_at >= ? AND created_at < ?",
                [day_start_ts, day_end_ts],
                |row| row.get(0),
            )
            .map_err(|e| format!("查询通用会话日统计失败: {e}"))?;

        // 查询 Agent 对话
        let agent_conversations: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM agent_sessions
                 WHERE datetime(created_at) >= datetime(?)
                   AND datetime(created_at) < datetime(?)",
                [day_start_str.clone(), day_end_str.clone()],
                |row| row.get(0),
            )
            .map_err(|e| format!("查询 Agent 会话日统计失败: {e}"))?;

        let total_conversations = conversations + agent_conversations;

        let tokens = if use_actual_tokens {
            let day_tokens: i64 = conn
                .query_row(
                    "SELECT COALESCE(SUM(total_tokens), 0) FROM model_usage_stats WHERE date = ?",
                    [day_key.clone()],
                    |row| row.get(0),
                )
                .map_err(|e| format!("查询模型日 Token 失败: {e}"))?;

            clamp_i64_to_u64(day_tokens)
        } else {
            let general_chars: i64 = conn
                .query_row(
                    "SELECT COALESCE(SUM(LENGTH(content)), 0)
                     FROM general_chat_messages
                     WHERE created_at >= ? AND created_at < ?",
                    [day_start_ts, day_end_ts],
                    |row| row.get(0),
                )
                .map_err(|e| format!("估算通用消息日 Token 失败: {e}"))?;

            let agent_chars: i64 = conn
                .query_row(
                    "SELECT COALESCE(SUM(LENGTH(content_json)), 0)
                     FROM agent_messages
                     WHERE datetime(timestamp) >= datetime(?)
                       AND datetime(timestamp) < datetime(?)",
                    [day_start_str, day_end_str],
                    |row| row.get(0),
                )
                .map_err(|e| format!("估算 Agent 消息日 Token 失败: {e}"))?;

            chars_to_estimated_tokens(general_chars + agent_chars)
        };

        daily_usage.push(DailyUsage {
            date: day_key,
            conversations: clamp_i64_to_u32(total_conversations),
            tokens,
        });
    }

    Ok(daily_usage)
}
