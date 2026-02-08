//! 业务服务模块
//!
//! 核心业务逻辑已迁移到 proxycast-services crate。
//! 本模块保留 Tauri 相关服务和重新导出。

// 从 proxycast-services crate 重新导出
pub use proxycast_services::api_key_provider_service;
pub use proxycast_services::aster_session_store;
pub use proxycast_services::backup_service;
pub use proxycast_services::content_creator;
pub use proxycast_services::context_memory_service;
pub use proxycast_services::general_chat;
pub use proxycast_services::kiro_event_service;
pub use proxycast_services::live_sync;
pub use proxycast_services::machine_id_service;
pub use proxycast_services::material_service;
pub use proxycast_services::mcp_service;
pub use proxycast_services::mcp_sync;
pub use proxycast_services::model_registry_service;
pub use proxycast_services::model_service;
pub use proxycast_services::persona_service;
pub use proxycast_services::project_context_builder;
pub use proxycast_services::prompt_service;
pub use proxycast_services::prompt_sync;
pub use proxycast_services::provider_pool_service;
pub use proxycast_services::session_context_service;
pub use proxycast_services::skill_service;
pub use proxycast_services::switch;
pub use proxycast_services::template_service;
pub use proxycast_services::token_cache_service;
pub use proxycast_services::tool_hooks_service;
pub use proxycast_services::update_check_service;
pub use proxycast_services::usage_service;

// 保留在主 crate 的 Tauri 相关服务
pub mod file_browser_service;
pub mod sysinfo_service;
pub mod update_window;
