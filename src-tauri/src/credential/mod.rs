//! 凭证池管理模块
//!
//! 提供多凭证管理、负载均衡和健康检查功能
//!
//! ## 模块结构
//!
//! - `types` - 凭证相关类型定义
//! - `pool` - 凭证池管理
//! - `balancer` - 负载均衡策略
//! - `health` - 健康检查
//! - `quota` - 配额管理
//! - `sync` - 数据库同步
//! - `risk` - 风控模块（限流检测、冷却期管理）

mod balancer;
mod health;
mod pool;
mod quota;
pub mod risk;
mod sync;
mod types;

pub use balancer::{BalanceStrategy, CooldownInfo, CredentialSelection, LoadBalancer};
pub use health::{HealthCheckConfig, HealthCheckResult, HealthChecker, HealthStatus};
pub use pool::{CredentialPool, PoolError, PoolStatus};
pub use quota::{
    create_shared_quota_manager, start_quota_cleanup_task, AllCredentialsExhaustedError,
    QuotaAutoSwitchResult, QuotaExceededRecord, QuotaManager,
};
pub use risk::{CooldownConfig, RateLimitEvent, RateLimitStats, RiskController, RiskLevel};
pub use sync::{CredentialSyncService, SyncError};
pub use types::{Credential, CredentialData, CredentialStats, CredentialStatus};

#[cfg(test)]
mod tests;
