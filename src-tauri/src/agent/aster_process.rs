//! aster 子进程生命周期管理
//!
//! 支持两种启动方式：
//! 1. Tauri Sidecar（打包在应用中）
//! 2. Plugin 目录（按需下载）

use parking_lot::RwLock;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;
use tokio::time::{sleep, timeout};
use tracing::{error, info, warn};

/// aster 进程管理器
pub struct AsterProcess {
    /// 子进程句柄（Sidecar 模式）
    child: Arc<RwLock<Option<CommandChild>>>,
    /// 标准进程句柄（Plugin 模式）
    std_child: Arc<RwLock<Option<std::process::Child>>>,
    /// aster 服务基础 URL
    base_url: String,
    /// aster 服务端口
    port: u16,
}

impl AsterProcess {
    /// 获取 aster-server 二进制文件路径（从 plugin 目录）
    pub fn get_binary_path() -> Result<PathBuf, String> {
        let plugins_dir = dirs::config_dir()
            .ok_or("无法获取配置目录")?
            .join("proxycast")
            .join("plugins")
            .join("aster-server");

        let platform_binary = match (std::env::consts::ARCH, std::env::consts::OS) {
            ("aarch64", "macos") => "aster-server-aarch64-apple-darwin",
            ("x86_64", "macos") => "aster-server-x86_64-apple-darwin",
            ("x86_64", "linux") => "aster-server-x86_64-unknown-linux-gnu",
            ("aarch64", "linux") => "aster-server-aarch64-unknown-linux-gnu",
            ("x86_64", "windows") => "aster-server-x86_64-pc-windows-msvc.exe",
            _ => return Err("不支持的平台".to_string()),
        };

        let binary_path = plugins_dir.join(platform_binary);

        if !binary_path.exists() {
            return Err("aster-server 未安装，请先在扩展页面下载安装".to_string());
        }

        Ok(binary_path)
    }

    /// 检查 aster-server 是否已安装（在 plugin 目录）
    pub fn is_installed() -> bool {
        Self::get_binary_path().is_ok()
    }

    /// 从 plugin 目录启动 aster 进程
    ///
    /// # 参数
    ///
    /// - `port`: aster 服务监听端口
    ///
    /// # 返回
    ///
    /// 成功返回 `AsterProcess` 实例，失败返回错误信息
    pub async fn start_from_plugin(port: u16) -> Result<Self, String> {
        println!("[DEBUG] AsterProcess::start_from_plugin() 开始");
        println!("[DEBUG] port: {}", port);

        info!("从 plugin 目录启动 aster 进程: port={}", port);

        // 获取二进制文件路径
        let binary_path = Self::get_binary_path()?;
        let work_dir = binary_path
            .parent()
            .ok_or("无法获取工作目录")?
            .to_path_buf();

        println!("[DEBUG] 二进制文件路径: {:?}", binary_path);
        println!("[DEBUG] 工作目录: {:?}", work_dir);

        // 检查端口是否被占用，如果被占用则尝试清理
        if Self::is_port_in_use(port).await {
            println!("[DEBUG] 端口 {} 被占用，尝试清理...", port);
            warn!("端口 {} 已被占用，尝试清理旧进程...", port);
            Self::kill_process_on_port(port).await?;
            // 等待端口释放
            sleep(Duration::from_secs(2)).await;
        } else {
            println!("[DEBUG] 端口 {} 空闲", port);
        }

        // 使用 std::process::Command 启动进程
        println!("[DEBUG] 准备启动进程...");

        let child = std::process::Command::new(&binary_path)
            .current_dir(&work_dir)
            .env("PORT", port.to_string())
            .env("GIN_MODE", "release")
            .env("ASTER_SLASH_COMMANDS", "true")
            .env("ENABLE_SLASH_COMMANDS", "true")
            .env("ANTHROPIC_API_KEY", "placeholder-key-for-compressor")
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("启动进程失败: {}", e))?;

        println!("[DEBUG] 进程已启动, PID: {}", child.id());
        info!("aster 进程已启动, PID: {}", child.id());

