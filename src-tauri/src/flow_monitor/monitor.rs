//! Flow 核心监控服务
//!
//! 该模块实现 LLM Flow 的核心监控功能，包括：
//! - Flow 生命周期管理（创建、更新、完成、失败）
//! - 流式响应处理
//! - 实时事件发送
//! - 标注管理

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use uuid::Uuid;

use super::file_store::FlowFileStore;
use super::memory_store::FlowMemoryStore;
use super::models::{
    FlowAnnotations, FlowError, FlowMetadata, FlowState, FlowType, LLMFlow, LLMRequest,
    LLMResponse, TokenUsage,
};
use super::stream_rebuilder::{StreamFormat, StreamRebuilder};

// ============================================================================
// 配置结构
// ============================================================================

/// Flow 监控配置
///
/// 控制 Flow Monitor 的行为，包括启用/禁用、缓存大小、持久化等。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowMonitorConfig {
    /// 是否启用监控
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    /// 最大内存 Flow 数量
    #[serde(default = "default_max_memory_flows")]
    pub max_memory_flows: usize,
    /// 是否持久化到文件
    #[serde(default = "default_persist_to_file")]
    pub persist_to_file: bool,
    /// 保留天数
    #[serde(default = "default_retention_days")]
    pub retention_days: u32,
    /// 是否保存原始流式 chunks
    #[serde(default)]
    pub save_stream_chunks: bool,
    /// 最大请求体大小（字节）
    #[serde(default = "default_max_request_body_size")]
    pub max_request_body_size: usize,
    /// 最大响应体大小（字节）
    #[serde(default = "default_max_response_body_size")]
    pub max_response_body_size: usize,
    /// 是否保存图片内容
    #[serde(default)]
    pub save_image_content: bool,
    /// 缩略图大小
    #[serde(default = "default_thumbnail_size")]
    pub thumbnail_size: (u32, u32),
    /// 采样率（0.0-1.0，1.0 表示全部采样）
    #[serde(default = "default_sampling_rate")]
    pub sampling_rate: f32,
    /// 排除的模型列表（支持通配符）
    #[serde(default)]
    pub excluded_models: Vec<String>,
    /// 排除的路径列表（支持通配符）
    #[serde(default)]
    pub excluded_paths: Vec<String>,
}

fn default_enabled() -> bool {
    true
}

fn default_max_memory_flows() -> usize {
    1000
}

fn default_persist_to_file() -> bool {
    true
}

fn default_retention_days() -> u32 {
    7
}

fn default_max_request_body_size() -> usize {
    10 * 1024 * 1024 // 10MB
}

fn default_max_response_body_size() -> usize {
    10 * 1024 * 1024 // 10MB
}

fn default_thumbnail_size() -> (u32, u32) {
    (128, 128)
}

fn default_sampling_rate() -> f32 {
    1.0
}

impl Default for FlowMonitorConfig {
    fn default() -> Self {
        Self {
            enabled: default_enabled(),
            max_memory_flows: default_max_memory_flows(),
            persist_to_file: default_persist_to_file(),
            retention_days: default_retention_days(),
            save_stream_chunks: false,
            max_request_body_size: default_max_request_body_size(),
            max_response_body_size: default_max_response_body_size(),
            save_image_content: false,
            thumbnail_size: default_thumbnail_size(),
            sampling_rate: default_sampling_rate(),
            excluded_models: Vec::new(),
            excluded_paths: Vec::new(),
        }
    }
}

impl FlowMonitorConfig {
    /// 检查是否应该监控该请求
    pub fn should_monitor(&self, model: &str, path: &str) -> bool {
        if !self.enabled {
            return false;
        }

        // 检查采样率
        if self.sampling_rate < 1.0 {
            let random: f32 = rand::random();
            if random > self.sampling_rate {
                return false;
            }
        }

        // 检查排除的模型
        for pattern in &self.excluded_models {
            if Self::match_pattern(pattern, model) {
                return false;
            }
        }

        // 检查排除的路径
        for pattern in &self.excluded_paths {
            if Self::match_pattern(pattern, path) {
                return false;
            }
        }

        true
    }

    /// 模式匹配（支持 * 通配符）
    fn match_pattern(pattern: &str, text: &str) -> bool {
        if pattern == "*" {
            return true;
        }

        if pattern.contains('*') {
            let parts: Vec<&str> = pattern.split('*').collect();
            let mut pos = 0;
            let text_lower = text.to_lowercase();

            for (i, part) in parts.iter().enumerate() {
                if part.is_empty() {
                    continue;
                }

                let part_lower = part.to_lowercase();
                if let Some(found_pos) = text_lower[pos..].find(&part_lower) {
                    if i == 0 && found_pos != 0 {
                        return false;
                    }
                    pos += found_pos + part.len();
                } else {
                    return false;
                }
            }

            if !pattern.ends_with('*') && pos != text.len() {
                return false;
            }

            true
        } else {
            text.to_lowercase() == pattern.to_lowercase()
        }
    }
}

