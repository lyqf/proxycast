//! 终端核心模块（重导出层）
//!
//! 实际实现位于 `proxycast-terminal` crate。
//! 本模块提供 `TauriEmitter` newtype 桥接 Tauri 与终端 crate。

use std::path::PathBuf;

use tauri::{Emitter, Manager};

use proxycast_terminal::emitter::TerminalEventEmit;

/// Tauri AppHandle 的 newtype 包装
///
/// 实现 `TerminalEventEmit` trait，桥接 Tauri 框架与终端 crate。
#[derive(Clone)]
pub struct TauriEmitter(pub tauri::AppHandle);

impl TerminalEventEmit for TauriEmitter {
    fn emit_event(&self, event: &str, payload: &serde_json::Value) -> Result<(), String> {
        self.0
            .emit(event, payload.clone())
            .map_err(|e| format!("Tauri emit 失败: {e}"))
    }

    fn app_data_dir(&self) -> Result<PathBuf, String> {
        self.0
            .path()
            .app_data_dir()
            .map_err(|e| format!("获取应用数据目录失败: {e}"))
    }
}

// 重新导出 proxycast-terminal 的所有公共类型
pub use proxycast_terminal::block_controller;
pub use proxycast_terminal::connections;
pub use proxycast_terminal::emit_helper;
pub use proxycast_terminal::emitter;
pub use proxycast_terminal::error;
pub use proxycast_terminal::events;
pub use proxycast_terminal::integration;
pub use proxycast_terminal::persistence;
pub use proxycast_terminal::pty_session;
pub use proxycast_terminal::session_manager;

// 重新导出常用类型
pub use proxycast_terminal::{
    resync_controller, BlockController, BlockControllerRuntimeStatus, BlockFile, BlockInputUnion,
    BlockMeta, ControllerRegistry, ControllerStatusEvent, DynEmitter, NoOpEmitter, PtySession,
    ResyncController, ResyncOptions, ResyncResult, RuntimeOpts, SessionMetadata,
    SessionMetadataStore, SessionRecord, SessionStatus, ShellController, ShellProc, TermSize,
    TerminalError, TerminalEventEmitter, TerminalOutputEvent, TerminalSessionManager,
    TerminalStatusEvent, CONTROLLER_STATUS_EVENT, DEFAULT_COLS, DEFAULT_ROWS,
    TERMINAL_RESET_SEQUENCE, TERMINAL_SOFT_RESET_SEQUENCE,
};
