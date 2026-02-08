//! 终端持久化模块
//!
//! 提供终端会话数据的持久化存储能力。
//!
//! ## 模块结构
//! - `block_file` - 块文件循环缓冲存储
//! - `session_store` - 会话元数据 SQLite 存储
//!
//! ## 功能
//! - 终端输出历史的文件存储（循环缓冲）
//! - 会话元数据的数据库存储
//! - 会话恢复支持

pub mod block_file;
pub mod session_store;

pub use block_file::BlockFile;
pub use session_store::{SessionMetadataStore, SessionRecord};
