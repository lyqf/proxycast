//! Flow Monitor Tauri 命令
//!
//! 提供 LLM Flow Monitor 的 Tauri 命令接口，用于前端访问 Flow 数据。
//!
//! **Validates: Requirements 10.1-10.7**

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;

use crate::flow_monitor::{
    ExportFormat, ExportOptions, FlowAnnotations, FlowExporter, FlowFilter, FlowMonitor,
    FlowQueryResult, FlowQueryService, FlowSearchResult, FlowSortBy, FlowStats, LLMFlow,
};

// ============================================================================
// 状态封装
// ============================================================================

/// FlowMonitor 状态封装
pub struct FlowMonitorState(pub Arc<FlowMonitor>);

/// FlowQueryService 状态封装
pub struct FlowQueryServiceState(pub Arc<FlowQueryService>);

// ============================================================================
// 请求/响应类型
// ============================================================================

/// 查询 Flow 请求参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryFlowsRequest {
    /// 过滤条件
    #[serde(default)]
    pub filter: FlowFilter,
    /// 排序字段
    #[serde(default)]
    pub sort_by: FlowSortBy,
    /// 是否降序
    #[serde(default = "default_true")]
    pub sort_desc: bool,
    /// 页码（从 1 开始）
    #[serde(default = "default_page")]
    pub page: usize,
    /// 每页大小
    #[serde(default = "default_page_size")]
    pub page_size: usize,
}

fn default_true() -> bool {
    true
}

fn default_page() -> usize {
    1
}

fn default_page_size() -> usize {
    20
}

impl Default for QueryFlowsRequest {
    fn default() -> Self {
        Self {
            filter: FlowFilter::default(),
            sort_by: FlowSortBy::default(),
            sort_desc: true,
            page: 1,
            page_size: 20,
        }
    }
}

/// 搜索 Flow 请求参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchFlowsRequest {
    /// 搜索关键词
    pub query: String,
    /// 最大返回数量
    #[serde(default = "default_search_limit")]
    pub limit: usize,
}

fn default_search_limit() -> usize {
    50
}

/// 导出 Flow 请求参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportFlowsRequest {
    /// 导出格式
    pub format: ExportFormat,
    /// 过滤条件
    #[serde(default)]
    pub filter: Option<FlowFilter>,
    /// 是否包含原始请求/响应体
    #[serde(default = "default_true")]
    pub include_raw: bool,
    /// 是否包含流式 chunks
    #[serde(default)]
    pub include_stream_chunks: bool,
    /// 是否脱敏敏感数据
    #[serde(default)]
    pub redact_sensitive: bool,
    /// Flow ID 列表（如果指定，则只导出这些 Flow）
    #[serde(default)]
    pub flow_ids: Option<Vec<String>>,
}

/// 导出结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportFlowsResponse {
    /// 导出的数据（JSON 字符串）
    pub data: String,
    /// 导出的 Flow 数量
    pub count: usize,
    /// 导出格式
    pub format: ExportFormat,
}

/// 更新标注请求参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateAnnotationsRequest {
    /// Flow ID
    pub flow_id: String,
    /// 标注信息
    pub annotations: FlowAnnotations,
}

/// 清理 Flow 请求参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanupFlowsRequest {
    /// 保留天数（清理此天数之前的数据）
    pub retention_days: u32,
}

/// 清理结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanupFlowsResponse {
    /// 清理的 Flow 数量
    pub cleaned_count: usize,
    /// 清理的文件数量
    pub cleaned_files: usize,
    /// 释放的空间（字节）
    pub freed_bytes: u64,
}

// ============================================================================
// Tauri 命令实现
// ============================================================================

