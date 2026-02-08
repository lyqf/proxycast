//! 数据模型模块
//!
//! 从 proxycast-core crate 重新导出所有模型类型。
//! 仅保留依赖主 crate 业务模块的类型在本地定义。

// 从 core crate 重新导出所有模型
pub use proxycast_core::models::anthropic;
#[allow(unused_imports)]
pub use proxycast_core::models::app_type;
#[allow(unused_imports)]
pub use proxycast_core::models::codewhisperer;
pub use proxycast_core::models::kiro_fingerprint;
pub use proxycast_core::models::machine_id;
pub use proxycast_core::models::mcp_model;
pub use proxycast_core::models::model_registry;
pub use proxycast_core::models::openai;
#[allow(unused_imports)]
pub use proxycast_core::models::prompt_model;
#[allow(unused_imports)]
pub use proxycast_core::models::provider_model;
pub use proxycast_core::models::provider_pool_model;
pub use proxycast_core::models::route_model;
pub use proxycast_core::models::skill_model;

// project_model 已迁移到 core
pub use proxycast_core::models::project_model;

// 重新导出常用类型（保持向后兼容）
#[allow(unused_imports)]
pub use proxycast_core::models::anthropic::*;
pub use proxycast_core::models::app_type::AppType;
#[allow(unused_imports)]
pub use proxycast_core::models::codewhisperer::*;
pub use proxycast_core::models::mcp_model::McpServer;
#[allow(unused_imports)]
pub use proxycast_core::models::openai::*;
pub use proxycast_core::models::prompt_model::Prompt;
pub use proxycast_core::models::provider_model::Provider;
#[allow(unused_imports)]
pub use proxycast_core::models::provider_pool_model::*;
pub use proxycast_core::models::skill_model::{
    Skill, SkillMetadata, SkillRepo, SkillState, SkillStates,
};