// ============================================================================
// 事件类型
// ============================================================================

/// Flow 摘要信息
///
/// 用于事件通知，包含 Flow 的关键信息。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowSummary {
    /// Flow ID
    pub id: String,
    /// 流类型
    pub flow_type: FlowType,
    /// 模型名称
    pub model: String,
    /// 提供商
    pub provider: String,
    /// 状态
    pub state: FlowState,
    /// 创建时间
    pub created_at: DateTime<Utc>,
    /// 耗时（毫秒）
    pub duration_ms: Option<u64>,
    /// Token 使用量
    pub usage: Option<TokenUsage>,
    /// 是否有错误
    pub has_error: bool,
    /// 是否有工具调用
    pub has_tool_calls: bool,
    /// 是否有思维链
    pub has_thinking: bool,
}

impl From<&LLMFlow> for FlowSummary {
    fn from(flow: &LLMFlow) -> Self {
        Self {
            id: flow.id.clone(),
            flow_type: flow.flow_type.clone(),
            model: flow.request.model.clone(),
            provider: format!("{:?}", flow.metadata.provider),
            state: flow.state.clone(),
            created_at: flow.timestamps.created,
            duration_ms: if flow.timestamps.duration_ms > 0 {
                Some(flow.timestamps.duration_ms)
            } else {
                None
            },
            usage: flow.response.as_ref().map(|r| r.usage.clone()),
            has_error: flow.error.is_some(),
            has_tool_calls: flow
                .response
                .as_ref()
                .map_or(false, |r| !r.tool_calls.is_empty()),
            has_thinking: flow
                .response
                .as_ref()
                .map_or(false, |r| r.thinking.is_some()),
        }
    }
}

/// Flow 更新信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowUpdate {
    /// 新状态
    pub state: Option<FlowState>,
    /// 内容增量
    pub content_delta: Option<String>,
    /// 当前内容长度
    pub content_length: Option<usize>,
    /// 当前 chunk 数量
    pub chunk_count: Option<u32>,
}

/// 实时 Flow 事件
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type")]
pub enum FlowEvent {
    /// Flow 开始
    FlowStarted { flow: FlowSummary },
    /// Flow 更新
    FlowUpdated { id: String, update: FlowUpdate },
    /// Flow 完成
    FlowCompleted { id: String, summary: FlowSummary },
    /// Flow 失败
    FlowFailed { id: String, error: FlowError },
}

// ============================================================================
// 活跃 Flow 状态
// ============================================================================

/// 活跃 Flow 状态
///
/// 用于跟踪正在进行中的 Flow，包括流式响应重建器。
struct ActiveFlow {
    /// Flow 数据
    flow: LLMFlow,
    /// 流式响应重建器（如果是流式响应）
    stream_rebuilder: Option<StreamRebuilder>,
    /// 请求开始时间
    request_start: DateTime<Utc>,
}

// ============================================================================
// 核心监控服务
// ============================================================================

/// Flow 监控服务
///
/// 负责捕获和管理 LLM Flow 的核心服务。
pub struct FlowMonitor {
    /// 配置
    config: RwLock<FlowMonitorConfig>,
    /// 内存存储
    memory_store: Arc<RwLock<FlowMemoryStore>>,
    /// 文件存储（可选）
    file_store: Option<Arc<FlowFileStore>>,
    /// 活跃 Flow（正在进行中的请求）
    active_flows: RwLock<HashMap<String, ActiveFlow>>,
    /// 事件发送器
    event_sender: broadcast::Sender<FlowEvent>,
}

impl FlowMonitor {
    /// 创建新的 Flow 监控服务
    ///
    /// # 参数
    /// - `config`: 监控配置
    /// - `file_store`: 文件存储（可选）
    pub fn new(config: FlowMonitorConfig, file_store: Option<Arc<FlowFileStore>>) -> Self {
        let memory_store = Arc::new(RwLock::new(FlowMemoryStore::new(config.max_memory_flows)));
        let (event_sender, _) = broadcast::channel(1000);

        Self {
            config: RwLock::new(config),
            memory_store,
            file_store,
            active_flows: RwLock::new(HashMap::new()),
            event_sender,
        }
    }

    /// 获取内存存储的引用
    pub fn memory_store(&self) -> Arc<RwLock<FlowMemoryStore>> {
        self.memory_store.clone()
    }

    /// 获取文件存储的引用
    pub fn file_store(&self) -> Option<Arc<FlowFileStore>> {
        self.file_store.clone()
    }

    /// 获取当前配置
    pub async fn config(&self) -> FlowMonitorConfig {
        self.config.read().await.clone()
    }

    /// 更新配置
    pub async fn update_config(&self, config: FlowMonitorConfig) {
        let mut current = self.config.write().await;

        // 如果缓存大小改变，需要调整内存存储
        if current.max_memory_flows != config.max_memory_flows {
            // 创建新的内存存储（旧数据会丢失）
            // 实际应用中可能需要更复杂的迁移逻辑
            let mut store = self.memory_store.write().await;
            *store = FlowMemoryStore::new(config.max_memory_flows);
        }

        *current = config;
    }

