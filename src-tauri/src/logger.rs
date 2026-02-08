//! 日志管理模块
//!
//! 核心逻辑已迁移到 proxycast-core crate，本文件保留扩展函数。

pub use proxycast_core::logger::*;

use crate::config::LoggingConfig;

/// 使用 LoggingConfig 创建 LogStore
pub fn create_log_store_from_config(logging: &LoggingConfig) -> LogStore {
    LogStore::with_custom_config(logging.retention_days, logging.enabled)
}
