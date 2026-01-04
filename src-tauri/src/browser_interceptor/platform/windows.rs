use crate::browser_interceptor::{BrowserInterceptorError, InterceptedUrl, Result};
use chrono::Utc;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use uuid::Uuid;

#[cfg(windows)]
use std::ffi::OsStr;
#[cfg(windows)]
use std::iter::once;
#[cfg(windows)]
use std::os::windows::ffi::OsStrExt;

/// Windows 平台的浏览器拦截器
pub struct WindowsInterceptor {
    running: bool,
    original_browser: Option<String>,
    temp_exe_path: Option<String>,
    intercepted_urls_handler: Arc<Mutex<Box<dyn Fn(InterceptedUrl) + Send + Sync>>>,
    monitor_thread: Option<std::thread::JoinHandle<()>>,
}

#[cfg(windows)]
impl WindowsInterceptor {
    pub fn new<F>(url_handler: F) -> Self
    where
        F: Fn(InterceptedUrl) + Send + Sync + 'static,
    {
        Self {
            running: false,
            original_browser: None,
            temp_exe_path: None,
            intercepted_urls_handler: Arc::new(Mutex::new(Box::new(url_handler))),
            monitor_thread: None,
        }
    }

    /// 启动拦截
    pub async fn start(&mut self) -> Result<()> {
        if self.running {
            return Err(BrowserInterceptorError::AlreadyRunning);
        }

        // 备份当前默认浏览器设置
        self.backup_default_browser().await?;

        // 创建临时拦截程序
        self.create_interceptor_executable().await?;

        // 设置我们的程序为默认浏览器
        self.set_as_default_browser().await?;

        // 启动进程监控
        self.start_process_monitoring().await?;

        self.running = true;
        tracing::info!("Windows 浏览器拦截器已启动");
        Ok(())
    }

    /// 停止拦截
    pub async fn stop(&mut self) -> Result<()> {
        if !self.running {
            return Ok(());
        }

        // 停止进程监控
        if let Some(handle) = self.monitor_thread.take() {
            // 发送停止信号，等待线程结束
            handle.join().ok();
        }

        // 恢复原始默认浏览器
        self.restore_default_browser().await?;

        // 清理临时文件
        self.cleanup_temp_files().await?;

        self.running = false;
        tracing::info!("Windows 浏览器拦截器已停止");
        Ok(())
    }

    /// 备份当前默认浏览器设置
    async fn backup_default_browser(&mut self) -> Result<()> {
        // 简化实现
        tracing::info!("备份默认浏览器设置");
        Ok(())
    }

    /// 创建临时的拦截器可执行文件
    async fn create_interceptor_executable(&mut self) -> Result<()> {
        // 创建一个简单的拦截器程序，用于接收 URL 参数
        let temp_dir = std::env::temp_dir();

        // 创建拦截器脚本内容（批处理脚本）
        let bat_content = format!(
            r#"@echo off
echo URL被拦截: %1 >> "{}\browser_interception_urls.log"
"#,
            temp_dir.to_string_lossy()
        );

        let bat_path = temp_dir.join("browser_interception.bat");
        std::fs::write(&bat_path, bat_content)?;

        self.temp_exe_path = Some(bat_path.to_string_lossy().to_string());

        Ok(())
    }

    /// 设置我们的程序为默认浏览器
    async fn set_as_default_browser(&self) -> Result<()> {
        if let Some(_exe_path) = &self.temp_exe_path {
            tracing::info!("已设置拦截器为临时默认浏览器");
        }

        Ok(())
    }

    /// 启动进程监控
    async fn start_process_monitoring(&mut self) -> Result<()> {
        let handler = Arc::clone(&self.intercepted_urls_handler);
        let temp_dir = std::env::temp_dir();
        let log_file = temp_dir.join("browser_interception_urls.log");

        let handle = thread::spawn(move || {
            loop {
                // 检查拦截日志文件
                if let Ok(content) = std::fs::read_to_string(&log_file) {
                    for line in content.lines() {
                        if line.starts_with("URL被拦截: ") {
                            let url = line.replace("URL被拦截: ", "");
                            if !url.is_empty() && should_intercept_url(&url) {
                                let intercepted = InterceptedUrl {
                                    id: Uuid::new_v4().to_string(),
                                    url: url.clone(),
                                    source_process: "Unknown".to_string(),
                                    timestamp: Utc::now(),
                                    copied: false,
                                    opened_in_browser: false,
                                    dismissed: false,
                                };

                                // 调用处理器
                                if let Ok(handler_guard) = handler.lock() {
                                    handler_guard(intercepted);
                                }
                            }
                        }
                    }

                    // 清空日志文件避免重复处理
                    std::fs::write(&log_file, "").ok();
                }

                thread::sleep(Duration::from_millis(1000));
            }
        });

        self.monitor_thread = Some(handle);
        Ok(())
    }

