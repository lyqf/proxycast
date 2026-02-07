//! 会话管理模块
//!
//! 提供以下功能：
//! - 稳定的 SessionId 生成（基于请求内容哈希）
//! - thoughtSignature 全局缓存
//! - 会话粘性管理（会话与账号映射）
//! - 调度模式配置
//! - 增强的限流处理（Duration 解析、指数退避）

// 从 providers crate 重新导出 session_manager 和 signature_store
pub use proxycast_providers::session::SessionManager;
pub use proxycast_providers::session::{
    clear_thought_signature, get_thought_signature, has_valid_signature, store_thought_signature,
    take_thought_signature,
};

// 从 core crate 重新导出 rate_limit、sticky_config、sticky_manager
pub use proxycast_core::session::{
    extract_retry_delay, parse_duration_string, AccountInfo, RateLimitReason, RateLimitRecord,
    RateLimitTracker, SchedulingMode, StickySessionConfig, StickySessionManager,
};
