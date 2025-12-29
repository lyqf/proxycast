//! Agent 命令模块
//!
//! 提供 aster Agent 子进程管理和会话管理的 Tauri 命令

use crate::agent::{AsterClient, AsterProcess, AsterProcessState};
use crate::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;

/// Agent 进程状态响应
#[derive(Debug, Serialize)]
pub struct AgentProcessStatus {
    /// 进程是否正在运行
    pub running: bool,
    /// aster 服务地址
    pub base_url: Option<String>,
    /// aster 服务端口
    pub port: Option<u16>,
}

/// 创建会话响应
#[derive(Debug, Serialize)]
pub struct CreateSessionResponse {
    /// 会话 ID
    pub session_id: String,
    /// 使用的凭证名称
    pub credential_name: String,
    /// 使用的凭证 UUID
    pub credential_uuid: String,
    /// Provider 类型
    pub provider_type: String,
    /// 模型名称
    pub model: Option<String>,
}

/// 启动 Agent 进程
///
/// 优先从 plugin 目录启动，如果未安装则回退到 Tauri Sidecar
///
/// # 参数
///
/// - `port`: aster 服务监听端口（可选，默认 8081）
#[tauri::command]
pub async fn agent_start_process(
    app_handle: tauri::AppHandle,
    aster_state: State<'_, AsterProcessState>,
    port: Option<u16>,
) -> Result<AgentProcessStatus, String> {
    println!("[DEBUG] ========== agent_start_process() 开始 ==========");

    // 检查是否已经启动
    println!("[DEBUG] 检查进程是否已运行...");
    if aster_state.is_running() {
        println!("[DEBUG] 进程已在运行");
        return Err("aster 进程已经在运行".to_string());
    }
    println!("[DEBUG] 进程未运行");

    // 默认参数
    let service_port = port.unwrap_or(8081);

    println!("[DEBUG] 参数: port={}", service_port);

    // 优先从 plugin 目录启动
    let process = if AsterProcess::is_installed() {
        tracing::info!(
            "[AGENT] 从 plugin 目录启动 aster 进程: port={}",
            service_port
        );
        println!("[DEBUG] 调用 AsterProcess::start_from_plugin()...");
        AsterProcess::start_from_plugin(service_port).await?
    } else {
        // 回退到 Tauri Sidecar
        tracing::info!("[AGENT] 从 sidecar 启动 aster 进程: port={}", service_port);
        println!("[DEBUG] 调用 AsterProcess::start_with_sidecar()...");
        AsterProcess::start_with_sidecar(&app_handle, service_port).await?
    };
    println!("[DEBUG] AsterProcess 启动完成");

    let base_url = process.base_url().to_string();
    let port = process.port();

    // 保存进程状态
    aster_state.set(process);

    println!("[DEBUG] ========== agent_start_process() 完成 ==========");
    tracing::info!("[AGENT] aster 进程启动成功: {}", base_url);

    Ok(AgentProcessStatus {
        running: true,
        base_url: Some(base_url),
        port: Some(port),
    })
}

/// 停止 Agent 进程
#[tauri::command]
pub async fn agent_stop_process(aster_state: State<'_, AsterProcessState>) -> Result<(), String> {
    tracing::info!("[AGENT] 停止 aster 进程");

    aster_state.stop().await?;

    tracing::info!("[AGENT] aster 进程已停止");
    Ok(())
}

/// 获取 Agent 进程状态
#[tauri::command]
pub async fn agent_get_process_status(
    aster_state: State<'_, AsterProcessState>,
) -> Result<AgentProcessStatus, String> {
    let running = aster_state.is_running();

    if running {
        let guard = aster_state.0.read();
        if let Some(process) = guard.as_ref() {
            Ok(AgentProcessStatus {
                running: true,
                base_url: Some(process.base_url().to_string()),
                port: Some(process.port()),
            })
        } else {
            Ok(AgentProcessStatus {
                running: false,
                base_url: None,
                port: None,
            })
        }
    } else {
        Ok(AgentProcessStatus {
            running: false,
            base_url: None,
            port: None,
        })
    }
}