    /// 订阅实时事件
    pub fn subscribe(&self) -> broadcast::Receiver<FlowEvent> {
        self.event_sender.subscribe()
    }

    /// 开始捕获一个新的 Flow
    ///
    /// # 参数
    /// - `request`: LLM 请求
    /// - `metadata`: Flow 元数据
    ///
    /// # 返回
    /// - `Some(flow_id)`: 成功创建 Flow，返回 Flow ID
    /// - `None`: 根据配置跳过监控
    pub async fn start_flow(&self, request: LLMRequest, metadata: FlowMetadata) -> Option<String> {
        let config = self.config.read().await;

        // 检查是否应该监控
        if !config.should_monitor(&request.model, &request.path) {
            return None;
        }

        // 生成唯一 ID
        let flow_id = Uuid::new_v4().to_string();

        // 确定 Flow 类型
        let flow_type = Self::determine_flow_type(&request.path);

        // 创建 Flow
        let flow = LLMFlow::new(flow_id.clone(), flow_type, request.clone(), metadata);

        // 创建活跃 Flow 状态
        let active_flow = ActiveFlow {
            flow: flow.clone(),
            stream_rebuilder: None,
            request_start: Utc::now(),
        };

        // 添加到活跃 Flow
        {
            let mut active = self.active_flows.write().await;
            active.insert(flow_id.clone(), active_flow);
        }

        // 发送事件
        let summary = FlowSummary::from(&flow);
        let _ = self
            .event_sender
            .send(FlowEvent::FlowStarted { flow: summary });

        Some(flow_id)
    }

    /// 根据路径确定 Flow 类型
    fn determine_flow_type(path: &str) -> FlowType {
        let path_lower = path.to_lowercase();

        if path_lower.contains("/chat/completions") {
            FlowType::ChatCompletions
        } else if path_lower.contains("/messages") {
            FlowType::AnthropicMessages
        } else if path_lower.contains(":generatecontent") || path_lower.contains("/generate") {
            FlowType::GeminiGenerateContent
        } else if path_lower.contains("/embeddings") {
            FlowType::Embeddings
        } else {
            FlowType::Other(path.to_string())
        }
    }

    /// 设置 Flow 为流式模式
    ///
    /// # 参数
    /// - `flow_id`: Flow ID
    /// - `format`: 流式响应格式
    pub async fn set_streaming(&self, flow_id: &str, format: StreamFormat) {
        let config = self.config.read().await;
        let save_chunks = config.save_stream_chunks;
        drop(config);

        let mut active = self.active_flows.write().await;
        if let Some(active_flow) = active.get_mut(flow_id) {
            active_flow.flow.state = FlowState::Streaming;
            active_flow.stream_rebuilder =
                Some(StreamRebuilder::new(format).with_save_raw_chunks(save_chunks));

            // 发送更新事件
            let _ = self.event_sender.send(FlowEvent::FlowUpdated {
                id: flow_id.to_string(),
                update: FlowUpdate {
                    state: Some(FlowState::Streaming),
                    content_delta: None,
                    content_length: None,
                    chunk_count: None,
                },
            });
        }
    }

    /// 处理流式 chunk
    ///
    /// # 参数
    /// - `flow_id`: Flow ID
    /// - `event`: SSE 事件类型（可选）
    /// - `data`: SSE 数据内容
    pub async fn process_chunk(&self, flow_id: &str, event: Option<&str>, data: &str) {
        let mut active = self.active_flows.write().await;
        if let Some(active_flow) = active.get_mut(flow_id) {
            if let Some(ref mut rebuilder) = active_flow.stream_rebuilder {
                // 处理 chunk
                if let Err(e) = rebuilder.process_event(event, data) {
                    tracing::warn!("处理流式 chunk 失败: {}", e);
                }

                // 发送更新事件（可选，根据需要调整频率）
                // 这里简化处理，每个 chunk 都发送事件
                // 实际应用中可能需要节流
            }
        }
    }

    /// 完成 Flow
    ///
    /// # 参数
    /// - `flow_id`: Flow ID
    /// - `response`: LLM 响应（如果是非流式响应）
    pub async fn complete_flow(&self, flow_id: &str, response: Option<LLMResponse>) {
        let mut active = self.active_flows.write().await;

        if let Some(mut active_flow) = active.remove(flow_id) {
            let now = Utc::now();

            // 如果有流式重建器，使用重建的响应
            let final_response = if let Some(rebuilder) = active_flow.stream_rebuilder.take() {
                Some(rebuilder.finish())
            } else {
                response
            };

            // 更新 Flow
            active_flow.flow.response = final_response;
            active_flow.flow.state = FlowState::Completed;
            active_flow.flow.timestamps.response_end = Some(now);
            active_flow.flow.timestamps.calculate_duration();
            active_flow.flow.timestamps.calculate_ttfb();

            // 保存到内存存储
            {
                let mut store = self.memory_store.write().await;
                store.add(active_flow.flow.clone());
            }

            // 保存到文件存储
            if let Some(ref file_store) = self.file_store {
                if let Err(e) = file_store.write(&active_flow.flow) {
                    tracing::error!("保存 Flow 到文件失败: {}", e);
                }
            }

            // 发送完成事件
            let summary = FlowSummary::from(&active_flow.flow);
            let _ = self.event_sender.send(FlowEvent::FlowCompleted {
                id: flow_id.to_string(),
                summary,
            });
        }
    }

