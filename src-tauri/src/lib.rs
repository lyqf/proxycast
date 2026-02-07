//! ProxyCast - AI API 代理服务
//!
//! 这是一个 Tauri 应用，提供 AI API 的代理和管理功能。
//!
//! ## Workspace 结构（渐进式拆分）
//!
//! - ✅ proxycast-core crate（models, data, logger, errors, backends, config, connect,
//!   middleware, orchestrator, plugin, session 部分, session_files）
//! - ✅ proxycast-infra crate（proxy, resilience, injection, telemetry）
//! - ✅ proxycast-providers crate（providers, converter, streaming, translator, stream, session 部分）
//! - 主 crate 保留 Tauri 相关业务逻辑

// 抑制 objc crate 宏内部的 unexpected_cfgs 警告
// 该警告来自 cocoa/objc 依赖的 msg_send! 宏，是已知的 issue
#![allow(unexpected_cfgs)]

// 重新导出子 crate 的类型
// 注意：主 crate 保留了自己的 data, logger, models 模块，所以只导出 core 的具体类型
pub use proxycast_core::{LogEntry, LogStore, LogStoreConfig, SharedLogStore};
// infra crate 的类型通过 proxycast_infra 前缀访问，避免与 core 的 InjectionMode/InjectionRule 冲突
pub use proxycast_infra::{
    injection, proxy, resilience, telemetry, Failover, FailoverConfig, InjectionConfig,
    InjectionMode, InjectionResult, InjectionRule, Injector, LogRotationConfig, LoggerError,
    ModelStats, ModelTokenStats, PeriodTokenStats, ProviderStats, ProviderTokenStats,
    ProxyClientFactory, ProxyError, ProxyProtocol, RequestLog, RequestLogger, RequestStatus,
    Retrier, RetryConfig, StatsAggregator, StatsSummary, TimeRange, TimeoutConfig,
    TimeoutController, TokenSource, TokenStatsSummary, TokenTracker, TokenUsageRecord,
};

// 从 providers crate 重新导出（保持 crate::xxx 路径兼容）
pub use proxycast_providers::converter;
pub use proxycast_providers::providers;
pub use proxycast_providers::stream;
pub use proxycast_providers::streaming;
pub use proxycast_providers::translator;

// 从 core crate 重新导出（保持 crate::xxx 路径兼容）
pub use proxycast_core::backends;
pub use proxycast_core::connect;
pub use proxycast_core::orchestrator;
pub use proxycast_core::session_files;

// 核心模块
pub mod agent;
pub mod app;
pub mod content;
pub mod credential;
pub mod database;
pub mod memory;
pub mod plugin;
pub mod screenshot;
pub mod services;
pub mod session;
pub mod terminal;
pub mod tray;
pub mod voice;
pub mod workspace;

// Skills 集成模块
pub mod skills;

// MCP 集成模块
pub mod mcp;

// 内部模块
mod commands;
mod config;
mod data;
#[cfg(debug_assertions)]
mod dev_bridge;
mod logger;
mod models;
mod server_utils;

// 从 core crate 重新导出 errors
pub use proxycast_core::errors;

// 服务器相关模块
mod middleware;
mod processor;
mod router;
mod server;
mod websocket;

// 重新导出核心类型以保持向后兼容
pub use app::{AppState, LogState, ProviderType, TokenCacheServiceState, TrayManagerState};
pub use services::provider_pool_service::ProviderPoolService;

// 重新导出 run 函数
pub use app::run;
