//! Provider 系统模块
//!
//! 包含 providers, credential, converter 等功能

pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}
