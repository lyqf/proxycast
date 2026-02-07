//! Kiro 响应转换为 Anthropic SSE 格式
//!
//! 将 `StreamEvent` 转换为 Anthropic Messages API 流式响应格式。
//! 这是 Claude Code 使用的协议。

use crate::stream::{AnthropicSseGenerator, StreamEvent};
use crate::translator::traits::{ResponseTranslator, SseResponseTranslator};

/// Anthropic 响应转换器
///
/// 将 `StreamEvent` 转换为 Anthropic SSE 格式
#[derive(Debug)]
pub struct AnthropicResponseTranslator {
    /// SSE 生成器
    generator: AnthropicSseGenerator,
}

impl Default for AnthropicResponseTranslator {
    fn default() -> Self {
        Self::new("unknown".to_string())
    }
}

impl AnthropicResponseTranslator {
    /// 创建新的转换器
    pub fn new(model: String) -> Self {
        Self {
            generator: AnthropicSseGenerator::new(model),
        }
    }

    /// 使用指定的消息 ID 创建转换器
    pub fn with_id(id: String, model: String) -> Self {
        Self {
            generator: AnthropicSseGenerator::with_id(id, model),
        }
    }

    /// 获取消息 ID
    pub fn message_id(&self) -> &str {
        self.generator.message_id()
    }

    /// 获取模型名称
    pub fn model(&self) -> &str {
        self.generator.model()
    }
}

impl ResponseTranslator for AnthropicResponseTranslator {
    type Output = Vec<String>;

    fn translate_event(&mut self, event: &StreamEvent) -> Option<Self::Output> {
        let events = self.generator.generate(event);
        if events.is_empty() {
            None
        } else {
            Some(events)
        }
    }

    fn finalize(&mut self) -> Vec<Self::Output> {
        Vec::new() // Anthropic 生成器在 MessageStop 时已经发送了所有结束事件
    }

    fn reset(&mut self) {
        self.generator = AnthropicSseGenerator::new("unknown".to_string());
    }
}

impl SseResponseTranslator for AnthropicResponseTranslator {
    fn translate_to_sse(&mut self, event: &StreamEvent) -> Vec<String> {
        self.generator.generate(event)
    }

    fn finalize_sse(&mut self) -> Vec<String> {
        Vec::new() // Anthropic 生成器在 MessageStop 时已经发送了所有结束事件
    }

    fn reset(&mut self) {
        self.generator = AnthropicSseGenerator::new("unknown".to_string());
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::stream::{ContentBlockType, StopReason};

    #[test]
    fn test_translate_message_start() {
        let mut translator = AnthropicResponseTranslator::new("claude-3-sonnet".to_string());

        let event = StreamEvent::MessageStart {
            id: "msg_123".to_string(),
            model: "claude-3-sonnet".to_string(),
        };

        let sse = translator.translate_event(&event);
        assert!(sse.is_some());
        let sse = sse.unwrap();
        assert!(!sse.is_empty());
        assert!(sse[0].starts_with("event: message_start\ndata: "));
    }

    #[test]
    fn test_translate_text_content() {
        let mut translator = AnthropicResponseTranslator::new("claude-3-sonnet".to_string());

        // 先发送 message_start
        let _ = translator.translate_event(&StreamEvent::MessageStart {
            id: "msg_123".to_string(),
            model: "claude-3-sonnet".to_string(),
        });

        // 内容块开始
        let sse = translator.translate_event(&StreamEvent::ContentBlockStart {
            index: 0,
            block_type: ContentBlockType::Text,
        });
        assert!(sse.is_some());
        let sse = sse.unwrap();
        assert!(sse[0].contains("content_block_start"));

        // 文本增量
        let sse = translator.translate_event(&StreamEvent::TextDelta {
            text: "Hello".to_string(),
        });
        assert!(sse.is_some());
        let sse = sse.unwrap();
        assert!(sse[0].contains("content_block_delta"));
        assert!(sse[0].contains("Hello"));
    }

    #[test]
    fn test_translate_tool_use() {
        let mut translator = AnthropicResponseTranslator::new("claude-3-sonnet".to_string());

        // 发送 message_start
        let _ = translator.translate_event(&StreamEvent::MessageStart {
            id: "msg_123".to_string(),
            model: "claude-3-sonnet".to_string(),
        });

        // 工具调用内容块开始
        let sse = translator.translate_event(&StreamEvent::ContentBlockStart {
            index: 1,
            block_type: ContentBlockType::ToolUse {
                id: "tool_abc".to_string(),
                name: "read_file".to_string(),
            },
        });
        assert!(sse.is_some());
        let sse = sse.unwrap();
        assert!(sse[0].contains("content_block_start"));
        assert!(sse[0].contains("tool_use"));

        // 工具参数增量
        let sse = translator.translate_event(&StreamEvent::ToolUseInputDelta {
            id: "tool_abc".to_string(),
            partial_json: "{\"path\":".to_string(),
        });
        assert!(sse.is_some());
        let sse = sse.unwrap();
        assert!(sse[0].contains("input_json_delta"));
    }

    #[test]
    fn test_translate_message_stop() {
        let mut translator = AnthropicResponseTranslator::new("claude-3-sonnet".to_string());

        // 发送 message_start
        let _ = translator.translate_event(&StreamEvent::MessageStart {
            id: "msg_123".to_string(),
            model: "claude-3-sonnet".to_string(),
        });

        // 消息结束
        let sse = translator.translate_event(&StreamEvent::MessageStop {
            stop_reason: StopReason::EndTurn,
        });
        assert!(sse.is_some());
        let sse = sse.unwrap();
        assert_eq!(sse.len(), 2);
        assert!(sse[0].contains("message_delta"));
        assert!(sse[0].contains("end_turn"));
        assert!(sse[1].contains("message_stop"));
    }
}
