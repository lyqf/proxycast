//! 心跳任务执行记录数据访问对象

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

/// 心跳任务执行记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeartbeatExecution {
    pub id: i64,
    pub task_description: String,
    pub priority: Option<u8>,
    pub execution_mode: String,
    pub status: String,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub duration_ms: Option<i64>,
    pub output: Option<String>,
    pub retry_count: u32,
    pub metadata: Option<String>,
}

pub struct HeartbeatDao;

impl HeartbeatDao {
    /// 创建执行记录，返回新记录 ID
    pub fn create_execution(
        conn: &Connection,
        exec: &HeartbeatExecution,
    ) -> Result<i64, rusqlite::Error> {
        conn.execute(
            "INSERT INTO heartbeat_executions (task_description, priority, execution_mode, status, started_at, completed_at, duration_ms, output, retry_count, metadata)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                exec.task_description,
                exec.priority,
                exec.execution_mode,
                exec.status,
                exec.started_at,
                exec.completed_at,
                exec.duration_ms,
                exec.output,
                exec.retry_count,
                exec.metadata,
            ],
        )?;
        Ok(conn.last_insert_rowid())
    }

    /// 更新执行记录状态和结果
    pub fn update_execution(
        conn: &Connection,
        id: i64,
        status: &str,
        output: Option<&str>,
        completed_at: &str,
        duration_ms: i64,
    ) -> Result<(), rusqlite::Error> {
        conn.execute(
            "UPDATE heartbeat_executions SET status = ?1, output = ?2, completed_at = ?3, duration_ms = ?4 WHERE id = ?5",
            params![status, output, completed_at, duration_ms, id],
        )?;
        Ok(())
    }

    /// 获取最近的执行记录
    pub fn get_recent_executions(
        conn: &Connection,
        limit: usize,
    ) -> Result<Vec<HeartbeatExecution>, rusqlite::Error> {
        let mut stmt = conn.prepare(
            "SELECT id, task_description, priority, execution_mode, status, started_at, completed_at, duration_ms, output, retry_count, metadata
             FROM heartbeat_executions ORDER BY id DESC LIMIT ?1",
        )?;

        let rows = stmt.query_map(params![limit as i64], |row| {
            Ok(HeartbeatExecution {
                id: row.get(0)?,
                task_description: row.get(1)?,
                priority: row.get::<_, Option<u8>>(2)?,
                execution_mode: row.get(3)?,
                status: row.get(4)?,
                started_at: row.get(5)?,
                completed_at: row.get(6)?,
                duration_ms: row.get(7)?,
                output: row.get(8)?,
                retry_count: row.get::<_, u32>(9)?,
                metadata: row.get(10)?,
            })
        })?;

        rows.collect()
    }

    /// 根据 ID 获取执行记录
    pub fn get_execution_by_id(
        conn: &Connection,
        id: i64,
    ) -> Result<Option<HeartbeatExecution>, rusqlite::Error> {
        let mut stmt = conn.prepare(
            "SELECT id, task_description, priority, execution_mode, status, started_at, completed_at, duration_ms, output, retry_count, metadata
             FROM heartbeat_executions WHERE id = ?1",
        )?;

        let mut rows = stmt.query_map(params![id], |row| {
            Ok(HeartbeatExecution {
                id: row.get(0)?,
                task_description: row.get(1)?,
                priority: row.get::<_, Option<u8>>(2)?,
                execution_mode: row.get(3)?,
                status: row.get(4)?,
                started_at: row.get(5)?,
                completed_at: row.get(6)?,
                duration_ms: row.get(7)?,
                output: row.get(8)?,
                retry_count: row.get::<_, u32>(9)?,
                metadata: row.get(10)?,
            })
        })?;

        match rows.next() {
            Some(Ok(exec)) => Ok(Some(exec)),
            Some(Err(e)) => Err(e),
            None => Ok(None),
        }
    }

    /// 删除指定日期之前的旧记录
    pub fn delete_old_executions(
        conn: &Connection,
        before: &str,
    ) -> Result<usize, rusqlite::Error> {
        conn.execute(
            "DELETE FROM heartbeat_executions WHERE started_at < ?1",
            params![before],
        )
    }
}