    /// 标记 Flow 失败
    ///
    /// # 参数
    /// - `flow_id`: Flow ID
    /// - `error`: 错误信息
    pub async fn fail_flow(&self, flow_id: &str, error: FlowError) {
        let mut active = self.active_flows.write().await;

        if let Some(mut active_flow) = active.remove(flow_id) {
            let now = Utc::now();

            // 更新 Flow
            active_flow.flow.error = Some(error.clone());
            active_flow.flow.state = FlowState::Failed;
            active_flow.flow.timestamps.response_end = Some(now);
            active_flow.flow.timestamps.calculate_duration();

            // 保存到内存存储
            {
                let mut store = self.memory_store.write().await;
                store.add(active_flow.flow.clone());
            }

            // 保存到文件存储
            if let Some(ref file_store) = self.file_store {
                if let Err(e) = file_store.write(&active_flow.flow) {
                    tracing::error!("保存 Flow 到文件失败: {}", e);
                }
            }

            // 发送失败事件
            let _ = self.event_sender.send(FlowEvent::FlowFailed {
                id: flow_id.to_string(),
                error,
            });
        }
    }

    /// 取消 Flow
    ///
    /// # 参数
    /// - `flow_id`: Flow ID
    pub async fn cancel_flow(&self, flow_id: &str) {
        let mut active = self.active_flows.write().await;

        if let Some(mut active_flow) = active.remove(flow_id) {
            let now = Utc::now();

            // 更新 Flow
            active_flow.flow.state = FlowState::Cancelled;
            active_flow.flow.timestamps.response_end = Some(now);
            active_flow.flow.timestamps.calculate_duration();

            // 保存到内存存储
            {
                let mut store = self.memory_store.write().await;
                store.add(active_flow.flow.clone());
            }

            // 保存到文件存储
            if let Some(ref file_store) = self.file_store {
                if let Err(e) = file_store.write(&active_flow.flow) {
                    tracing::error!("保存 Flow 到文件失败: {}", e);
                }
            }
        }
    }

    /// 更新 Flow 标注
    ///
    /// # 参数
    /// - `flow_id`: Flow ID
    /// - `annotations`: 新的标注信息
    ///
    /// # 返回
    /// - `true`: 更新成功
    /// - `false`: Flow 不存在
    pub async fn update_annotations(&self, flow_id: &str, annotations: FlowAnnotations) -> bool {
        // 先尝试更新内存中的 Flow
        let updated = {
            let store = self.memory_store.read().await;
            store.update(flow_id, |flow| {
                flow.annotations = annotations.clone();
            })
        };

        // 如果内存中存在，同时更新文件存储的索引
        if updated {
            if let Some(ref file_store) = self.file_store {
                if let Err(e) = file_store.update_annotations(flow_id, &annotations) {
                    tracing::error!("更新文件存储标注失败: {}", e);
                }
            }
        }

        updated
    }

    /// 收藏/取消收藏 Flow
    pub async fn toggle_starred(&self, flow_id: &str) -> bool {
        let store = self.memory_store.read().await;
        store.update(flow_id, |flow| {
            flow.annotations.starred = !flow.annotations.starred;
        })
    }

    /// 添加评论
    pub async fn add_comment(&self, flow_id: &str, comment: String) -> bool {
        let store = self.memory_store.read().await;
        store.update(flow_id, |flow| {
            flow.annotations.comment = Some(comment);
        })
    }

    /// 添加标签
    pub async fn add_tag(&self, flow_id: &str, tag: String) -> bool {
        let store = self.memory_store.read().await;
        store.update(flow_id, |flow| {
            if !flow.annotations.tags.contains(&tag) {
                flow.annotations.tags.push(tag);
            }
        })
    }

    /// 移除标签
    pub async fn remove_tag(&self, flow_id: &str, tag: &str) -> bool {
        let store = self.memory_store.read().await;
        store.update(flow_id, |flow| {
            flow.annotations.tags.retain(|t| t != tag);
        })
    }

    /// 设置标记
    pub async fn set_marker(&self, flow_id: &str, marker: Option<String>) -> bool {
        let store = self.memory_store.read().await;
        store.update(flow_id, |flow| {
            flow.annotations.marker = marker;
        })
    }

    /// 获取活跃 Flow 数量
    pub async fn active_flow_count(&self) -> usize {
        self.active_flows.read().await.len()
    }

