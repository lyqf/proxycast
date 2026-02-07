//! Kiro/CodeWhisperer 后端协议转换
//!
//! 处理与 AWS CodeWhisperer (Kiro) 后端的协议转换。
//!
//! # 子模块
//!
//! - `openai`: OpenAI 前端协议支持
//! - `anthropic`: Anthropic 前端协议支持
//!
//! # 调用链
//!
//! ## OpenAI 协议
//! ```text
//! OpenAI ChatCompletionRequest
//!   → [openai/request.rs] translate_request
//!   → CodeWhispererRequest
//!   → [backends/kiro.rs] call_stream
//!   → AWS Event Stream bytes
//!   → [stream/parsers/aws_event_stream.rs] parse
//!   → StreamEvent
//!   → [openai/response.rs] translate_event
//!   → OpenAI SSE
//! ```
//!
//! ## Anthropic 协议
//! ```text
//! Anthropic MessagesRequest
//!   → [anthropic/request.rs] translate_request
//!   → CodeWhispererRequest
//!   → [backends/kiro.rs] call_stream
//!   → AWS Event Stream bytes
//!   → [stream/parsers/aws_event_stream.rs] parse
//!   → StreamEvent
//!   → [anthropic/response.rs] translate_event
//!   → Anthropic SSE
//! ```

pub mod anthropic;
pub mod openai;

// 重新导出常用类型
pub use anthropic::{AnthropicRequestTranslator, AnthropicResponseTranslator};
pub use openai::{OpenAiRequestTranslator, OpenAiResponseTranslator};