        let process = Self {
            child: Arc::new(RwLock::new(None)),
            std_child: Arc::new(RwLock::new(Some(child))),
            base_url: format!("http://127.0.0.1:{}", port),
            port,
        };

        // 等待 6 秒让 aster 初始化
        println!("[DEBUG] 等待 6 秒让 aster 初始化...");
        info!("等待 6 秒让 aster 进程初始化...");
        sleep(Duration::from_secs(6)).await;

        // 等待健康检查通过
        println!("[DEBUG] 开始健康检查...");
        process.wait_for_health_check(60).await?;

        println!("[DEBUG] 启动成功！");
        info!("aster 进程启动成功，服务地址: {}", process.base_url);
        Ok(process)
    }

    /// 使用 Tauri Sidecar 启动 aster 子进程
    ///
    /// # 参数
    ///
    /// - `app_handle`: Tauri AppHandle
    /// - `port`: aster 服务监听端口
    ///
    /// # 返回
    ///
    /// 成功返回 `AsterProcess` 实例，失败返回错误信息
    pub async fn start_with_sidecar(app_handle: &AppHandle, port: u16) -> Result<Self, String> {
        println!("[DEBUG] AsterProcess::start_with_sidecar() 开始");
        println!("[DEBUG] port: {}", port);

        info!("启动 aster sidecar 子进程: port={}", port);

        // 检查端口是否被占用，如果被占用则尝试清理
        if Self::is_port_in_use(port).await {
            println!("[DEBUG] 端口 {} 被占用，尝试清理...", port);
            warn!("端口 {} 已被占用，尝试清理旧进程...", port);
            Self::kill_process_on_port(port).await?;
            // 等待端口释放
            sleep(Duration::from_secs(2)).await;
        } else {
            println!("[DEBUG] 端口 {} 空闲", port);
        }

        // 使用 Tauri sidecar API 启动进程
        println!("[DEBUG] 准备启动 sidecar...");

        // 获取 sidecar 二进制文件的目录作为工作目录
        // aster 需要在其二进制文件所在目录运行，以访问 .data 目录
        //
        // 在开发模式下，sidecar 是符号链接，我们需要解析到实际目录
        // 在生产模式下，sidecar 在 resources/binaries 目录
        let work_dir = {
            // 获取 target triple (编译时确定)
            let target = std::env::consts::ARCH.to_string() + "-" + std::env::consts::OS;
            let target = match (std::env::consts::ARCH, std::env::consts::OS) {
                ("aarch64", "macos") => "aarch64-apple-darwin",
                ("x86_64", "macos") => "x86_64-apple-darwin",
                ("x86_64", "linux") => "x86_64-unknown-linux-gnu",
                ("aarch64", "linux") => "aarch64-unknown-linux-gnu",
                ("x86_64", "windows") => "x86_64-pc-windows-msvc",
                _ => "unknown",
            };

            let sidecar_filename = format!("aster-server-{}", target);

            // 尝试从资源目录获取
            let resource_dir = app_handle
                .path()
                .resource_dir()
                .map_err(|e| format!("获取资源目录失败: {}", e))?;

            let sidecar_path = resource_dir.join("binaries").join(&sidecar_filename);
            println!("[DEBUG] 尝试 sidecar 路径: {:?}", sidecar_path);

            if sidecar_path.exists() {
                // 如果是符号链接，解析到实际路径
                let real_path = std::fs::canonicalize(&sidecar_path)
                    .map_err(|e| format!("解析 sidecar 路径失败: {}", e))?;
                println!("[DEBUG] 实际 sidecar 路径: {:?}", real_path);

                // 获取父目录作为工作目录
                real_path
                    .parent()
                    .map(|p| p.to_path_buf())
                    .unwrap_or_else(|| resource_dir.join("binaries"))
            } else {
                // 开发模式下，尝试从 src-tauri/binaries 目录
                let dev_sidecar_path = std::env::current_dir()
                    .unwrap_or_default()
                    .join("binaries")
                    .join(&sidecar_filename);

                println!("[DEBUG] 尝试开发模式 sidecar 路径: {:?}", dev_sidecar_path);

                if dev_sidecar_path.exists() {
                    let real_path = std::fs::canonicalize(&dev_sidecar_path)
                        .map_err(|e| format!("解析开发模式 sidecar 路径失败: {}", e))?;
                    real_path
                        .parent()
                        .map(|p| p.to_path_buf())
                        .unwrap_or_else(|| std::env::current_dir().unwrap_or_default())
                } else {
                    // 最后回退到当前目录
                    std::env::current_dir().unwrap_or_default()
                }
            }
        };

        println!("[DEBUG] 工作目录: {:?}", work_dir);

        let sidecar_command = app_handle
            .shell()
            .sidecar("aster-server")
            .map_err(|e| format!("获取 sidecar 命令失败: {}", e))?
            .current_dir(&work_dir)
            .env("PORT", port.to_string())
            .env("GIN_MODE", "release")
            // 启用 slash commands 功能
            .env("ASTER_SLASH_COMMANDS", "true")
            .env("ENABLE_SLASH_COMMANDS", "true")
            // 设置一个虚拟的 ANTHROPIC_API_KEY 以避免 aster 的 prompt compressor panic
            // 实际的 API Key 会在创建 agent 时通过 model_config 传递
            .env("ANTHROPIC_API_KEY", "placeholder-key-for-compressor");

        let (mut rx, child) = sidecar_command
            .spawn()
            .map_err(|e| format!("启动 sidecar 进程失败: {}", e))?;

        println!("[DEBUG] Sidecar 进程已启动");
        info!("aster sidecar 进程已启动");

        // 在后台任务中处理进程输出
        tauri::async_runtime::spawn(async move {
            use tauri_plugin_shell::process::CommandEvent;
            while let Some(event) = rx.recv().await {
                match event {
                    CommandEvent::Stdout(line) => {
                        let line_str = String::from_utf8_lossy(&line);
                        // 打印所有日志以便调试
                        println!("[aster stdout] {}", line_str.trim());
                    }
                    CommandEvent::Stderr(line) => {
                        let line_str = String::from_utf8_lossy(&line);
                        println!("[aster stderr] {}", line_str.trim());
                    }
                    CommandEvent::Terminated(payload) => {
                        println!(
                            "[aster] 进程已终止: code={:?}, signal={:?}",
                            payload.code, payload.signal
                        );
                        break;
                    }
                    _ => {}
                }
            }
        });

        let process = Self {
            child: Arc::new(RwLock::new(Some(child))),
            std_child: Arc::new(RwLock::new(None)),
            base_url: format!("http://127.0.0.1:{}", port),
            port,
        };

        // 等待 6 秒让 aster 初始化（aster 启动需要较长时间）
        println!("[DEBUG] 等待 6 秒让 aster 初始化...");
        info!("等待 6 秒让 aster 进程初始化...");
        sleep(Duration::from_secs(6)).await;

        // 等待健康检查通过（增加到 60 秒，因为 aster 启动需要时间）
        println!("[DEBUG] 开始健康检查...");
        process.wait_for_health_check(60).await?;

        println!("[DEBUG] 启动成功！");
        info!("aster sidecar 进程启动成功，服务地址: {}", process.base_url);
        Ok(process)
    }

    /// 检查端口是否被占用
    async fn is_port_in_use(port: u16) -> bool {
        use std::net::TcpListener;
        TcpListener::bind(format!("127.0.0.1:{}", port)).is_err()
    }

    /// 杀死占用指定端口的进程
    #[cfg(target_os = "macos")]
    async fn kill_process_on_port(port: u16) -> Result<(), String> {
        use std::process::Command as StdCommand;

        // 使用 lsof 查找占用端口的进程
        let output = StdCommand::new("lsof")
            .args(["-ti", &format!(":{}", port)])
            .output()
            .map_err(|e| format!("执行 lsof 失败: {}", e))?;

        if output.status.success() {
            let pids = String::from_utf8_lossy(&output.stdout);
            for pid_str in pids.lines() {
                if let Ok(pid) = pid_str.trim().parse::<i32>() {
                    info!("杀死占用端口 {} 的进程 PID: {}", port, pid);
                    let _ = StdCommand::new("kill")
                        .args(["-9", &pid.to_string()])
                        .output();
                }
            }
        }

        Ok(())
    }

    /// 杀死占用指定端口的进程（Linux）
    #[cfg(target_os = "linux")]
    async fn kill_process_on_port(port: u16) -> Result<(), String> {
        use std::process::Command as StdCommand;

        // 使用 fuser 查找占用端口的进程
        let output = StdCommand::new("fuser")
            .args(["-k", &format!("{}/tcp", port)])
            .output()
            .map_err(|e| format!("执行 fuser 失败: {}", e))?;

        if !output.status.success() {
            warn!("fuser 执行失败，可能没有找到占用端口的进程");
        }

        Ok(())
    }

    /// 杀死占用指定端口的进程（Windows）
    #[cfg(target_os = "windows")]
    async fn kill_process_on_port(port: u16) -> Result<(), String> {
        use std::process::Command as StdCommand;

        // 使用 netstat 查找占用端口的进程
        let output = StdCommand::new("netstat")
            .args(["-ano"])
            .output()
            .map_err(|e| format!("执行 netstat 失败: {}", e))?;

        if output.status.success() {
            let output_str = String::from_utf8_lossy(&output.stdout);
            for line in output_str.lines() {
                if line.contains(&format!(":{}", port)) && line.contains("LISTENING") {
                    if let Some(pid_str) = line.split_whitespace().last() {
                        if let Ok(pid) = pid_str.parse::<u32>() {
                            info!("杀死占用端口 {} 的进程 PID: {}", port, pid);
                            let _ = StdCommand::new("taskkill")
                                .args(["/F", "/PID", &pid.to_string()])
                                .output();
                        }
                    }
                }
            }
        }

        Ok(())
    }

    /// 等待 aster 服务健康检查通过
    ///
    /// # 参数
    ///
    /// - `timeout_seconds`: 超时时间（秒）
    async fn wait_for_health_check(&self, timeout_seconds: u64) -> Result<(), String> {
        let health_url = format!("{}/health", self.base_url);
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(10)) // 增加单次请求超时到 10 秒
            .connect_timeout(Duration::from_secs(5)) // 连接超时 5 秒
            .no_proxy() // 禁用系统代理，直接连接 localhost
            .build()
            .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

        println!("[DEBUG] 健康检查 URL: {}", health_url);
        info!("等待 aster 服务就绪，健康检查 URL: {}", health_url);

        let result = timeout(Duration::from_secs(timeout_seconds), async {
            let mut attempt = 0;
            loop {
                attempt += 1;
                println!("[DEBUG] 健康检查尝试 #{}", attempt);
                info!("健康检查尝试 #{}: {}", attempt, health_url);

                match client.get(&health_url).send().await {
                    Ok(response) if response.status().is_success() => {
                        println!("[DEBUG] ✓ 健康检查通过（尝试 {} 次）", attempt);
                        info!("✓ aster 服务健康检查通过（尝试 {} 次）", attempt);
                        return Ok(());
                    }
                    Ok(response) => {
                        let status = response.status();
                        let body = response.text().await.unwrap_or_default();
                        println!("[DEBUG] ✗ 非成功状态: {} - {}", status, body);
                        warn!("健康检查返回非成功状态: {} - {}", status, body);
                    }
                    Err(e) => {
                        println!("[DEBUG] ✗ 请求失败: {}", e);
                        warn!("健康检查失败（尝试 #{}）: {}, 2秒后重试...", attempt, e);
                    }
                }
                sleep(Duration::from_secs(2)).await;
            }
        })
        .await;

        match result {
            Ok(Ok(())) => Ok(()),
            Ok(Err(e)) => Err(e),
            Err(_) => Err(format!(
                "aster 服务启动超时（{}秒），健康检查未通过",
                timeout_seconds
            )),
        }
    }

    /// 停止 aster 进程
    pub async fn stop(&self) -> Result<(), String> {
        // 先尝试停止 Sidecar 模式的进程
        let mut child_guard = self.child.write();
        if let Some(child) = child_guard.take() {
            info!("停止 aster sidecar 进程");
            match child.kill() {
                Ok(_) => {
                    info!("aster sidecar 进程已发送终止信号");
                    return Ok(());
                }
                Err(e) => {
                    error!("终止 aster sidecar 进程失败: {}", e);
                    return Err(format!("终止进程失败: {}", e));
                }
            }
        }
        drop(child_guard);

        // 再尝试停止 Plugin 模式的进程
        let mut std_child_guard = self.std_child.write();
        if let Some(mut child) = std_child_guard.take() {
            info!("停止 aster plugin 进程");
            match child.kill() {
                Ok(_) => {
                    info!("aster plugin 进程已发送终止信号");
                    return Ok(());
                }
                Err(e) => {
                    error!("终止 aster plugin 进程失败: {}", e);
                    return Err(format!("终止进程失败: {}", e));
                }
            }
        }

        warn!("aster 进程未运行");
        Ok(())
    }

    /// 检查 aster 进程是否正在运行
    pub fn is_running(&self) -> bool {
        let child_guard = self.child.read();
        let std_child_guard = self.std_child.read();
        child_guard.is_some() || std_child_guard.is_some()
    }

    /// 获取 aster 服务基础 URL
    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    /// 获取 aster 服务端口
    pub fn port(&self) -> u16 {
        self.port
    }
}

