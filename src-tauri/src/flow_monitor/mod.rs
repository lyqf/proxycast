//! LLM Flow Monitor 模块
//!
//! 该模块提供完整的 LLM API 流量监控功能，参考 mitmproxy 的 Flow 模型设计。
//! 用于捕获、存储、分析和回放 AI Agent 与大模型之间的完整交互数据。
//!
//! # 主要组件
//!
//! - `models`: 核心数据模型，包括 LLMFlow、LLMRequest、LLMResponse 等
//! - `stream_rebuilder`: SSE 流式响应重建器
//! - `memory_store`: 内存存储，支持 LRU 驱逐策略
//! - `file_store`: 文件存储，支持 JSONL 格式和 SQLite 索引
//! - `query_service`: 查询服务，支持多维度过滤、排序、分页和全文搜索
//! - `exporter`: 导出服务，支持 HAR、JSON、JSONL、Markdown、CSV 格式
//! - `monitor`: 核心监控服务

pub mod exporter;
pub mod file_store;
pub mod memory_store;
pub mod models;
pub mod monitor;
pub mod query_service;
pub mod stream_rebuilder;

// 重新导出核心类型
pub use models::{
    ClientInfo,
    ContentPart,
    FlowAnnotations,
    // 错误
    FlowError,
    FlowErrorType,
    // 元数据
    FlowMetadata,
    FlowState,
    FlowTimestamps,
    FlowType,
    // 核心 Flow 结构
    LLMFlow,
    // 请求相关
    LLMRequest,
    // 响应相关
    LLMResponse,
    Message,
    MessageContent,
    MessageRole,
    RequestParameters,
    RoutingInfo,
    StopReason,
    StreamChunk,
    StreamInfo,
    ThinkingContent,
    TokenUsage,
    ToolCall,
    ToolCallDelta,
    ToolDefinition,
    ToolResult,
};

// 重新导出流重建器
pub use stream_rebuilder::{StreamFormat, StreamRebuilder, StreamRebuilderError};

// 重新导出内存存储
pub use memory_store::{FlowFilter, FlowMemoryStore, LatencyRange, TimeRange, TokenRange};

// 重新导出文件存储
pub use file_store::{
    CleanupResult, FileStoreError, FlowFileStore, FlowIndexRecord, FtsSearchResult, RotationConfig,
};

// 重新导出查询服务
pub use query_service::{
    FlowQueryResult, FlowQueryService, FlowSearchResult, FlowSortBy, FlowStats, ModelStats,
    ProviderStats, StateStats,
};

// 重新导出导出服务
pub use exporter::{
    default_redaction_rules, ExportFormat, ExportOptions, ExportResult, FlowExporter, HarArchive,
    HarEntry, HarLlmExtension, HarLog, RedactionRule, Redactor,
};

// 重新导出监控服务
pub use monitor::{FlowEvent, FlowMonitor, FlowMonitorConfig, FlowSummary, FlowUpdate};

// 重新导出 ProviderType（从 lib.rs）
pub use crate::ProviderType;
