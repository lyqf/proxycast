//! Aster Agent 集成模块
//!
//! 包含 agent 相关功能，依赖 aster 框架

pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}