    /// 获取内存中的 Flow 数量
    pub async fn memory_flow_count(&self) -> usize {
        self.memory_store.read().await.len()
    }

    /// 检查监控是否启用
    pub async fn is_enabled(&self) -> bool {
        self.config.read().await.enabled
    }

    /// 启用监控
    pub async fn enable(&self) {
        self.config.write().await.enabled = true;
    }

    /// 禁用监控
    pub async fn disable(&self) {
        self.config.write().await.enabled = false;
    }
}

// ============================================================================
// 测试模块
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::flow_monitor::models::{
        FlowMetadata, LLMRequest, Message, MessageContent, MessageRole, RequestParameters,
    };
    use crate::ProviderType;

    /// 创建测试用的 LLMRequest
    fn create_test_request(model: &str, path: &str) -> LLMRequest {
        LLMRequest {
            method: "POST".to_string(),
            path: path.to_string(),
            headers: HashMap::new(),
            body: serde_json::Value::Null,
            messages: vec![Message {
                role: MessageRole::User,
                content: MessageContent::Text("Hello".to_string()),
                tool_calls: None,
                tool_result: None,
                name: None,
            }],
            system_prompt: None,
            tools: None,
            model: model.to_string(),
            original_model: None,
            parameters: RequestParameters::default(),
            size_bytes: 0,
            timestamp: Utc::now(),
        }
    }

    /// 创建测试用的 FlowMetadata
    fn create_test_metadata(provider: ProviderType) -> FlowMetadata {
        FlowMetadata {
            provider,
            credential_id: Some("test-cred".to_string()),
            credential_name: Some("Test Credential".to_string()),
            ..Default::default()
        }
    }

    #[tokio::test]
    async fn test_flow_monitor_creation() {
        let config = FlowMonitorConfig::default();
        let monitor = FlowMonitor::new(config, None);

        assert!(monitor.is_enabled().await);
        assert_eq!(monitor.active_flow_count().await, 0);
        assert_eq!(monitor.memory_flow_count().await, 0);
    }

    #[tokio::test]
    async fn test_start_flow() {
        let config = FlowMonitorConfig::default();
        let monitor = FlowMonitor::new(config, None);

        let request = create_test_request("gpt-4", "/v1/chat/completions");
        let metadata = create_test_metadata(ProviderType::OpenAI);

        let flow_id = monitor.start_flow(request, metadata).await;

        assert!(flow_id.is_some());
        assert_eq!(monitor.active_flow_count().await, 1);
    }

    #[tokio::test]
    async fn test_complete_flow() {
        let config = FlowMonitorConfig::default();
        let monitor = FlowMonitor::new(config, None);

        let request = create_test_request("gpt-4", "/v1/chat/completions");
        let metadata = create_test_metadata(ProviderType::OpenAI);

        let flow_id = monitor.start_flow(request, metadata).await.unwrap();

        // 完成 Flow
        monitor.complete_flow(&flow_id, None).await;

        assert_eq!(monitor.active_flow_count().await, 0);
        assert_eq!(monitor.memory_flow_count().await, 1);
    }

    #[tokio::test]
    async fn test_fail_flow() {
        let config = FlowMonitorConfig::default();
        let monitor = FlowMonitor::new(config, None);

        let request = create_test_request("gpt-4", "/v1/chat/completions");
        let metadata = create_test_metadata(ProviderType::OpenAI);

        let flow_id = monitor.start_flow(request, metadata).await.unwrap();

        // 失败 Flow
        let error = FlowError::new(
            crate::flow_monitor::models::FlowErrorType::Network,
            "Connection failed",
        );
        monitor.fail_flow(&flow_id, error).await;

        assert_eq!(monitor.active_flow_count().await, 0);
        assert_eq!(monitor.memory_flow_count().await, 1);
    }

    #[tokio::test]
    async fn test_config_should_monitor() {
        let config = FlowMonitorConfig {
            enabled: true,
            sampling_rate: 1.0,
            excluded_models: vec!["test-*".to_string()],
            excluded_paths: vec!["/health".to_string()],
            ..Default::default()
        };

        // 正常请求应该被监控
        assert!(config.should_monitor("gpt-4", "/v1/chat/completions"));

        // 排除的模型不应该被监控
        assert!(!config.should_monitor("test-model", "/v1/chat/completions"));

        // 排除的路径不应该被监控
        assert!(!config.should_monitor("gpt-4", "/health"));
    }

    #[tokio::test]
    async fn test_disabled_monitor() {
        let config = FlowMonitorConfig {
            enabled: false,
            ..Default::default()
        };
        let monitor = FlowMonitor::new(config, None);

        let request = create_test_request("gpt-4", "/v1/chat/completions");
        let metadata = create_test_metadata(ProviderType::OpenAI);

        // 禁用时不应该创建 Flow
        let flow_id = monitor.start_flow(request, metadata).await;
        assert!(flow_id.is_none());
    }

    #[tokio::test]
    async fn test_event_subscription() {
        let config = FlowMonitorConfig::default();
        let monitor = FlowMonitor::new(config, None);

        let mut receiver = monitor.subscribe();

        let request = create_test_request("gpt-4", "/v1/chat/completions");
        let metadata = create_test_metadata(ProviderType::OpenAI);

        let flow_id = monitor.start_flow(request, metadata).await.unwrap();

        // 应该收到 FlowStarted 事件
        let event = receiver.try_recv();
        assert!(event.is_ok());
        if let FlowEvent::FlowStarted { flow } = event.unwrap() {
            assert_eq!(flow.id, flow_id);
            assert_eq!(flow.model, "gpt-4");
        } else {
            panic!("Expected FlowStarted event");
        }
    }

    #[tokio::test]
    async fn test_flow_type_detection() {
        assert_eq!(
            FlowMonitor::determine_flow_type("/v1/chat/completions"),
            FlowType::ChatCompletions
        );
        assert_eq!(
            FlowMonitor::determine_flow_type("/v1/messages"),
            FlowType::AnthropicMessages
        );
        assert_eq!(
            FlowMonitor::determine_flow_type("/v1/models/gemini-pro:generatecontent"),
            FlowType::GeminiGenerateContent
        );
        assert_eq!(
            FlowMonitor::determine_flow_type("/v1/embeddings"),
            FlowType::Embeddings
        );
    }

    #[tokio::test]
    async fn test_annotations_update() {
        let config = FlowMonitorConfig::default();
        let monitor = FlowMonitor::new(config, None);

        let request = create_test_request("gpt-4", "/v1/chat/completions");
        let metadata = create_test_metadata(ProviderType::OpenAI);

        let flow_id = monitor.start_flow(request, metadata).await.unwrap();
        monitor.complete_flow(&flow_id, None).await;

        // 测试收藏
        assert!(monitor.toggle_starred(&flow_id).await);

        // 测试添加评论
        assert!(
            monitor
                .add_comment(&flow_id, "Test comment".to_string())
                .await
        );

        // 测试添加标签
        assert!(monitor.add_tag(&flow_id, "important".to_string()).await);

        // 测试设置标记
        assert!(monitor.set_marker(&flow_id, Some("⭐".to_string())).await);
    }
}

