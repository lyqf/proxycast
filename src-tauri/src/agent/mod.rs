//! AI Agent 集成模块
//!
//! 负责管理 aster AI Agent 子进程，提供 Agent 功能的 Rust 接口。
//!
//! # 模块结构
//!
//! - `aster_process`: aster 子进程生命周期管理
//! - `aster_client`: HTTP 客户端，调用 aster API
//! - `credential_sync`: 凭证同步服务（后续实现）

pub mod aster_client;
pub mod aster_process;

pub use aster_client::{
    AsterClient, ChatRequest, ChatResponse, CreateAgentData, CreateAgentRequest,
    CreateAgentResponse, ImageInput, ModelConfig, SendToAgentRequest, SendToAgentResponse,
};
pub use aster_process::{AsterProcess, AsterProcessState};