/// 创建 Agent 会话
///
/// 使用 gateway provider 将请求转发到 ProxyCast API Server，
/// 由 ProxyCast 统一处理凭证和路由。
///
/// # 参数
///
/// - `provider_type`: Provider 类型（用于前端显示，如 claude, openai, gemini）
/// - `model`: 模型名称（可选）
#[tauri::command]
pub async fn agent_create_session(
    aster_state: State<'_, AsterProcessState>,
    app_state: State<'_, AppState>,
    provider_type: String,
    model: Option<String>,
) -> Result<CreateSessionResponse, String> {
    tracing::info!(
        "[AGENT] 创建会话: provider_type={}, model={:?}",
        provider_type,
        model
    );

    // 检查 aster 进程是否运行
    if !aster_state.is_running() {
        return Err("aster 进程未运行，请先启动进程".to_string());
    }

    // 获取 ProxyCast API Server 配置
    let (proxycast_port, proxycast_api_key, server_running) = {
        let state = app_state.read().await;
        (
            state.config.server.port,
            state.running_api_key.clone(),
            state.running,
        )
    };

    // 检查 ProxyCast 服务器是否运行
    if !server_running {
        return Err("ProxyCast API Server 未运行，请先启动服务器".to_string());
    }

    let proxycast_api_key =
        proxycast_api_key.ok_or_else(|| "ProxyCast API Server 未配置 API Key".to_string())?;

    // 构建 ProxyCast base_url
    let proxycast_base_url = format!("http://127.0.0.1:{}", proxycast_port);

    tracing::info!(
        "[AGENT] 使用 gateway provider, base_url={}, model={:?}",
        proxycast_base_url,
        model
    );

    // 获取 aster 服务地址
    let aster_base_url = {
        let guard = aster_state.0.read();
        guard
            .as_ref()
            .map(|p| p.base_url().to_string())
            .ok_or_else(|| "无法获取 aster 服务地址".to_string())?
    };

    // 创建 aster 客户端
    let client = AsterClient::new(aster_base_url)?;

    // 创建 Agent，使用 gateway provider
    // gateway provider 会根据 model 名称自动推断协议（anthropic/openai/gemini）
    let response = client
        .create_agent(model.clone(), proxycast_api_key, proxycast_base_url)
        .await?;

    tracing::info!("[AGENT] Agent 创建成功: {}", response.data.id);

    Ok(CreateSessionResponse {
        session_id: response.data.id, // 使用 agent_id 作为 session_id
        credential_name: "ProxyCast".to_string(),
        credential_uuid: "proxycast-gateway".to_string(),
        provider_type,
        model,
    })
}

/// 图片输入（前端传入）
#[derive(Debug, Deserialize)]
pub struct ImageInputParam {
    /// base64 编码的图片数据
    pub data: String,
    /// MIME 类型，如 "image/png"
    pub media_type: String,
}

/// 发送消息到 Agent（使用同步 chat API）
///
/// # 参数
///
/// - `message`: 消息内容
/// - `images`: 图片列表（可选）
/// - `model`: 模型名称（可选）
#[tauri::command]
pub async fn agent_send_message(
    aster_state: State<'_, AsterProcessState>,
    app_state: State<'_, AppState>,
    message: String,
    images: Option<Vec<ImageInputParam>>,
    model: Option<String>,
) -> Result<String, String> {
    tracing::info!(
        "[AGENT] 发送消息: message={}, images={:?}",
        message,
        images.as_ref().map(|v| v.len())
    );
    println!(
        "[DEBUG] agent_send_message: message={}, model={:?}",
        message, model
    );

    // 检查进程是否运行
    if !aster_state.is_running() {
        return Err("aster 进程未运行，请先启动进程".to_string());
    }

    // 获取 ProxyCast API Server 配置
    let (proxycast_port, proxycast_api_key, server_running) = {
        let state = app_state.read().await;
        (
            state.config.server.port,
            state.running_api_key.clone(),
            state.running,
        )
    };

    // 检查 ProxyCast 服务器是否运行
    if !server_running {
        return Err("ProxyCast API Server 未运行，请先启动服务器".to_string());
    }

    let proxycast_api_key =
        proxycast_api_key.ok_or_else(|| "ProxyCast API Server 未配置 API Key".to_string())?;

    // 构建 ProxyCast base_url
    let proxycast_base_url = format!("http://127.0.0.1:{}", proxycast_port);

    // 获取 aster 服务地址
    let aster_base_url = {
        let guard = aster_state.0.read();
        guard
            .as_ref()
            .map(|p| p.base_url().to_string())
            .ok_or_else(|| "无法获取 aster 服务地址".to_string())?
    };

    println!(
        "[DEBUG] agent_send_message: aster_base_url={}, proxycast_base_url={}",
        aster_base_url, proxycast_base_url
    );

    // 创建客户端
    let client = AsterClient::new(aster_base_url)?;

    // 转换图片格式
    let images_for_api = images.map(|imgs| {
        imgs.into_iter()
            .map(|img| crate::agent::ImageInput {
                data: img.data,
                media_type: img.media_type,
            })
            .collect()
    });

    // 使用同步 chat API 发送消息（支持图片）
    let response = client
        .chat_with_images(
            &message,
            images_for_api,
            model,
            proxycast_api_key,
            proxycast_base_url,
        )
        .await?;

    println!(
        "[DEBUG] agent_send_message: response success={}, text len={}",
        response.success,
        response.text.len()
    );
    tracing::info!("[AGENT] 消息发送成功");

    // 优先返回 text，如果为空则返回 output
    let result = if !response.text.is_empty() {
        response.text
    } else {
        response.output
    };

    Ok(result)
}