// ============================================================================
// 属性测试模块
// ============================================================================

#[cfg(test)]
mod property_tests {
    use super::*;
    use crate::flow_monitor::models::{
        FlowErrorType, FlowMetadata, LLMRequest, Message, MessageContent, MessageRole,
        RequestParameters,
    };
    use crate::ProviderType;
    use proptest::prelude::*;
    use tokio::runtime::Runtime;

    // ========================================================================
    // 生成器
    // ========================================================================

    /// 生成随机的 ProviderType
    fn arb_provider_type() -> impl Strategy<Value = ProviderType> {
        prop_oneof![
            Just(ProviderType::Kiro),
            Just(ProviderType::Gemini),
            Just(ProviderType::Qwen),
            Just(ProviderType::OpenAI),
            Just(ProviderType::Claude),
            Just(ProviderType::Antigravity),
        ]
    }

    /// 生成随机的模型名称
    fn arb_model_name() -> impl Strategy<Value = String> {
        prop_oneof![
            Just("gpt-4".to_string()),
            Just("gpt-4-turbo".to_string()),
            Just("gpt-3.5-turbo".to_string()),
            Just("claude-3-opus".to_string()),
            Just("claude-3-sonnet".to_string()),
            Just("gemini-pro".to_string()),
        ]
    }

    /// 生成随机的路径
    fn arb_path() -> impl Strategy<Value = String> {
        prop_oneof![
            Just("/v1/chat/completions".to_string()),
            Just("/v1/messages".to_string()),
            Just("/v1/embeddings".to_string()),
        ]
    }

    /// 生成随机的 LLMRequest
    fn arb_llm_request() -> impl Strategy<Value = LLMRequest> {
        (arb_model_name(), arb_path()).prop_map(|(model, path)| LLMRequest {
            method: "POST".to_string(),
            path,
            headers: HashMap::new(),
            body: serde_json::Value::Null,
            messages: vec![Message {
                role: MessageRole::User,
                content: MessageContent::Text("Test message".to_string()),
                tool_calls: None,
                tool_result: None,
                name: None,
            }],
            system_prompt: None,
            tools: None,
            model,
            original_model: None,
            parameters: RequestParameters::default(),
            size_bytes: 0,
            timestamp: Utc::now(),
        })
    }

    /// 生成随机的 FlowMetadata
    fn arb_flow_metadata() -> impl Strategy<Value = FlowMetadata> {
        arb_provider_type().prop_map(|provider| FlowMetadata {
            provider,
            credential_id: Some("test-cred".to_string()),
            credential_name: Some("Test Credential".to_string()),
            ..Default::default()
        })
    }

