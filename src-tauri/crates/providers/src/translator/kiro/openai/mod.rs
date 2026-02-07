//! OpenAI 协议 → Kiro 后端转换
//!
//! 处理 OpenAI ChatCompletion API 格式与 CodeWhisperer 格式之间的转换。

pub mod request;
pub mod response;

pub use request::OpenAiRequestTranslator;
pub use response::OpenAiResponseTranslator;
