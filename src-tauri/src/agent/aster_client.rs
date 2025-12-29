//! aster HTTP 客户端
//!
//! 提供与 aster 子进程通信的 HTTP 客户端接口

use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

/// 根据模型名称推断 provider 类型
/// 注意：当使用 ProxyCast 作为网关时，应该使用 "gateway" provider
fn infer_provider_from_model(model: Option<&str>) -> &'static str {
    // 始终使用 gateway provider，因为我们通过 ProxyCast 代理请求
    // gateway provider 会根据模型名称自动选择正确的协议（Anthropic 或 OpenAI）
    "gateway"
}

/// aster HTTP 客户端
pub struct AsterClient {
    /// HTTP 客户端
    client: Client,
    /// aster 服务基础 URL
    base_url: String,
}

/// 创建会话请求
#[derive(Debug, Serialize)]
pub struct CreateSessionRequest {
    /// Provider 类型
    pub provider_type: String,
    /// 模型名称（可选）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    /// 模型配置（包含 API Key）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_config: Option<ModelConfig>,
}

/// 图片输入
#[derive(Debug, Serialize, Clone)]
pub struct ImageInput {
    /// base64 编码的图片数据
    pub data: String,
    /// MIME 类型，如 "image/png"
    pub media_type: String,
}

/// Chat 请求（直接调用 /v1/agents/chat）
#[derive(Debug, Serialize)]
pub struct ChatRequest {
    /// 模板 ID
    pub template_id: String,
    /// 输入消息
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input: Option<String>,
    /// 图片列表
    #[serde(skip_serializing_if = "Option::is_none")]
    pub images: Option<Vec<ImageInput>>,
    /// 模型配置
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_config: Option<ModelConfig>,
}

/// Chat 响应
#[derive(Debug, Deserialize)]
pub struct ChatResponse {
    /// Agent ID
    pub agent_id: String,
    /// 输出内容
    #[serde(default)]
    pub output: String,
    /// 文本内容
    #[serde(default)]
    pub text: String,
    /// 状态
    pub status: String,
    /// 是否成功
    pub success: bool,
}

/// 创建 Agent 请求
#[derive(Debug, Serialize)]
pub struct CreateAgentRequest {
    /// 模板 ID
    pub template_id: String,
    /// Agent 名称（可选）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    /// 模型配置
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_config: Option<ModelConfig>,
}

/// 创建 Agent 响应
#[derive(Debug, Deserialize)]
pub struct CreateAgentResponse {
    /// 响应数据
    pub data: CreateAgentData,
    /// 是否成功
    pub success: bool,
}

/// 创建 Agent 数据
#[derive(Debug, Deserialize)]
pub struct CreateAgentData {
    /// Agent ID
    pub id: String,
}

/// 发送消息到 Agent 请求
#[derive(Debug, Serialize)]
pub struct SendToAgentRequest {
    /// 消息内容
    pub message: String,
}

/// 发送消息到 Agent 响应
#[derive(Debug, Deserialize)]
pub struct SendToAgentResponse {
    /// 响应文本
    #[serde(default)]
    pub text: String,
    /// 是否成功
    pub success: bool,
}

/// 模型配置
#[derive(Debug, Serialize)]
pub struct ModelConfig {
    /// Provider 名称
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    /// 模型名称
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    /// API Key
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    /// Base URL（用于 gateway provider）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
}

/// 创建会话响应
#[derive(Debug, Deserialize)]
pub struct CreateSessionResponse {
    /// 会话 ID
    pub session_id: String,
    /// Provider 类型
    pub provider_type: String,
    /// 模型名称
    pub model: Option<String>,
    /// 创建时间
    pub created_at: String,
}

/// 发送消息请求
#[derive(Debug, Serialize)]
pub struct SendMessageRequest {
    /// 消息内容
    pub message: String,
    /// 是否流式响应
    #[serde(default)]
    pub stream: bool,
}

/// 发送消息响应（非流式）
#[derive(Debug, Deserialize)]
pub struct SendMessageResponse {
    /// 消息 ID
    pub message_id: String,
    /// 会话 ID
    pub session_id: String,
    /// 响应内容
    pub content: String,
    /// Token 使用量
    pub usage: Option<TokenUsage>,
}

/// Token 使用量
#[derive(Debug, Deserialize)]
pub struct TokenUsage {
    /// 输入 Token 数
    pub input_tokens: u32,
    /// 输出 Token 数
    pub output_tokens: u32,
}

/// 会话信息
#[derive(Debug, Deserialize)]
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

impl AsterClient {
    /// 创建新的 aster 客户端
    ///
    /// # 参数
    ///
    /// - `base_url`: aster 服务基础 URL (例如 "http://127.0.0.1:8081")
    pub fn new(base_url: String) -> Result<Self, String> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .no_proxy() // 禁用代理，直接连接 localhost
            .build()
            .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

