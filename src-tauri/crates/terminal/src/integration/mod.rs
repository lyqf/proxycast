//! 集成模块
//!
//! 提供 Shell 集成、OSC 序列解析、状态重同步等功能。
//!
//! ## 模块结构
//! - `osc_parser` - OSC 序列解析器
//! - `shell_integration` - Shell 集成处理器
//! - `shell_scripts` - Shell 集成脚本管理
//! - `resync` - 状态重同步控制器
//!
//! ## 功能
//! - OSC 序列解析（OSC 7/52/133/16162）
//! - Shell 集成状态管理
//! - Shell 集成脚本安装和管理
//! - 终端状态重同步

pub mod osc_parser;
pub mod resync;
pub mod shell_integration;
pub mod shell_scripts;

// 重新导出常用类型
pub use osc_parser::{strip_osc_sequences, OSCParser, OSCSequence, ParsedOSC, PromptMarkType};
pub use resync::{
    resync_controller, ResyncController, ResyncOptions, ResyncResult, TERMINAL_RESET_SEQUENCE,
    TERMINAL_SOFT_RESET_SEQUENCE,
};
pub use shell_integration::{
    CommandInfo, ShellIntegration, ShellIntegrationEvent, ShellIntegrationStatus, ShellType,
};
pub use shell_scripts::{ShellLaunchBuilder, ShellLaunchConfig, ShellScripts, TerminalEnvConfig};
