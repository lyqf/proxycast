//! 插件系统模块
//!
//! 核心逻辑从 proxycast-core 重新导出，
//! ui_events 依赖 Tauri 保留在主 crate

// 从 core 重新导出所有插件类型和模块
pub use proxycast_core::plugin::binary_downloader;
pub use proxycast_core::plugin::examples;
pub use proxycast_core::plugin::installer;
pub use proxycast_core::plugin::ui_builder;
pub use proxycast_core::plugin::ui_trait;
pub use proxycast_core::plugin::ui_types;

pub use proxycast_core::plugin::{
    Action, BoundValue, ChildrenDef, ComponentDef, ComponentType, DataEntry, DataModelUpdate,
    SurfaceDefinition, SurfaceUpdate, UIMessage, UserAction,
};
pub use proxycast_core::plugin::{
    BinaryComponentStatus, BinaryDownloader, BinaryManifest, HookResult, NoUI, PlatformBinaries,
    Plugin, PluginConfig, PluginContext, PluginError, PluginInfo, PluginLoader, PluginManager,
    PluginManifest, PluginState, PluginStatus, PluginType, PluginUI,
};

// Tauri 依赖的 UI 事件模块保留在主 crate
pub mod ui_events;
pub use ui_events::{PluginUIEmitter, PluginUIEmitterState, PluginUIEventPayload};
