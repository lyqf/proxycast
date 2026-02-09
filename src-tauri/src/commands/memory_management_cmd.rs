//! 记忆管理命令
//!
//! 提供对话记忆的统计和管理功能

use crate::commands::context_memory::ContextMemoryServiceState;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::State;
use tracing::info;

/// 记忆统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryStatsResponse {
    /// 总记忆条数
    pub total_entries: u32,
    /// 已使用的存储空间（字节）
    pub storage_used: u64,
    /// 记忆库数量
    pub memory_count: u32,
}

/// 清理记忆结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanupMemoryResult {
    /// 清理的条目数
    pub cleaned_entries: u32,
    /// 释放的存储空间（字节）
    pub freed_space: u64,
}

/// 获取对话记忆统计信息
#[tauri::command]
pub async fn get_conversation_memory_stats(
    _memory_service: State<'_, ContextMemoryServiceState>,
) -> Result<MemoryStatsResponse, String> {
    info!("[记忆管理] 获取记忆统计信息");

    // 获取记忆目录
    let memory_dir = dirs::home_dir()
        .map(|p| p.join(".proxycast").join("memory"))
        .unwrap_or_else(|| PathBuf::from(".proxycast/memory"));

    // 统计所有会话的记忆
    let mut total_entries = 0u32;
    let mut storage_used = 0u64;
    let mut memory_count = 0u32;

    // 遍历记忆目录中的所有会话
    if let Ok(entries) = fs::read_dir(&memory_dir) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                memory_count += 1;
                // 统计该会话的记忆文件
                if let Ok(session_entries) = get_session_memory_stats(&entry.path()) {
                    total_entries += session_entries.0;
                    storage_used += session_entries.1;
                }
            }
        }
    }

    Ok(MemoryStatsResponse {
        total_entries,
        storage_used,
        memory_count,
    })
}

/// 获取单个会话的记忆统计
fn get_session_memory_stats(session_dir: &PathBuf) -> Result<(u32, u64), std::io::Error> {
    let mut entries = 0u32;
    let mut size = 0u64;

    if let Ok(dir_entries) = fs::read_dir(session_dir) {
        for entry in dir_entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                entries += 1;
                size += fs::metadata(&path)?.len();
            }
        }
    }

    Ok((entries, size))
}

/// 清理过期对话记忆
///
/// 清理超过保留天数的记忆条目
#[tauri::command]
pub async fn cleanup_conversation_memory(
    memory_service: State<'_, ContextMemoryServiceState>,
) -> Result<CleanupMemoryResult, String> {
    info!("[记忆管理] 开始清理过期记忆");

    // 使用 ContextMemoryService 的清理功能
    memory_service.0.cleanup_expired_memories()?;

    // 重新获取统计信息以计算清理结果
    // 注意：这里简化处理，实际应该记录清理前后的差异
    Ok(CleanupMemoryResult {
        cleaned_entries: 0, // ContextMemoryService 没有返回清理数量
        freed_space: 0,
    })
}
