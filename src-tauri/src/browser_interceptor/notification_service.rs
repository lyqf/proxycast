use crate::browser_interceptor::{InterceptedUrl, Result};
use serde::{Deserialize, Serialize};
use std::time::Duration;

/// 通知类型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum NotificationType {
    UrlIntercepted,
    InterceptorEnabled,
    InterceptorDisabled,
    SystemRestored,
    Error,
}

/// 通知消息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationMessage {
    pub id: String,
    pub notification_type: NotificationType,
    pub title: String,
    pub message: String,
    pub url: Option<String>,
    pub source_process: Option<String>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub auto_dismiss_after: Option<Duration>,
}

impl NotificationMessage {
    pub fn new(notification_type: NotificationType, title: String, message: String) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            notification_type,
            title,
            message,
            url: None,
            source_process: None,
            timestamp: chrono::Utc::now(),
            auto_dismiss_after: Some(Duration::from_secs(30)),
        }
    }

    pub fn with_url(mut self, url: String) -> Self {
        self.url = Some(url);
        self
    }

    pub fn with_source_process(mut self, source_process: String) -> Self {
        self.source_process = Some(source_process);
        self
    }

    pub fn with_auto_dismiss(mut self, duration: Option<Duration>) -> Self {
        self.auto_dismiss_after = duration;
        self
    }
}

/// 通知服务
pub struct NotificationService {
    enabled: bool,
    show_url_preview: bool,
}

impl NotificationService {
    pub fn new() -> Self {
        Self {
            enabled: true,
            show_url_preview: true,
        }
    }

    /// 设置通知是否启用
    pub fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
    }

    /// 设置是否显示 URL 预览
    pub fn set_show_url_preview(&mut self, show_preview: bool) {
        self.show_url_preview = show_preview;
    }

    /// 发送 URL 拦截通知
    pub async fn notify_url_intercepted(&self, intercepted_url: &InterceptedUrl) -> Result<()> {
        if !self.enabled {
            return Ok(());
        }

        let title = format!("已拦截来自 {} 的 URL", intercepted_url.source_process);
        let message = if self.show_url_preview {
            format!("URL: {}", self.truncate_url(&intercepted_url.url, 100))
        } else {
            "点击查看详情".to_string()
        };

        let notification =
            NotificationMessage::new(NotificationType::UrlIntercepted, title, message)
                .with_url(intercepted_url.url.clone())
                .with_source_process(intercepted_url.source_process.clone());

        self.send_notification(notification).await
    }

    /// 发送拦截器启用通知
    pub async fn notify_interceptor_enabled(&self) -> Result<()> {
        if !self.enabled {
            return Ok(());
        }

        let notification = NotificationMessage::new(
            NotificationType::InterceptorEnabled,
            "浏览器拦截器已启用".to_string(),
            "现在会拦截目标应用的浏览器启动请求".to_string(),
        );

        self.send_notification(notification).await
    }

    /// 发送拦截器禁用通知
    pub async fn notify_interceptor_disabled(&self) -> Result<()> {
        if !self.enabled {
            return Ok(());
        }

        let notification = NotificationMessage::new(
            NotificationType::InterceptorDisabled,
            "浏览器拦截器已禁用".to_string(),
            "应用将正常打开默认浏览器".to_string(),
        );

        self.send_notification(notification).await
    }

    /// 发送系统恢复通知
    pub async fn notify_system_restored(&self) -> Result<()> {
        if !self.enabled {
            return Ok(());
        }

        let notification = NotificationMessage::new(
            NotificationType::SystemRestored,
            "系统已恢复正常".to_string(),
            "浏览器行为已恢复到原始状态".to_string(),
        );

        self.send_notification(notification).await
    }

    /// 发送错误通知
    pub async fn notify_error(&self, error_message: &str) -> Result<()> {
        if !self.enabled {
            return Ok(());
        }

        let notification = NotificationMessage::new(
            NotificationType::Error,
            "浏览器拦截器错误".to_string(),
            error_message.to_string(),
        )
        .with_auto_dismiss(Some(Duration::from_secs(60))); // 错误通知显示更长时间

        self.send_notification(notification).await
    }

    /// 发送通知的具体实现
    async fn send_notification(&self, notification: NotificationMessage) -> Result<()> {
        // 记录日志
        tracing::info!(
            "发送通知: {} - {}",
            notification.title,
            notification.message
        );

        // 发送系统通知
        self.send_system_notification(&notification).await?;

        Ok(())
    }

    /// 发送系统通知
    async fn send_system_notification(&self, notification: &NotificationMessage) -> Result<()> {
        #[cfg(target_os = "windows")]
        {
            self.send_windows_notification(notification).await?;
        }

        #[cfg(target_os = "macos")]
        {
            self.send_macos_notification(notification).await?;
        }

        #[cfg(target_os = "linux")]
        {
            self.send_linux_notification(notification).await?;
        }

        Ok(())
    }

    /// Windows 系统通知
    #[cfg(target_os = "windows")]
    async fn send_windows_notification(&self, notification: &NotificationMessage) -> Result<()> {
        tracing::debug!("Windows 通知: {}", notification.title);
        Ok(())
    }

    /// macOS 系统通知
    #[cfg(target_os = "macos")]
    async fn send_macos_notification(&self, notification: &NotificationMessage) -> Result<()> {
        tracing::debug!("macOS 通知: {}", notification.title);
        Ok(())
    }

    /// Linux 系统通知
    #[cfg(target_os = "linux")]
    async fn send_linux_notification(&self, notification: &NotificationMessage) -> Result<()> {
        tracing::debug!("Linux 通知: {}", notification.title);
        Ok(())
    }

    /// 截断 URL 以适应通知显示
    fn truncate_url(&self, url: &str, max_length: usize) -> String {
        if url.len() <= max_length {
            url.to_string()
        } else {
            format!("{}...", &url[..max_length.saturating_sub(3)])
        }
    }
}

impl Default for NotificationService {
    fn default() -> Self {
        Self::new()
    }
}
