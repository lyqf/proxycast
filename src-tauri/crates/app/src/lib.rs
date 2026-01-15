//! Tauri 应用入口模块
//!
//! 包含 app, commands, tray, services 等功能

pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}