/// 查询 Flow 列表
///
/// **Validates: Requirements 10.1**
///
/// # Arguments
/// * `request` - 查询请求参数
/// * `query_service` - 查询服务状态
///
/// # Returns
/// * `Ok(FlowQueryResult)` - 成功时返回查询结果
/// * `Err(String)` - 失败时返回错误消息
#[tauri::command]
pub async fn query_flows(
    request: QueryFlowsRequest,
    query_service: State<'_, FlowQueryServiceState>,
) -> Result<FlowQueryResult, String> {
    query_service
        .0
        .query(
            request.filter,
            request.sort_by,
            request.sort_desc,
            request.page,
            request.page_size,
        )
        .await
        .map_err(|e| format!("查询 Flow 失败: {}", e))
}

/// 获取单个 Flow 详情
///
/// **Validates: Requirements 10.2**
///
/// # Arguments
/// * `flow_id` - Flow ID
/// * `query_service` - 查询服务状态
///
/// # Returns
/// * `Ok(Some(LLMFlow))` - 成功时返回 Flow 详情
/// * `Ok(None)` - Flow 不存在
/// * `Err(String)` - 失败时返回错误消息
#[tauri::command]
pub async fn get_flow_detail(
    flow_id: String,
    query_service: State<'_, FlowQueryServiceState>,
) -> Result<Option<LLMFlow>, String> {
    query_service
        .0
        .get_flow(&flow_id)
        .await
        .map_err(|e| format!("获取 Flow 详情失败: {}", e))
}

/// 全文搜索 Flow
///
/// **Validates: Requirements 10.3**
///
/// # Arguments
/// * `request` - 搜索请求参数
/// * `query_service` - 查询服务状态
///
/// # Returns
/// * `Ok(Vec<FlowSearchResult>)` - 成功时返回搜索结果
/// * `Err(String)` - 失败时返回错误消息
#[tauri::command]
pub async fn search_flows(
    request: SearchFlowsRequest,
    query_service: State<'_, FlowQueryServiceState>,
) -> Result<Vec<FlowSearchResult>, String> {
    query_service
        .0
        .search(&request.query, request.limit)
        .await
        .map_err(|e| format!("搜索 Flow 失败: {}", e))
}

/// 获取 Flow 统计信息
///
/// **Validates: Requirements 10.4**
///
/// # Arguments
/// * `filter` - 过滤条件（可选）
/// * `query_service` - 查询服务状态
///
/// # Returns
/// * `Ok(FlowStats)` - 成功时返回统计信息
/// * `Err(String)` - 失败时返回错误消息
#[tauri::command]
pub async fn get_flow_stats(
    filter: Option<FlowFilter>,
    query_service: State<'_, FlowQueryServiceState>,
) -> Result<FlowStats, String> {
    let filter = filter.unwrap_or_default();
    Ok(query_service.0.get_stats(&filter).await)
}

/// 导出 Flow
///
/// **Validates: Requirements 10.5**
///
/// # Arguments
/// * `request` - 导出请求参数
/// * `query_service` - 查询服务状态
///
/// # Returns
/// * `Ok(ExportFlowsResponse)` - 成功时返回导出结果
/// * `Err(String)` - 失败时返回错误消息
#[tauri::command]
pub async fn export_flows(
    request: ExportFlowsRequest,
    query_service: State<'_, FlowQueryServiceState>,
) -> Result<ExportFlowsResponse, String> {
    // 获取要导出的 Flow
    let flows = if let Some(flow_ids) = request.flow_ids {
        // 按 ID 列表获取
        let mut flows = Vec::new();
        for id in flow_ids {
            if let Ok(Some(flow)) = query_service.0.get_flow(&id).await {
                flows.push(flow);
            }
        }
        flows
    } else {
        // 按过滤条件获取
        let filter = request.filter.unwrap_or_default();
        let result = query_service
            .0
            .query(filter, FlowSortBy::CreatedAt, true, 1, 10000)
            .await
            .map_err(|e| format!("查询 Flow 失败: {}", e))?;
        result.flows
    };

    let count = flows.len();

    // 创建导出器
    let options = ExportOptions {
        format: request.format,
        filter: None,
        include_raw: request.include_raw,
        include_stream_chunks: request.include_stream_chunks,
        redact_sensitive: request.redact_sensitive,
        redaction_rules: Vec::new(),
        compress: false,
    };
    let exporter = FlowExporter::new(options);

    // 导出数据
    let data = match request.format {
        ExportFormat::HAR => {
            let har = exporter.export_har(&flows);
            serde_json::to_string_pretty(&har).map_err(|e| format!("序列化 HAR 失败: {}", e))?
        }
        ExportFormat::JSON => {
            let json = exporter.export_json(&flows);
            serde_json::to_string_pretty(&json).map_err(|e| format!("序列化 JSON 失败: {}", e))?
        }
        ExportFormat::JSONL => exporter.export_jsonl(&flows),
        ExportFormat::Markdown => exporter.export_markdown_multiple(&flows),
        ExportFormat::CSV => exporter.export_csv(&flows),
    };

    Ok(ExportFlowsResponse {
        data,
        count,
        format: request.format,
    })
}

