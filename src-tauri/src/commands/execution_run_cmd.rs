//! 统一执行轨迹查询命令
//!
//! 提供对 `agent_runs` 的只读查询能力，供前端查看 chat / skill / heartbeat 执行摘要。

use crate::database::dao::agent_run::AgentRun;
use crate::database::DbConnection;
use crate::services::execution_tracker_service::ExecutionTracker;
use tauri::State;

#[tauri::command]
pub async fn execution_run_list(
    db: State<'_, DbConnection>,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<Vec<AgentRun>, String> {
    let safe_limit = limit.unwrap_or(50).clamp(1, 200);
    let safe_offset = offset.unwrap_or(0);
    let tracker = ExecutionTracker::new(db.inner().clone());
    tracker.list_runs(safe_limit, safe_offset)
}

#[tauri::command]
pub async fn execution_run_get(
    db: State<'_, DbConnection>,
    run_id: String,
) -> Result<Option<AgentRun>, String> {
    let id = run_id.trim();
    if id.is_empty() {
        return Err("run_id 不能为空".to_string());
    }
    let tracker = ExecutionTracker::new(db.inner().clone());
    tracker.get_run(id)
}
