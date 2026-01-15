//! API 服务器模块
//!
//! 包含 server, streaming, middleware, router 等功能

pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}
