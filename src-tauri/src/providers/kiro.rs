//! Kiro/CodeWhisperer Provider
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::path::PathBuf;
use reqwest::Client;
use crate::models::openai::*;
use crate::models::codewhisperer::*;
use crate::converter::openai_to_cw::convert_openai_to_codewhisperer;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KiroCredentials {
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub client_id: Option<String>,
    pub client_secret: Option<String>,
    pub profile_arn: Option<String>,
    pub expires_at: Option<String>,
    pub region: Option<String>,
    pub auth_method: Option<String>,
}

impl Default for KiroCredentials {
    fn default() -> Self {
        Self {
            access_token: None,
            refresh_token: None,
            client_id: None,
            client_secret: None,
            profile_arn: None,
            expires_at: None,
            region: Some("us-east-1".to_string()),
            auth_method: Some("social".to_string()),
        }
    }
}

pub struct KiroProvider {
    pub credentials: KiroCredentials,
    pub client: Client,
}

impl KiroProvider {
    pub fn new() -> Self {
        Self {
            credentials: KiroCredentials::default(),
            client: Client::new(),
        }
    }
    
    pub fn default_creds_path() -> PathBuf {
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".aws")
            .join("sso")
            .join("cache")
            .join("kiro-auth-token.json")
    }
    
    pub fn load_credentials(&mut self) -> Result<(), Box<dyn Error + Send + Sync>> {
        let path = Self::default_creds_path();
        let dir = path.parent().unwrap();
        
        let mut merged = KiroCredentials::default();
        
        // 读取主凭证文件
        if path.exists() {
            let content = std::fs::read_to_string(&path)?;
            let creds: KiroCredentials = serde_json::from_str(&content)?;
            merge_credentials(&mut merged, &creds);
        }
        
        // 读取目录中其他 JSON 文件
        if dir.is_dir() {
            for entry in std::fs::read_dir(dir)? {
                let entry = entry?;
                let file_path = entry.path();
                if file_path.extension().map(|e| e == "json").unwrap_or(false) 
                    && file_path != path {
                    if let Ok(content) = std::fs::read_to_string(&file_path) {
                        if let Ok(creds) = serde_json::from_str::<KiroCredentials>(&content) {
                            merge_credentials(&mut merged, &creds);
                        }
                    }
                }
            }
        }
        
        self.credentials = merged;
        Ok(())
    }
    
    pub fn get_base_url(&self) -> String {
        let region = self.credentials.region.as_deref().unwrap_or("us-east-1");
        format!("https://codewhisperer.{}.amazonaws.com/generateAssistantResponse", region)
    }
    
    pub fn get_refresh_url(&self) -> String {
        let region = self.credentials.region.as_deref().unwrap_or("us-east-1");
        let auth_method = self.credentials.auth_method.as_deref().unwrap_or("social");
        
        if auth_method == "idc" {
            format!("https://oidc.{}.amazonaws.com/token", region)
        } else {
            format!("https://prod.{}.auth.desktop.kiro.dev/refreshToken", region)
        }
    }
    
    pub async fn refresh_token(&mut self) -> Result<String, Box<dyn Error + Send + Sync>> {
        let refresh_token = self.credentials.refresh_token.as_ref()
            .ok_or("No refresh token")?;
        
        let auth_method = self.credentials.auth_method.as_deref().unwrap_or("social");
        let refresh_url = self.get_refresh_url();
        
        let body = if auth_method == "idc" {
            serde_json::json!({
                "refreshToken": refresh_token,
                "clientId": self.credentials.client_id,
                "clientSecret": self.credentials.client_secret,
                "grantType": "refresh_token"
            })
        } else {
            serde_json::json!({ "refreshToken": refresh_token })
        };
        
        let resp = self.client
            .post(&refresh_url)
            .json(&body)
            .send()
            .await?;
        
        if !resp.status().is_success() {
            return Err(format!("Refresh failed: {}", resp.status()).into());
        }
        
        let data: serde_json::Value = resp.json().await?;
        let new_token = data["accessToken"]
            .as_str()
            .ok_or("No access token in response")?;
        
        self.credentials.access_token = Some(new_token.to_string());
        
        if let Some(rt) = data["refreshToken"].as_str() {
            self.credentials.refresh_token = Some(rt.to_string());
        }
        if let Some(arn) = data["profileArn"].as_str() {
            self.credentials.profile_arn = Some(arn.to_string());
        }
        
        Ok(new_token.to_string())
    }
    
    pub async fn call_api(
        &self,
        request: &ChatCompletionRequest,
    ) -> Result<reqwest::Response, Box<dyn Error + Send + Sync>> {
        let token = self.credentials.access_token.as_ref()
            .ok_or("No access token")?;
        
        let profile_arn = if self.credentials.auth_method.as_deref() == Some("social") {
            self.credentials.profile_arn.clone()
        } else {
            None
        };
        
        let cw_request = convert_openai_to_codewhisperer(request, profile_arn);
        let url = self.get_base_url();
        
        let resp = self.client
            .post(&url)
            .header("Authorization", format!("Bearer {}", token))
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            .header("amz-sdk-invocation-id", uuid::Uuid::new_v4().to_string())
            .json(&cw_request)
            .send()
            .await?;
        
        Ok(resp)
    }
}

fn merge_credentials(target: &mut KiroCredentials, source: &KiroCredentials) {
    if source.access_token.is_some() {
        target.access_token = source.access_token.clone();
    }
    if source.refresh_token.is_some() {
        target.refresh_token = source.refresh_token.clone();
    }
    if source.client_id.is_some() {
        target.client_id = source.client_id.clone();
    }
    if source.client_secret.is_some() {
        target.client_secret = source.client_secret.clone();
    }
    if source.profile_arn.is_some() {
        target.profile_arn = source.profile_arn.clone();
    }
    if source.expires_at.is_some() {
        target.expires_at = source.expires_at.clone();
    }
    if source.region.is_some() {
        target.region = source.region.clone();
    }
    if source.auth_method.is_some() {
        target.auth_method = source.auth_method.clone();
    }
}
