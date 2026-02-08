//! 事件发射辅助函数
//!
//! 提供类型安全的事件发射便捷方法，封装序列化逻辑。

use serde::Serialize;

use crate::emitter::TerminalEventEmit;

/// 发射序列化事件
///
/// 将 payload 序列化为 JSON 后通过 emitter 发射。
pub fn emit<E: TerminalEventEmit + ?Sized, T: Serialize>(
    emitter: &E,
    event: &str,
    payload: &T,
) -> Result<(), String> {
    let value = serde_json::to_value(payload).map_err(|e| format!("序列化事件数据失败: {e}"))?;
    emitter.emit_event(event, &value)
}
