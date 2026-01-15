//! 核心类型和工具模块
//!
//! 包含 models, config, database, logger 等基础功能

pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}
