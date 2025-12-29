//! 凭证 API 端点（用于 aster Agent 集成）
//!
//! 为 aster 子进程提供凭证查询接口，支持所有 11 种 Provider 类型。
//! 此 API 仅供内部使用，返回完整的凭证信息（包括未脱敏的 access_token）。

use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::database::dao::provider_pool::ProviderPoolDao;
use crate::models::provider_pool_model::PoolProviderType;
use crate::server::AppState;

/// 选择凭证请求参数
#[derive(Debug, Deserialize)]
pub struct SelectCredentialRequest {
    /// Provider 类型（kiro, gemini, qwen, openai, claude, etc.）
    pub provider_type: String,
    /// 指定模型（可选）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}

/// 凭证信息响应
#[derive(Debug, Serialize)]
pub struct CredentialResponse {
    /// 凭证 UUID
    pub uuid: String,
    /// Provider 类型
    pub provider_type: String,
    /// Access Token（完整，未脱敏）
    pub access_token: String,
    /// Base URL
    pub base_url: String,
    /// Token 过期时间
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<DateTime<Utc>>,
    /// 凭证名称
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

/// API 错误响应
#[derive(Debug, Serialize)]
pub struct CredentialApiError {
    pub error: String,
    pub message: String,
    pub status_code: u16,
}

impl IntoResponse for CredentialApiError {
    fn into_response(self) -> Response {
        let status =
            StatusCode::from_u16(self.status_code).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
        (status, Json(self)).into_response()
    }
}

/// POST /v1/credentials/select - 选择可用凭证
pub async fn credentials_select(
    State(state): State<AppState>,
    _headers: HeaderMap,
    Json(request): Json<SelectCredentialRequest>,
) -> Result<Json<CredentialResponse>, CredentialApiError> {
    tracing::info!(
        "[CREDENTIALS_API] 选择凭证请求: provider_type={}, model={:?}",
        request.provider_type,
        request.model
    );

    let db = state.db.as_ref().ok_or_else(|| CredentialApiError {
        error: "database_unavailable".to_string(),
        message: "数据库连接不可用".to_string(),
        status_code: 503,
    })?;

    // 使用 ProviderPoolService 智能选择凭证
    let credential = state
        .pool_service
        .select_credential(db, &request.provider_type, request.model.as_deref())
        .map_err(|e| CredentialApiError {
            error: "selection_error".to_string(),
            message: format!("凭证选择失败: {}", e),
            status_code: 500,
        })?
        .ok_or_else(|| CredentialApiError {
            error: "no_available_credentials".to_string(),
            message: format!("没有可用的 {} 凭证", request.provider_type),
            status_code: 503,
        })?;

    // 获取 access_token
    let access_token = credential
        .cached_token
        .as_ref()
        .and_then(|cache| cache.access_token.clone())
        .ok_or_else(|| CredentialApiError {
            error: "no_cached_token".to_string(),
            message: "凭证没有缓存的 Token".to_string(),
            status_code: 503,
        })?;

    // 根据 Provider 类型确定 base_url
    let base_url = match credential.provider_type {
        PoolProviderType::Kiro => "https://api.anthropic.com".to_string(),
        PoolProviderType::Gemini => "https://generativelanguage.googleapis.com".to_string(),
        PoolProviderType::Qwen => "https://dashscope.aliyuncs.com/compatible-mode/v1".to_string(),
        PoolProviderType::Antigravity => "https://api.anthropic.com".to_string(),
        PoolProviderType::Vertex => "https://vertex-ai.googleapis.com".to_string(),
        PoolProviderType::GeminiApiKey => "https://generativelanguage.googleapis.com".to_string(),
        PoolProviderType::Codex => "https://api.openai.com/v1".to_string(),
        PoolProviderType::ClaudeOAuth => "https://api.anthropic.com".to_string(),
        PoolProviderType::IFlow => "https://chat.iflyrec.com".to_string(),
        _ => {
            return Err(CredentialApiError {
                error: "unsupported_provider".to_string(),
                message: format!("不支持的 Provider 类型: {:?}", credential.provider_type),
                status_code: 400,
            })
        }
    };

    let response = CredentialResponse {
        uuid: credential.uuid.clone(),
        provider_type: credential.provider_type.to_string(),
        access_token,
        base_url,
        expires_at: credential
            .cached_token
            .as_ref()
            .and_then(|cache| cache.expiry_time),
        name: credential.name.clone(),
    };

    tracing::info!(
        "[CREDENTIALS_API] 凭证选择成功: {} ({})",
        response.name.as_deref().unwrap_or("未命名"),
        response.uuid
    );

    Ok(Json(response))
}

/// GET /v1/credentials/{uuid}/token - 获取指定凭证的 Token
pub async fn credentials_get_token(
    State(state): State<AppState>,
    Path(uuid): Path<String>,
    _headers: HeaderMap,
) -> Result<Json<CredentialResponse>, CredentialApiError> {
    tracing::info!("[CREDENTIALS_API] 获取凭证 Token: {}", uuid);

    let db = state.db.as_ref().ok_or_else(|| CredentialApiError {
        error: "database_unavailable".to_string(),
        message: "数据库连接不可用".to_string(),
        status_code: 503,
    })?;

    // 查询凭证
    let credential = {
        let conn = db.lock().map_err(|e| CredentialApiError {
            error: "database_lock_error".to_string(),
            message: format!("数据库锁定失败: {}", e),
            status_code: 500,
        })?;

        ProviderPoolDao::get_by_uuid(&conn, &uuid)
            .map_err(|e| CredentialApiError {
                error: "database_query_error".to_string(),
                message: format!("查询凭证失败: {}", e),
                status_code: 500,
            })?
            .ok_or_else(|| CredentialApiError {
                error: "credential_not_found".to_string(),
                message: format!("未找到 UUID 为 {} 的凭证", uuid),
                status_code: 404,
            })?
    };

    // 如果 Token 即将过期，尝试刷新
    let cached_token = if let Some(cache) = &credential.cached_token {
        if let Some(expiry_time) = cache.expiry_time {
            let now = chrono::Utc::now();
            let time_until_expiry = expiry_time - now;

            // 如果距离过期不到 30 分钟，尝试刷新
            if time_until_expiry < chrono::Duration::minutes(30) {
                tracing::info!("[CREDENTIALS_API] Token 即将过期，尝试刷新: {}", uuid);
                match state
                    .token_cache
                    .refresh_and_cache_with_events(
                        db,
                        &uuid,
                        false,
                        Some(state.kiro_event_service.clone()),
                    )
                    .await
                {
                    Ok(new_token) => {
                        tracing::info!("[CREDENTIALS_API] Token 刷新成功: {}", uuid);
                        Some(new_token)
                    }
                    Err(e) => {
                        tracing::warn!("[CREDENTIALS_API] Token 刷新失败，使用现有 Token: {}", e);
                        cache.access_token.clone()
                    }
                }
            } else {
                cache.access_token.clone()
            }
        } else {
            cache.access_token.clone()
        }
    } else {
        None
    };

    let access_token = cached_token.ok_or_else(|| CredentialApiError {
        error: "no_cached_token".to_string(),
        message: "凭证没有缓存的 Token".to_string(),
        status_code: 503,
    })?;

    // 根据 Provider 类型确定 base_url
    let base_url = match credential.provider_type {
        PoolProviderType::Kiro => "https://api.anthropic.com".to_string(),
        PoolProviderType::Gemini => "https://generativelanguage.googleapis.com".to_string(),
        PoolProviderType::Qwen => "https://dashscope.aliyuncs.com/compatible-mode/v1".to_string(),
        PoolProviderType::Antigravity => "https://api.anthropic.com".to_string(),
        PoolProviderType::Vertex => "https://vertex-ai.googleapis.com".to_string(),
        PoolProviderType::GeminiApiKey => "https://generativelanguage.googleapis.com".to_string(),
        PoolProviderType::Codex => "https://api.openai.com/v1".to_string(),
        PoolProviderType::ClaudeOAuth => "https://api.anthropic.com".to_string(),
        PoolProviderType::IFlow => "https://chat.iflyrec.com".to_string(),
        _ => {
            return Err(CredentialApiError {
                error: "unsupported_provider".to_string(),
                message: format!("不支持的 Provider 类型: {:?}", credential.provider_type),
                status_code: 400,
            })
        }
    };

    // 重新查询凭证以获取更新后的 expires_at
    let updated_credential = {
        let conn = db.lock().map_err(|e| CredentialApiError {
            error: "database_lock_error".to_string(),
            message: format!("数据库锁定失败: {}", e),
            status_code: 500,
        })?;

        ProviderPoolDao::get_by_uuid(&conn, &uuid)
            .map_err(|e| CredentialApiError {
                error: "database_query_error".to_string(),
                message: format!("查询凭证失败: {}", e),
                status_code: 500,
            })?
            .ok_or_else(|| CredentialApiError {
                error: "credential_not_found".to_string(),
                message: format!("未找到 UUID 为 {} 的凭证", uuid),
                status_code: 404,
            })?
    };

    let response = CredentialResponse {
        uuid: updated_credential.uuid.clone(),
        provider_type: updated_credential.provider_type.to_string(),
        access_token,
        base_url,
        expires_at: updated_credential
            .cached_token
            .as_ref()
            .and_then(|cache| cache.expiry_time),
        name: updated_credential.name.clone(),
    };

    tracing::info!(
        "[CREDENTIALS_API] 返回凭证 Token: {} ({})",
        response.name.as_deref().unwrap_or("未命名"),
        response.uuid
    );

    Ok(Json(response))
}