/// 更新 Flow 标注
///
/// **Validates: Requirements 10.6**
///
/// # Arguments
/// * `request` - 更新标注请求参数
/// * `monitor` - Flow 监控服务状态
///
/// # Returns
/// * `Ok(bool)` - 成功时返回是否更新成功
/// * `Err(String)` - 失败时返回错误消息
#[tauri::command]
pub async fn update_flow_annotations(
    request: UpdateAnnotationsRequest,
    monitor: State<'_, FlowMonitorState>,
) -> Result<bool, String> {
    let updated = monitor
        .0
        .update_annotations(&request.flow_id, request.annotations)
        .await;
    Ok(updated)
}

/// 切换 Flow 收藏状态
///
/// **Validates: Requirements 10.6**
///
/// # Arguments
/// * `flow_id` - Flow ID
/// * `monitor` - Flow 监控服务状态
///
/// # Returns
/// * `Ok(bool)` - 成功时返回是否更新成功
/// * `Err(String)` - 失败时返回错误消息
#[tauri::command]
pub async fn toggle_flow_starred(
    flow_id: String,
    monitor: State<'_, FlowMonitorState>,
) -> Result<bool, String> {
    let updated = monitor.0.toggle_starred(&flow_id).await;
    Ok(updated)
}

/// 添加 Flow 评论
///
/// **Validates: Requirements 10.6**
///
/// # Arguments
/// * `flow_id` - Flow ID
/// * `comment` - 评论内容
/// * `monitor` - Flow 监控服务状态
///
/// # Returns
/// * `Ok(bool)` - 成功时返回是否更新成功
/// * `Err(String)` - 失败时返回错误消息
#[tauri::command]
pub async fn add_flow_comment(
    flow_id: String,
    comment: String,
    monitor: State<'_, FlowMonitorState>,
) -> Result<bool, String> {
    let updated = monitor.0.add_comment(&flow_id, comment).await;
    Ok(updated)
}

/// 添加 Flow 标签
///
/// **Validates: Requirements 10.6**
///
/// # Arguments
/// * `flow_id` - Flow ID
/// * `tag` - 标签
/// * `monitor` - Flow 监控服务状态
///
/// # Returns
/// * `Ok(bool)` - 成功时返回是否更新成功
/// * `Err(String)` - 失败时返回错误消息
#[tauri::command]
pub async fn add_flow_tag(
    flow_id: String,
    tag: String,
    monitor: State<'_, FlowMonitorState>,
) -> Result<bool, String> {
    let updated = monitor.0.add_tag(&flow_id, tag).await;
    Ok(updated)
}

/// 移除 Flow 标签
///
/// **Validates: Requirements 10.6**
///
/// # Arguments
/// * `flow_id` - Flow ID
/// * `tag` - 标签
/// * `monitor` - Flow 监控服务状态
///
/// # Returns
/// * `Ok(bool)` - 成功时返回是否更新成功
/// * `Err(String)` - 失败时返回错误消息
#[tauri::command]
pub async fn remove_flow_tag(
    flow_id: String,
    tag: String,
    monitor: State<'_, FlowMonitorState>,
) -> Result<bool, String> {
    let updated = monitor.0.remove_tag(&flow_id, &tag).await;
    Ok(updated)
}

