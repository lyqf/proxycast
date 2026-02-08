//! 块控制器模块
//!
//! 提供统一的控制器抽象层，支持不同类型的终端连接（本地 Shell、SSH、WSL、命令执行）。
//!
//! ## 模块结构
//! - `traits` - BlockController trait 定义
//! - `registry` - 控制器注册表
//! - `shell_controller` - Shell/Cmd 控制器实现
//!
//! ## 功能
//! - 定义统一的 BlockController trait 接口
//! - 管理控制器生命周期（start、stop、send_input）
//! - 提供控制器注册表，支持按 block_id 查找

mod registry;
mod shell_controller;
mod traits;

pub use registry::ControllerRegistry;
pub use shell_controller::{ControllerStatusEvent, ShellController, CONTROLLER_STATUS_EVENT};
pub use traits::{
    BlockController, BlockControllerRuntimeStatus, BlockInputUnion, BlockMeta, RuntimeOpts,
    TermSize,
};