    /// 生成随机的 FlowErrorType
    fn arb_flow_error_type() -> impl Strategy<Value = FlowErrorType> {
        prop_oneof![
            Just(FlowErrorType::Network),
            Just(FlowErrorType::Timeout),
            Just(FlowErrorType::Authentication),
            Just(FlowErrorType::RateLimit),
            Just(FlowErrorType::ServerError),
            Just(FlowErrorType::BadRequest),
        ]
    }

    // ========================================================================
    // 属性测试
    // ========================================================================

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(20))]

        /// **Feature: llm-flow-monitor, Property 9: 事件发送正确性**
        /// **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
        ///
        /// *对于任意* Flow 生命周期操作（开始、更新、完成、失败），
        /// 应该发出对应的事件，且事件内容应该正确反映 Flow 状态。
        #[test]
        fn prop_event_emission_correctness(
            request in arb_llm_request(),
            metadata in arb_flow_metadata(),
        ) {
            let rt = Runtime::new().unwrap();
            rt.block_on(async {
                let config = FlowMonitorConfig::default();
                let monitor = FlowMonitor::new(config, None);

                let mut receiver = monitor.subscribe();

                // 开始 Flow
                let flow_id = monitor.start_flow(request.clone(), metadata.clone()).await;
                prop_assert!(flow_id.is_some(), "Flow 应该被创建");
                let flow_id = flow_id.unwrap();

                // 验证 FlowStarted 事件
                let event = receiver.try_recv();
                prop_assert!(event.is_ok(), "应该收到 FlowStarted 事件");
                if let FlowEvent::FlowStarted { flow } = event.unwrap() {
                    prop_assert_eq!(flow.id, flow_id.clone(), "事件中的 Flow ID 应该正确");
                    prop_assert_eq!(flow.model, request.model, "事件中的模型应该正确");
                    prop_assert_eq!(
                        flow.state,
                        FlowState::Pending,
                        "新 Flow 状态应该是 Pending"
                    );
                } else {
                    prop_assert!(false, "应该是 FlowStarted 事件");
                }

                // 完成 Flow
                monitor.complete_flow(&flow_id, None).await;

                // 验证 FlowCompleted 事件
                let event = receiver.try_recv();
                prop_assert!(event.is_ok(), "应该收到 FlowCompleted 事件");
                if let FlowEvent::FlowCompleted { id, summary } = event.unwrap() {
                    prop_assert_eq!(id, flow_id.clone(), "事件中的 Flow ID 应该正确");
                    prop_assert_eq!(
                        summary.state,
                        FlowState::Completed,
                        "完成后状态应该是 Completed"
                    );
                } else {
                    prop_assert!(false, "应该是 FlowCompleted 事件");
                }

                Ok(())
            })?;
        }

        /// **Feature: llm-flow-monitor, Property 9b: 失败事件发送正确性**
        /// **Validates: Requirements 6.4**
        ///
        /// *对于任意* Flow 失败操作，应该发出 FlowFailed 事件，
        /// 且事件内容应该包含正确的错误信息。
        #[test]
        fn prop_failure_event_correctness(
            request in arb_llm_request(),
            metadata in arb_flow_metadata(),
            error_type in arb_flow_error_type(),
        ) {
            let rt = Runtime::new().unwrap();
            rt.block_on(async {
                let config = FlowMonitorConfig::default();
                let monitor = FlowMonitor::new(config, None);

                let mut receiver = monitor.subscribe();

                // 开始 Flow
                let flow_id = monitor.start_flow(request, metadata).await.unwrap();

                // 消费 FlowStarted 事件
                let _ = receiver.try_recv();

                // 失败 Flow
                let error = FlowError::new(error_type.clone(), "Test error message");
                monitor.fail_flow(&flow_id, error.clone()).await;

                // 验证 FlowFailed 事件
                let event = receiver.try_recv();
                prop_assert!(event.is_ok(), "应该收到 FlowFailed 事件");
                if let FlowEvent::FlowFailed { id, error: evt_error } = event.unwrap() {
                    prop_assert_eq!(id, flow_id, "事件中的 Flow ID 应该正确");
                    prop_assert_eq!(
                        evt_error.error_type,
                        error_type,
                        "事件中的错误类型应该正确"
                    );
                    prop_assert_eq!(
                        evt_error.message,
                        "Test error message",
                        "事件中的错误消息应该正确"
                    );
                } else {
                    prop_assert!(false, "应该是 FlowFailed 事件");
                }

                Ok(())
            })?;
        }

        /// **Feature: llm-flow-monitor, Property 10: 标注 Round-Trip**
        /// **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
        ///
        /// *对于任意* Flow 和标注操作（收藏、评论、标签、标记），
        /// 更新后再读取，标注信息应该与设置的值一致。
        #[test]
        fn prop_annotation_roundtrip(
            request in arb_llm_request(),
            metadata in arb_flow_metadata(),
            starred in any::<bool>(),
            comment in prop::option::of("[a-zA-Z0-9 ]{1,50}"),
            marker in prop::option::of(prop_oneof![
                Just("⭐".to_string()),
                Just("🔴".to_string()),
                Just("🟢".to_string()),
            ]),
            tags in prop::collection::vec("[a-z]{3,10}", 0..3),
        ) {
            let rt = Runtime::new().unwrap();
            rt.block_on(async {
                let config = FlowMonitorConfig::default();
                let monitor = FlowMonitor::new(config, None);

                // 创建并完成 Flow
                let flow_id = monitor.start_flow(request, metadata).await.unwrap();
                monitor.complete_flow(&flow_id, None).await;

                // 设置标注
                let annotations = FlowAnnotations {
                    starred,
                    comment: comment.clone(),
                    marker: marker.clone(),
                    tags: tags.clone(),
                };

                let updated = monitor.update_annotations(&flow_id, annotations.clone()).await;
                prop_assert!(updated, "标注更新应该成功");

                // 读取并验证
                let store = monitor.memory_store.read().await;
                let flow_lock = store.get(&flow_id);
                prop_assert!(flow_lock.is_some(), "Flow 应该存在");

                let binding = flow_lock.unwrap();
                let flow = binding.read().unwrap();
                prop_assert_eq!(flow.annotations.starred, starred, "收藏状态应该一致");
                prop_assert_eq!(flow.annotations.comment.clone(), comment, "评论应该一致");
                prop_assert_eq!(flow.annotations.marker.clone(), marker, "标记应该一致");
                prop_assert_eq!(flow.annotations.tags.clone(), tags, "标签应该一致");

                Ok(())
            })?;
        }

        /// **Feature: llm-flow-monitor, Property 12: 配置生效属性**
        /// **Validates: Requirements 11.1, 11.2, 11.7, 11.8**
        ///
        /// *对于任意* 监控配置（启用/禁用、缓存大小、采样率、排除规则），
        /// Flow_Monitor 的行为应该符合配置。
        #[test]
        fn prop_config_effectiveness(
            enabled in any::<bool>(),
            max_memory_flows in 10usize..100usize,
            excluded_model in prop::option::of("[a-z]{3,10}"),
        ) {
            let rt = Runtime::new().unwrap();
            rt.block_on(async {
                // 构建配置
                let excluded_models = excluded_model
                    .clone()
                    .map(|m| vec![format!("{}*", m)])
                    .unwrap_or_default();

                let config = FlowMonitorConfig {
                    enabled,
                    max_memory_flows,
                    sampling_rate: 1.0, // 确保采样率为 100%
                    excluded_models: excluded_models.clone(),
                    ..Default::default()
                };

                let monitor = FlowMonitor::new(config, None);

                // 验证启用/禁用配置
                prop_assert_eq!(
                    monitor.is_enabled().await,
                    enabled,
                    "监控启用状态应该与配置一致"
                );

                // 测试排除模型配置
                if let Some(ref excluded) = excluded_model {
                    let excluded_model_name = format!("{}-test", excluded);
                    let request = LLMRequest {
                        method: "POST".to_string(),
                        path: "/v1/chat/completions".to_string(),
                        model: excluded_model_name,
                        ..Default::default()
                    };
                    let metadata = FlowMetadata::default();

                    let flow_id = monitor.start_flow(request, metadata).await;

                    if enabled {
                        // 启用时，排除的模型不应该被监控
                        prop_assert!(
                            flow_id.is_none(),
                            "排除的模型不应该被监控"
                        );
                    } else {
                        // 禁用时，任何模型都不应该被监控
                        prop_assert!(
                            flow_id.is_none(),
                            "禁用时不应该监控任何模型"
                        );
                    }
                }

                // 测试非排除模型
                if enabled {
                    let request = LLMRequest {
                        method: "POST".to_string(),
                        path: "/v1/chat/completions".to_string(),
                        model: "gpt-4".to_string(),
                        ..Default::default()
                    };
                    let metadata = FlowMetadata::default();

                    let flow_id = monitor.start_flow(request, metadata).await;
                    prop_assert!(
                        flow_id.is_some(),
                        "启用时，非排除的模型应该被监控"
                    );
                }

                Ok(())
            })?;
        }

        /// **Feature: llm-flow-monitor, Property 12b: 缓存大小配置生效**
        /// **Validates: Requirements 11.2**
        ///
        /// *对于任意* 缓存大小配置，内存存储的最大大小应该与配置一致。
        #[test]
        fn prop_cache_size_config(
            max_memory_flows in 10usize..100usize,
        ) {
            let rt = Runtime::new().unwrap();
            rt.block_on(async {
                let config = FlowMonitorConfig {
                    enabled: true,
                    max_memory_flows,
                    sampling_rate: 1.0,
                    ..Default::default()
                };

                let monitor = FlowMonitor::new(config, None);

                // 验证内存存储的最大大小
                let store = monitor.memory_store.read().await;
                prop_assert_eq!(
                    store.max_size(),
                    max_memory_flows,
                    "内存存储的最大大小应该与配置一致"
                );

                Ok(())
            })?;
        }
    }
}