/// 设置 Flow 标记
///
/// **Validates: Requirements 10.6**
///
/// # Arguments
/// * `flow_id` - Flow ID
/// * `marker` - 标记（如 ⭐、🔴、🟢，None 表示清除标记）
/// * `monitor` - Flow 监控服务状态
///
/// # Returns
/// * `Ok(bool)` - 成功时返回是否更新成功
/// * `Err(String)` - 失败时返回错误消息
#[tauri::command]
pub async fn set_flow_marker(
    flow_id: String,
    marker: Option<String>,
    monitor: State<'_, FlowMonitorState>,
) -> Result<bool, String> {
    let updated = monitor.0.set_marker(&flow_id, marker).await;
    Ok(updated)
}

/// 清理旧的 Flow 数据
///
/// **Validates: Requirements 10.7**
///
/// # Arguments
/// * `request` - 清理请求参数
/// * `monitor` - Flow 监控服务状态
///
/// # Returns
/// * `Ok(CleanupFlowsResponse)` - 成功时返回清理结果
/// * `Err(String)` - 失败时返回错误消息
#[tauri::command]
pub async fn cleanup_flows(
    request: CleanupFlowsRequest,
    monitor: State<'_, FlowMonitorState>,
) -> Result<CleanupFlowsResponse, String> {
    // 计算清理时间点
    let before = chrono::Utc::now() - chrono::Duration::days(request.retention_days as i64);

    // 清理文件存储
    let mut cleaned_count = 0;
    let mut cleaned_files = 0;
    let mut freed_bytes = 0u64;

    if let Some(file_store) = monitor.0.file_store() {
        match file_store.cleanup(before) {
            Ok(result) => {
                cleaned_count = result.flows_deleted;
                cleaned_files = result.files_deleted;
                freed_bytes = result.bytes_freed;
            }
            Err(e) => {
                tracing::error!("清理文件存储失败: {}", e);
                return Err(format!("清理文件存储失败: {}", e));
            }
        }
    }

    Ok(CleanupFlowsResponse {
        cleaned_count,
        cleaned_files,
        freed_bytes,
    })
}

/// 获取最近的 Flow 列表
///
/// **Validates: Requirements 10.1**
///
/// # Arguments
/// * `limit` - 最大返回数量
/// * `query_service` - 查询服务状态
///
/// # Returns
/// * `Ok(Vec<LLMFlow>)` - 成功时返回 Flow 列表
/// * `Err(String)` - 失败时返回错误消息
#[tauri::command]
pub async fn get_recent_flows(
    limit: Option<usize>,
    query_service: State<'_, FlowQueryServiceState>,
) -> Result<Vec<LLMFlow>, String> {
    let limit = limit.unwrap_or(20);
    Ok(query_service.0.get_recent(limit).await)
}

/// 获取 Flow Monitor 状态
///
/// **Validates: Requirements 10.1**
///
/// # Arguments
/// * `monitor` - Flow 监控服务状态
///
/// # Returns
/// * `Ok(FlowMonitorStatus)` - 成功时返回监控状态
/// * `Err(String)` - 失败时返回错误消息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowMonitorStatus {
    /// 是否启用
    pub enabled: bool,
    /// 活跃 Flow 数量
    pub active_flow_count: usize,
    /// 内存中的 Flow 数量
    pub memory_flow_count: usize,
    /// 最大内存 Flow 数量
    pub max_memory_flows: usize,
}

#[tauri::command]
pub async fn get_flow_monitor_status(
    monitor: State<'_, FlowMonitorState>,
) -> Result<FlowMonitorStatus, String> {
    let config = monitor.0.config().await;
    Ok(FlowMonitorStatus {
        enabled: monitor.0.is_enabled().await,
        active_flow_count: monitor.0.active_flow_count().await,
        memory_flow_count: monitor.0.memory_flow_count().await,
        max_memory_flows: config.max_memory_flows,
    })
}