impl Drop for AsterProcess {
    fn drop(&mut self) {
        // 确保进程在对象销毁时被终止
        let mut child_guard = self.child.write();
        if let Some(child) = child_guard.take() {
            warn!("AsterProcess 被销毁，终止 aster sidecar 进程");
            let _ = child.kill();
        }
        drop(child_guard);

        let mut std_child_guard = self.std_child.write();
        if let Some(mut child) = std_child_guard.take() {
            warn!("AsterProcess 被销毁，终止 aster plugin 进程");
            let _ = child.kill();
        }
    }
}

/// Tauri 状态：aster 进程管理器
///
/// 用于在 Tauri 应用中共享 AsterProcess 实例
#[derive(Clone)]
pub struct AsterProcessState(pub Arc<RwLock<Option<AsterProcess>>>);

impl AsterProcessState {
    /// 创建新的空状态
    pub fn new() -> Self {
        Self(Arc::new(RwLock::new(None)))
    }

    /// 设置 AsterProcess 实例
    pub fn set(&self, process: AsterProcess) {
        let mut guard = self.0.write();
        *guard = Some(process);
    }

    /// 获取 AsterProcess 的只读引用
    pub fn get(&self) -> Option<parking_lot::RwLockReadGuard<'_, Option<AsterProcess>>> {
        let guard = self.0.read();
        if guard.is_some() {
            Some(guard)
        } else {
            None
        }
    }

    /// 停止 aster 进程并清除状态
    pub async fn stop(&self) -> Result<(), String> {
        // 先从锁中取出 process，避免跨 await 持有锁
        let process = {
            let mut guard = self.0.write();
            guard.take()
        };

        if let Some(process) = process {
            process.stop().await
        } else {
            Ok(())
        }
    }

    /// 检查 aster 进程是否正在运行
    pub fn is_running(&self) -> bool {
        let guard = self.0.read();
        guard.as_ref().map(|p| p.is_running()).unwrap_or(false)
    }
}

impl Default for AsterProcessState {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_aster_process_state_new() {
        let state = AsterProcessState::new();
        assert!(!state.is_running());
    }

    #[test]
    fn test_base_url_format() {
        // 测试 URL 格式
        let port = 8081;
        let expected_url = "http://127.0.0.1:8081";
        let url = format!("http://127.0.0.1:{}", port);
        assert_eq!(url, expected_url);
    }
}