/// 会话信息
#[derive(Debug, Serialize, Deserialize)]
pub struct SessionInfo {
    /// 会话 ID
    pub session_id: String,
    /// Provider 类型
    pub provider_type: String,
    /// 模型名称
    pub model: Option<String>,
    /// 创建时间
    pub created_at: String,
    /// 最后活动时间
    pub last_activity: String,
    /// 消息数量
    pub messages_count: usize,
}

/// 获取会话列表
#[tauri::command]
pub async fn agent_list_sessions(
    aster_state: State<'_, AsterProcessState>,
) -> Result<Vec<SessionInfo>, String> {
    tracing::info!("[AGENT] 获取会话列表");

    // 检查进程是否运行
    if !aster_state.is_running() {
        return Err("aster 进程未运行，请先启动进程".to_string());
    }

    // 获取 base_url
    let base_url = {
        let guard = aster_state.0.read();
        guard
            .as_ref()
            .map(|p| p.base_url().to_string())
            .ok_or_else(|| "无法获取 aster 服务地址".to_string())?
    };

    // 创建客户端
    let client = AsterClient::new(base_url)?;

    // 获取会话列表
    let sessions = client.list_sessions().await?;

    // 转换为前端格式
    let result = sessions
        .into_iter()
        .map(|s| SessionInfo {
            session_id: s.session_id,
            provider_type: s.provider_type,
            model: s.model,
            created_at: s.created_at,
            last_activity: s.last_activity,
            messages_count: s.messages_count,
        })
        .collect();

    tracing::info!("[AGENT] 获取会话列表成功");

    Ok(result)
}

/// 获取会话详情
///
/// # 参数
///
/// - `session_id`: 会话 ID
#[tauri::command]
pub async fn agent_get_session(
    aster_state: State<'_, AsterProcessState>,
    session_id: String,
) -> Result<SessionInfo, String> {
    tracing::info!("[AGENT] 获取会话详情: session_id={}", session_id);

    // 检查进程是否运行
    if !aster_state.is_running() {
        return Err("aster 进程未运行，请先启动进程".to_string());
    }

    // 获取 base_url
    let base_url = {
        let guard = aster_state.0.read();
        guard
            .as_ref()
            .map(|p| p.base_url().to_string())
            .ok_or_else(|| "无法获取 aster 服务地址".to_string())?
    };

    // 创建客户端
    let client = AsterClient::new(base_url)?;

    // 获取会话详情
    let session = client.get_session(&session_id).await?;

    tracing::info!("[AGENT] 获取会话详情成功");

    Ok(SessionInfo {
        session_id: session.session_id,
        provider_type: session.provider_type,
        model: session.model,
        created_at: session.created_at,
        last_activity: session.last_activity,
        messages_count: session.messages_count,
    })
}

/// 删除会话
///
/// # 参数
///
/// - `session_id`: 会话 ID
#[tauri::command]
pub async fn agent_delete_session(
    aster_state: State<'_, AsterProcessState>,
    session_id: String,
) -> Result<(), String> {
    tracing::info!("[AGENT] 删除会话: session_id={}", session_id);

    // 检查进程是否运行
    if !aster_state.is_running() {
        return Err("aster 进程未运行，请先启动进程".to_string());
    }

    // 获取 base_url
    let base_url = {
        let guard = aster_state.0.read();
        guard
            .as_ref()
            .map(|p| p.base_url().to_string())
            .ok_or_else(|| "无法获取 aster 服务地址".to_string())?
    };

    // 创建客户端
    let client = AsterClient::new(base_url)?;

    // 删除会话
    client.delete_session(&session_id).await?;

    tracing::info!("[AGENT] 会话删除成功");

    Ok(())
}
