//! Content 相关的 Tauri 命令
//!
//! 提供内容管理的前端 API。

use crate::content::{
    Content, ContentCreateRequest, ContentListQuery, ContentManager, ContentStatus,
    ContentUpdateRequest,
};
use crate::database::DbConnection;
use serde::{Deserialize, Serialize};
use tauri::State;

/// 内容列表项（用于前端展示）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentListItem {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub content_type: String,
    pub status: String,
    pub order: i32,
    pub word_count: i64,
    pub metadata: Option<serde_json::Value>,
    pub created_at: i64,
    pub updated_at: i64,
}

impl From<Content> for ContentListItem {
    fn from(content: Content) -> Self {
        Self {
            id: content.id,
            project_id: content.project_id,
            title: content.title,
            content_type: content.content_type.as_str().to_string(),
            status: content.status.as_str().to_string(),
            order: content.order,
            word_count: content.word_count,
            metadata: content.metadata,
            created_at: content.created_at.timestamp_millis(),
            updated_at: content.updated_at.timestamp_millis(),
        }
    }
}

/// 内容详情（包含正文）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentDetail {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub content_type: String,
    pub status: String,
    pub order: i32,
    pub body: String,
    pub word_count: i64,
    pub metadata: Option<serde_json::Value>,
    pub session_id: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

impl From<Content> for ContentDetail {
    fn from(content: Content) -> Self {
        Self {
            id: content.id,
            project_id: content.project_id,
            title: content.title,
            content_type: content.content_type.as_str().to_string(),
            status: content.status.as_str().to_string(),
            order: content.order,
            body: content.body,
            word_count: content.word_count,
            metadata: content.metadata,
            session_id: content.session_id,
            created_at: content.created_at.timestamp_millis(),
            updated_at: content.updated_at.timestamp_millis(),
        }
    }
}

/// 创建内容请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateContentRequest {
    pub project_id: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub order: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

/// 更新内容请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateContentRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub order: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
}

/// 内容列表查询请求
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ListContentRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub search: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sort_by: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sort_order: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub offset: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<i64>,
}

/// 创建内容
#[tauri::command]
pub async fn content_create(
    db: State<'_, DbConnection>,
    request: CreateContentRequest,
) -> Result<ContentDetail, String> {
    let manager = ContentManager::new(db.inner().clone());

    let create_request = ContentCreateRequest {
        project_id: request.project_id,
        title: request.title,
        content_type: request
            .content_type
            .map(|s| crate::content::ContentType::from_str(&s)),
        order: request.order,
        body: request.body,
        metadata: request.metadata,
    };

    let content = manager.create(create_request)?;
    Ok(content.into())
}

/// 获取内容详情
#[tauri::command]
pub async fn content_get(
    db: State<'_, DbConnection>,
    id: String,
) -> Result<Option<ContentDetail>, String> {
    let manager = ContentManager::new(db.inner().clone());
    let content = manager.get(&id)?;
    Ok(content.map(|c| c.into()))
}

/// 列出项目的所有内容
#[tauri::command]
pub async fn content_list(
    db: State<'_, DbConnection>,
    project_id: String,
    query: Option<ListContentRequest>,
) -> Result<Vec<ContentListItem>, String> {
    let manager = ContentManager::new(db.inner().clone());

    let list_query = query.map(|q| ContentListQuery {
        status: q.status.map(|s| ContentStatus::from_str(&s)),
        content_type: q
            .content_type
            .map(|s| crate::content::ContentType::from_str(&s)),
        search: q.search,
        sort_by: q.sort_by,
        sort_order: q.sort_order,
        offset: q.offset,
        limit: q.limit,
    });

    let contents = manager.list_by_project(&project_id, list_query)?;
    Ok(contents.into_iter().map(|c| c.into()).collect())
}

/// 更新内容
#[tauri::command]
pub async fn content_update(
    db: State<'_, DbConnection>,
    id: String,
    request: UpdateContentRequest,
) -> Result<ContentDetail, String> {
    let manager = ContentManager::new(db.inner().clone());

    let update_request = ContentUpdateRequest {
        title: request.title,
        status: request.status.map(|s| ContentStatus::from_str(&s)),
        order: request.order,
        body: request.body,
        metadata: request.metadata,
        session_id: request.session_id,
    };

    let content = manager.update(&id, update_request)?;
    Ok(content.into())
}

/// 删除内容
#[tauri::command]
pub async fn content_delete(db: State<'_, DbConnection>, id: String) -> Result<bool, String> {
    let manager = ContentManager::new(db.inner().clone());
    manager.delete(&id)
}

/// 重新排序内容
#[tauri::command]
pub async fn content_reorder(
    db: State<'_, DbConnection>,
    project_id: String,
    content_ids: Vec<String>,
) -> Result<(), String> {
    let manager = ContentManager::new(db.inner().clone());
    manager.reorder(&project_id, content_ids)
}

/// 获取项目内容统计
#[tauri::command]
pub async fn content_stats(
    db: State<'_, DbConnection>,
    project_id: String,
) -> Result<(i64, i64, i64), String> {
    let manager = ContentManager::new(db.inner().clone());
    manager.get_project_stats(&project_id)
}