        Ok(Self { client, base_url })
    }

    /// 创建新会话
    ///
    /// # 参数
    ///
    /// - `provider_type`: Provider 类型 (gateway, anthropic, openai, etc.)
    /// - `model`: 模型名称（可选）
    /// - `api_key`: API Key（可选，如果提供则注入到请求中）
    /// - `gateway_base_url`: Gateway 的目标 base_url（可选，用于 gateway provider）
    pub async fn create_session(
        &self,
        provider_type: &str,
        model: Option<String>,
        api_key: Option<String>,
        gateway_base_url: Option<String>,
    ) -> Result<CreateSessionResponse, String> {
        let url = format!("{}/v1/sessions", self.base_url);

        let model_config = if api_key.is_some() || gateway_base_url.is_some() {
            Some(ModelConfig {
                provider: Some(provider_type.to_string()),
                model: model.clone(),
                api_key,
                base_url: gateway_base_url,
            })
        } else {
            None
        };

        let request = CreateSessionRequest {
            provider_type: provider_type.to_string(),
            model,
            model_config,
        };

        let response = self
            .client
            .post(&url)
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("创建会话请求失败: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "无法读取响应".to_string());
            return Err(format!("创建会话失败 ({}): {}", status, body));
        }

        response
            .json::<CreateSessionResponse>()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))
    }

    /// 直接聊天（调用 /v1/agents/chat）
    ///
    /// 这个方法是同步的，会等待 LLM 响应完成后返回。
    /// 每次调用会创建一个临时 agent 来处理请求。
    ///
    /// # 参数
    ///
    /// - `input`: 输入消息
    /// - `model`: 模型名称（可选）
    /// - `api_key`: API Key
    /// - `gateway_base_url`: Gateway 的目标 base_url
    pub async fn chat(
        &self,
        input: &str,
        model: Option<String>,
        api_key: String,
        gateway_base_url: String,
    ) -> Result<ChatResponse, String> {
        self.chat_with_images(input, None, model, api_key, gateway_base_url)
            .await
    }

    /// 直接聊天（支持图片）
    ///
    /// # 参数
    ///
    /// - `input`: 输入消息
    /// - `images`: 图片列表（可选）
    /// - `model`: 模型名称（可选）
    /// - `api_key`: API Key
    /// - `gateway_base_url`: Gateway 的目标 base_url
    pub async fn chat_with_images(
        &self,
        input: &str,
        images: Option<Vec<ImageInput>>,
        model: Option<String>,
        api_key: String,
        gateway_base_url: String,
    ) -> Result<ChatResponse, String> {
        let url = format!("{}/v1/agents/chat", self.base_url);

        println!("[DEBUG] chat URL: {}", url);

        // 根据模型名称推断 provider 类型
        let provider = infer_provider_from_model(model.as_deref());

        let model_config = ModelConfig {
            provider: Some(provider.to_string()),
            model: model.clone(),
            api_key: Some(api_key),
            base_url: Some(gateway_base_url),
        };

        let request = ChatRequest {
            template_id: "chat".to_string(),
            input: if input.is_empty() {
                None
            } else {
                Some(input.to_string())
            },
            images,
            model_config: Some(model_config),
        };

        let request_json = serde_json::to_string(&request).unwrap_or_default();
        println!("[DEBUG] chat request: {}", request_json);

        let response = self
            .client
            .post(&url)
            .json(&request)
            .timeout(Duration::from_secs(300)) // 聊天可能需要很长时间
            .send()
            .await
            .map_err(|e| {
                println!("[DEBUG] chat send error: {}", e);
                format!("聊天请求失败: {}", e)
            })?;

        let status = response.status();
        println!("[DEBUG] chat response status: {}", status);

        if !status.is_success() {
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "无法读取响应".to_string());
            println!("[DEBUG] chat error body: {}", body);
            return Err(format!("聊天失败 ({}): {}", status, body));
        }

        let body = response.text().await.map_err(|e| {
            println!("[DEBUG] chat read body error: {}", e);
            format!("读取响应失败: {}", e)
        })?;

        println!("[DEBUG] chat response body: {}", body);

        serde_json::from_str::<ChatResponse>(&body).map_err(|e| {
            println!("[DEBUG] chat parse error: {}", e);
            format!("解析响应失败: {}", e)
        })
    }

    /// 创建 Agent（调用 /v1/agents）
    ///
    /// # 参数
    ///
    /// - `model`: 模型名称（可选）
    /// - `api_key`: API Key
    /// - `gateway_base_url`: Gateway 的目标 base_url
    pub async fn create_agent(
        &self,
        model: Option<String>,
        api_key: String,
        gateway_base_url: String,
    ) -> Result<CreateAgentResponse, String> {
        let url = format!("{}/v1/agents", self.base_url);

        println!("[DEBUG] create_agent URL: {}", url);

        // 根据模型名称推断 provider 类型
        let provider = infer_provider_from_model(model.as_deref());

        let model_config = ModelConfig {
            provider: Some(provider.to_string()),
            model: model.clone(),
            api_key: Some(api_key),
            base_url: Some(gateway_base_url),
        };

        let request = CreateAgentRequest {
            template_id: "chat".to_string(),
            name: None,
            model_config: Some(model_config),
        };

        let request_json = serde_json::to_string(&request).unwrap_or_default();
        println!("[DEBUG] create_agent request: {}", request_json);

        let response = self
            .client
            .post(&url)
            .json(&request)
            .send()
            .await
            .map_err(|e| {
                println!("[DEBUG] create_agent send error: {}", e);
                format!("创建 Agent 请求失败: {}", e)
            })?;

        let status = response.status();
        let headers = response.headers().clone();
        println!("[DEBUG] create_agent response status: {}", status);
        println!("[DEBUG] create_agent response headers: {:?}", headers);

        if !status.is_success() {
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "无法读取响应".to_string());
            println!("[DEBUG] create_agent error body: '{}'", body);
            println!("[DEBUG] create_agent error body len: {}", body.len());
            return Err(format!("创建 Agent 失败 ({}): {}", status, body));
        }

        let body = response.text().await.map_err(|e| {
            println!("[DEBUG] create_agent read body error: {}", e);
            format!("读取响应失败: {}", e)
        })?;

        println!("[DEBUG] create_agent response body: {}", body);

        serde_json::from_str::<CreateAgentResponse>(&body).map_err(|e| {
            println!("[DEBUG] create_agent parse error: {}", e);
            format!("解析响应失败: {}", e)
        })
    }

    /// 向 Agent 发送消息（调用 /v1/agents/:id/send）
    ///
    /// # 参数
    ///
    /// - `agent_id`: Agent ID
    /// - `message`: 消息内容
    pub async fn send_to_agent(
        &self,
        agent_id: &str,
        message: &str,
    ) -> Result<SendToAgentResponse, String> {
        let url = format!("{}/v1/agents/{}/send", self.base_url, agent_id);

        let request = SendToAgentRequest {
            message: message.to_string(),
        };

        let response = self
            .client
            .post(&url)
            .json(&request)
            .timeout(Duration::from_secs(120)) // 聊天可能需要更长时间
            .send()
            .await
            .map_err(|e| format!("发送消息请求失败: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "无法读取响应".to_string());
            return Err(format!("发送消息失败 ({}): {}", status, body));
        }

        response
            .json::<SendToAgentResponse>()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))
    }

    /// 发送消息（非流式）
    ///
    /// # 参数
    ///
    /// - `session_id`: 会话 ID
    /// - `message`: 消息内容
    pub async fn send_message(
        &self,
        session_id: &str,
        message: &str,
    ) -> Result<SendMessageResponse, String> {
        let url = format!("{}/api/v1/sessions/{}/messages", self.base_url, session_id);
        let request = SendMessageRequest {
            message: message.to_string(),
            stream: false,
        };

        let response = self
            .client
            .post(&url)
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("发送消息请求失败: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "无法读取响应".to_string());
            return Err(format!("发送消息失败 ({}): {}", status, body));
        }

        response
            .json::<SendMessageResponse>()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))
    }

    /// 获取会话列表
    pub async fn list_sessions(&self) -> Result<Vec<SessionInfo>, String> {
        let url = format!("{}/api/v1/sessions", self.base_url);

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("获取会话列表请求失败: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "无法读取响应".to_string());
            return Err(format!("获取会话列表失败 ({}): {}", status, body));
        }

        response
            .json::<Vec<SessionInfo>>()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))
    }

    /// 获取会话详情
    ///
    /// # 参数
    ///
    /// - `session_id`: 会话 ID
    pub async fn get_session(&self, session_id: &str) -> Result<SessionInfo, String> {
        let url = format!("{}/api/v1/sessions/{}", self.base_url, session_id);

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("获取会话详情请求失败: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "无法读取响应".to_string());
            return Err(format!("获取会话详情失败 ({}): {}", status, body));
        }

        response
            .json::<SessionInfo>()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))
    }

    /// 删除会话
    ///
    /// # 参数
    ///
    /// - `session_id`: 会话 ID
    pub async fn delete_session(&self, session_id: &str) -> Result<(), String> {
        let url = format!("{}/api/v1/sessions/{}", self.base_url, session_id);

        let response = self
            .client
            .delete(&url)
            .send()
            .await
            .map_err(|e| format!("删除会话请求失败: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "无法读取响应".to_string());
            return Err(format!("删除会话失败 ({}): {}", status, body));
        }

        Ok(())
    }

    /// 检查健康状态
    pub async fn health_check(&self) -> Result<bool, String> {
        let url = format!("{}/health", self.base_url);

        match self.client.get(&url).send().await {
            Ok(response) => Ok(response.status().is_success()),
            Err(e) => Err(format!("健康检查失败: {}", e)),
        }
    }
}