/// 启用 Flow Monitor
///
/// **Validates: Requirements 10.1**
///
/// # Arguments
/// * `monitor` - Flow 监控服务状态
///
/// # Returns
/// * `Ok(())` - 成功
/// * `Err(String)` - 失败时返回错误消息
#[tauri::command]
pub async fn enable_flow_monitor(monitor: State<'_, FlowMonitorState>) -> Result<(), String> {
    monitor.0.enable().await;
    Ok(())
}

/// 禁用 Flow Monitor
///
/// **Validates: Requirements 10.1**
///
/// # Arguments
/// * `monitor` - Flow 监控服务状态
///
/// # Returns
/// * `Ok(())` - 成功
/// * `Err(String)` - 失败时返回错误消息
#[tauri::command]
pub async fn disable_flow_monitor(monitor: State<'_, FlowMonitorState>) -> Result<(), String> {
    monitor.0.disable().await;
    Ok(())
}

// ============================================================================
// 测试模块
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_query_flows_request_default() {
        let request = QueryFlowsRequest::default();
        assert_eq!(request.page, 1);
        assert_eq!(request.page_size, 20);
        assert!(request.sort_desc);
    }

    #[test]
    fn test_search_flows_request_default_limit() {
        let request = SearchFlowsRequest {
            query: "test".to_string(),
            limit: default_search_limit(),
        };
        assert_eq!(request.limit, 50);
    }

    #[test]
    fn test_export_flows_request_serialization() {
        let request = ExportFlowsRequest {
            format: ExportFormat::JSON,
            filter: None,
            include_raw: true,
            include_stream_chunks: false,
            redact_sensitive: false,
            flow_ids: None,
        };

        let json = serde_json::to_string(&request).unwrap();
        let deserialized: ExportFlowsRequest = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.format, ExportFormat::JSON);
        assert!(deserialized.include_raw);
    }
}

// ============================================================================
// 实时事件订阅命令
// ============================================================================

use tauri::{AppHandle, Emitter};

/// 订阅 Flow 实时事件
///
/// 启动一个后台任务，将 Flow 事件通过 Tauri 事件系统推送到前端。
/// 前端可以通过 `listen("flow-event", ...)` 来接收事件。
///
/// # Arguments
/// * `app` - Tauri AppHandle
/// * `monitor` - Flow 监控服务状态
///
/// # Returns
/// * `Ok(())` - 成功启动订阅
/// * `Err(String)` - 失败时返回错误消息
#[tauri::command]
pub async fn subscribe_flow_events(
    app: AppHandle,
    monitor: State<'_, FlowMonitorState>,
) -> Result<(), String> {
    let mut receiver = monitor.0.subscribe();

    // 启动后台任务来转发事件
    tokio::spawn(async move {
        loop {
            match receiver.recv().await {
                Ok(event) => {
                    // 将事件发送到前端
                    if let Err(e) = app.emit("flow-event", &event) {
                        tracing::warn!("发送 Flow 事件到前端失败: {}", e);
                    }
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                    tracing::warn!("Flow 事件接收器落后 {} 条消息", n);
                }
                Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                    tracing::debug!("Flow 事件通道已关闭");
                    break;
                }
            }
        }
    });

    Ok(())
}

/// 获取所有可用的 Flow 标签
///
/// # Arguments
/// * `query_service` - 查询服务状态
///
/// # Returns
/// * `Ok(Vec<String>)` - 成功时返回标签列表
/// * `Err(String)` - 失败时返回错误消息
#[tauri::command]
pub async fn get_all_flow_tags(
    _query_service: State<'_, FlowQueryServiceState>,
) -> Result<Vec<String>, String> {
    // TODO: 实现从存储中获取所有标签
    // 目前返回空列表
    Ok(Vec::new())
}
