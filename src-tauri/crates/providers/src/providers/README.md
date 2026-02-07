# providers

<!-- 一旦我所属的文件夹有所变化，请更新我 -->

## 架构说明

各 LLM Provider 的认证和 API 实现。
支持 OAuth 和 API Key 两种认证方式。

## 文件索引

- `mod.rs` - 模块入口和 Provider 枚举
- `traits.rs` - Provider trait 定义
- `error.rs` - 错误类型定义
- `kiro.rs` - Kiro/CodeWhisperer OAuth 认证
- `gemini.rs` - Gemini OAuth 认证
- `qwen.rs` - Qwen OAuth 认证
- `antigravity.rs` - Antigravity OAuth 认证
- `claude_oauth.rs` - Claude OAuth 认证
- `claude_custom.rs` - Claude API Key 认证
- `openai_custom.rs` - OpenAI API Key 认证
- `codex.rs` - Codex Provider
- `iflow.rs` - iFlow Provider
- `vertex.rs` - Vertex AI Provider
- `tests.rs` - 单元测试

## 更新提醒

任何文件变更后，请更新此文档和相关的上级文档。