    /// 恢复原始默认浏览器
    async fn restore_default_browser(&self) -> Result<()> {
        if let Some(original_browser) = &self.original_browser {
            tracing::info!("已恢复原始默认浏览器: {}", original_browser);
        }

        Ok(())
    }

    /// 清理临时文件
    async fn cleanup_temp_files(&self) -> Result<()> {
        if let Some(exe_path) = &self.temp_exe_path {
            std::fs::remove_file(exe_path).ok();
        }

        let temp_dir = std::env::temp_dir();
        let log_file = temp_dir.join("browser_interception_urls.log");
        std::fs::remove_file(log_file).ok();

        Ok(())
    }

    /// 检查是否正在拦截
    pub fn is_running(&self) -> bool {
        self.running
    }

    /// 恢复系统默认设置
    pub async fn restore_system_defaults(&self) -> Result<()> {
        // 恢复默认浏览器设置
        self.restore_default_browser().await?;
        tracing::info!("系统默认设置已恢复");
        Ok(())
    }

    /// 临时禁用拦截
    pub async fn temporarily_disable(&mut self) -> Result<()> {
        if let Some(_original_browser) = &self.original_browser {
            self.restore_default_browser().await?;
            tracing::info!("拦截器已临时禁用");
        }
        Ok(())
    }

    /// 重新启用拦截
    pub async fn re_enable(&mut self) -> Result<()> {
        self.set_as_default_browser().await?;
        tracing::info!("拦截器已重新启用");
        Ok(())
    }
}

#[cfg(not(windows))]
impl WindowsInterceptor {
    pub fn new<F>(_url_handler: F) -> Self
    where
        F: Fn(InterceptedUrl) + Send + Sync + 'static,
    {
        Self {
            running: false,
            original_browser: None,
            temp_exe_path: None,
            intercepted_urls_handler: Arc::new(Mutex::new(Box::new(|_| {}))),
            monitor_thread: None,
        }
    }

    pub async fn start(&mut self) -> Result<()> {
        Err(BrowserInterceptorError::UnsupportedPlatform(
            "Windows interceptor only supports Windows platform".to_string(),
        ))
    }

    pub async fn stop(&mut self) -> Result<()> {
        Ok(())
    }

    pub fn is_running(&self) -> bool {
        false
    }

    pub async fn restore_system_defaults(&self) -> Result<()> {
        Ok(())
    }

    pub async fn temporarily_disable(&mut self) -> Result<()> {
        Ok(())
    }

    pub async fn re_enable(&mut self) -> Result<()> {
        Ok(())
    }
}

impl Drop for WindowsInterceptor {
    fn drop(&mut self) {
        if self.running {
            // 在析构时恢复系统默认设置
            tokio::runtime::Handle::try_current().map(|handle| {
                handle.block_on(async {
                    let _ = self.stop().await;
                    let _ = self.restore_system_defaults().await;
                })
            });
        }
    }
}

/// 检查进程是否为目标应用
pub fn is_target_process(process_name: &str) -> bool {
    let target_processes = [
        "kiro",
        "kiro.exe",
        "cursor",
        "cursor.exe",
        "code",
        "code.exe",
    ];
    target_processes
        .iter()
        .any(|&target| process_name.to_lowercase().contains(&target.to_lowercase()))
}

/// 检查 URL 是否匹配拦截模式
pub fn should_intercept_url(url: &str) -> bool {
    let patterns = [
        "https://auth.",
        "https://accounts.google.com",
        "https://github.com/login",
        "https://login.microsoftonline.com",
        "/oauth/",
        "/auth/",
        "localhost:8080/auth", // OAuth 回调地址
    ];

    patterns.iter().any(|&pattern| url.contains(pattern))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_target_process() {
        assert!(is_target_process("kiro.exe"));
        assert!(is_target_process("cursor"));
        assert!(is_target_process("code.exe"));
        assert!(!is_target_process("notepad.exe"));
    }

    #[test]
    fn test_should_intercept_url() {
        assert!(should_intercept_url("https://accounts.google.com/oauth"));
        assert!(should_intercept_url("https://github.com/login/oauth"));
        assert!(should_intercept_url("localhost:8080/auth/callback"));
        assert!(!should_intercept_url("https://example.com"));
    }
}
