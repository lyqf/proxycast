//! 配置管理模块
//!
//! 核心配置类型、YAML 支持、热重载和导入导出功能已迁移到 proxycast-core crate。
//! 本模块保留 observer（依赖 Tauri）和集成测试。

#![allow(unused_imports)]

// 从 core crate 重新导出所有配置类型
pub use proxycast_core::config::*;

// observer 模块保留在主 crate（依赖 Tauri）
pub mod observer;

// 重新导出观察者模块的核心类型
pub use observer::{
    ConfigChangeEvent, ConfigChangeSource, ConfigObserver, ConfigSubject, GlobalConfigManager,
    GlobalConfigManagerState,
};

#[cfg(test)]
mod tests;
