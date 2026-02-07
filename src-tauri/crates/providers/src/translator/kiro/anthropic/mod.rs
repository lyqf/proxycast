//! Anthropic 协议 → Kiro 后端转换
//!
//! 处理 Anthropic Messages API 格式与 CodeWhisperer 格式之间的转换。
//!
//! # 重要说明
//!
//! 这是 Claude Code 使用的协议，是最核心的转换路径。

pub mod request;
pub mod response;

pub use request::AnthropicRequestTranslator;
pub use response::AnthropicResponseTranslator;
