//! 二进制组件管理命令
//!
//! 提供 aster-server 等二进制组件的安装、卸载、更新功能

use crate::plugin::{BinaryComponentStatus, BinaryDownloader};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::fs;
use tracing::{error, info};

/// 下载进度事件
#[derive(Debug, Clone, Serialize)]
pub struct DownloadProgress {
    /// 组件名称
    pub component: String,
    /// 已下载字节数
    pub downloaded: u64,
    /// 总字节数
    pub total: u64,
    /// 下载百分比
    pub percentage: f64,
}

/// aster-server 组件配置
const ASTER_COMPONENT_NAME: &str = "aster-server";
const ASTER_GITHUB_OWNER: &str = "astercloud";
const ASTER_GITHUB_REPO: &str = "aster";
const ASTER_CHECKSUM_FILE: &str = "checksums.txt";

/// 比较版本号
fn version_compare(installed: &str, latest: &str) -> bool {
    // 简单的版本比较：移除 'v' 前缀后比较
    let installed = installed.trim_start_matches('v');
    let latest = latest.trim_start_matches('v');

    // 按 . 分割并比较每个部分
    let installed_parts: Vec<u32> = installed
        .split('.')
        .filter_map(|s| s.parse().ok())
        .collect();
    let latest_parts: Vec<u32> = latest.split('.').filter_map(|s| s.parse().ok()).collect();

    for i in 0..std::cmp::max(installed_parts.len(), latest_parts.len()) {
        let installed_part = installed_parts.get(i).unwrap_or(&0);
        let latest_part = latest_parts.get(i).unwrap_or(&0);
        if latest_part > installed_part {
            return true;
        } else if latest_part < installed_part {
            return false;
        }
    }
    false
}

/// 获取 aster-server 组件状态
#[tauri::command]
pub async fn get_aster_status() -> Result<BinaryComponentStatus, String> {
    let downloader = BinaryDownloader::new();

    // 检查本地安装状态
    let component_dir = BinaryDownloader::get_component_dir(ASTER_COMPONENT_NAME)?;
    let manifest_path = component_dir.join("manifest.json");
    let installed = manifest_path.exists();

    let (installed_version, installed_at, description) = if installed {
        // 读取本地 manifest 获取版本
        match fs::read_to_string(&manifest_path).await {
            Ok(content) => {
                let manifest: serde_json::Value =
                    serde_json::from_str(&content).unwrap_or_default();
                (
                    manifest["version"].as_str().map(|s| s.to_string()),
                    manifest["installed_at"].as_str().map(|s| s.to_string()),
                    manifest["description"].as_str().map(|s| s.to_string()),
                )
            }
            Err(_) => (None, None, None),
        }
    } else {
        (None, None, None)
    };

    // 获取最新版本（可能失败，不影响返回结果）
    let latest_version = match downloader
        .get_latest_version(ASTER_GITHUB_OWNER, ASTER_GITHUB_REPO)
        .await
    {
        Ok((version, _)) => Some(version),
        Err(e) => {
            error!("获取最新版本失败: {}", e);
            None
        }
    };

    let has_update = match (&installed_version, &latest_version) {
        (Some(installed), Some(latest)) => version_compare(installed, latest),
        _ => false,
    };

    // 获取二进制文件路径
    let binary_name = BinaryDownloader::get_platform_binary_name(ASTER_COMPONENT_NAME);
    let binary_path = if installed {
        let path = component_dir.join(&binary_name);
        if path.exists() {
            Some(path.to_string_lossy().to_string())
        } else {
            None
        }
    } else {
        None
    };

    Ok(BinaryComponentStatus {
        name: ASTER_COMPONENT_NAME.to_string(),
        installed,
        installed_version,
        latest_version,
        has_update,
        binary_path,
        installed_at,
        description: description
            .or_else(|| Some("AI Agent 框架 - 提供 Agent 对话能力".to_string())),
    })
}

/// 安装 aster-server 组件
#[tauri::command]
pub async fn install_aster(app_handle: AppHandle) -> Result<String, String> {
    info!("开始安装 aster-server");

    let downloader = BinaryDownloader::new();

    // 获取最新版本
    let (version, assets) = downloader
        .get_latest_version(ASTER_GITHUB_OWNER, ASTER_GITHUB_REPO)
        .await?;

    info!("最新版本: {}", version);

    // 获取当前平台的二进制文件名
    let binary_name = BinaryDownloader::get_platform_binary_name(ASTER_COMPONENT_NAME);
    info!("平台二进制文件名: {}", binary_name);

    // 查找对应的 asset
    let asset = assets
        .iter()
        .find(|a| a.name == binary_name)
        .ok_or_else(|| format!("未找到平台对应的二进制文件: {}", binary_name))?;

    info!("找到 asset: {} ({})", asset.name, asset.size);

    // 目标路径
    let target_dir = BinaryDownloader::get_component_dir(ASTER_COMPONENT_NAME)?;
    let target_path = target_dir.join(&binary_name);

    // 确保目录存在
    fs::create_dir_all(&target_dir)
        .await
        .map_err(|e| format!("创建目录失败: {}", e))?;

    // 下载（带进度事件）
    let app_handle_clone = app_handle.clone();
    let component_name = ASTER_COMPONENT_NAME.to_string();

    downloader
        .download_binary(
            &asset.download_url,
            &target_path,
            move |downloaded, total| {
                let progress = DownloadProgress {
                    component: component_name.clone(),
                    downloaded,
                    total,
                    percentage: if total > 0 {
                        (downloaded as f64 / total as f64) * 100.0
                    } else {
                        0.0
                    },
                };
                let _ = app_handle_clone.emit("binary-download-progress", progress);
            },
        )
        .await?;

    // 验证校验和（如果有）
    match downloader.get_checksums(&assets, ASTER_CHECKSUM_FILE).await {
        Ok(checksums) => {
            if let Some(expected_hash) = checksums.get(&binary_name) {
                info!("验证校验和: {}", expected_hash);
                if !downloader
                    .verify_checksum(&target_path, expected_hash)
                    .await?
                {
                    // 删除损坏的文件
                    let _ = fs::remove_file(&target_path).await;
                    return Err("校验和验证失败，文件可能已损坏".to_string());
                }
                info!("校验和验证通过");
            }
        }
        Err(e) => {
            // 校验文件不存在不是致命错误
            info!("跳过校验和验证: {}", e);
        }
    }

    // 创建 manifest.json
    let manifest = serde_json::json!({
        "name": ASTER_COMPONENT_NAME,
        "version": version,
        "description": "AI Agent 框架 - 提供 Agent 对话能力",
        "author": ASTER_GITHUB_OWNER,
        "homepage": format!("https://github.com/{}/{}", ASTER_GITHUB_OWNER, ASTER_GITHUB_REPO),
        "plugin_type": "binary",
        "installed_at": chrono::Utc::now().to_rfc3339(),
        "binary_name": binary_name,
    });

    fs::write(
        target_dir.join("manifest.json"),
        serde_json::to_string_pretty(&manifest).unwrap(),
    )
    .await
    .map_err(|e| format!("保存 manifest 失败: {}", e))?;

    info!("aster-server v{} 安装成功", version);
    Ok(format!("aster-server v{} 安装成功", version))
}

/// 卸载 aster-server 组件
#[tauri::command]
pub async fn uninstall_aster() -> Result<String, String> {
    info!("开始卸载 aster-server");

    let target_dir = BinaryDownloader::get_component_dir(ASTER_COMPONENT_NAME)?;

    if target_dir.exists() {
        fs::remove_dir_all(&target_dir)
            .await
            .map_err(|e| format!("删除目录失败: {}", e))?;
        info!("aster-server 已卸载");
    } else {
        info!("aster-server 未安装");
    }

    Ok("aster-server 已卸载".to_string())
}

/// 检查 aster-server 更新
#[tauri::command]
pub async fn check_aster_update() -> Result<BinaryComponentStatus, String> {
    get_aster_status().await
}

/// 更新 aster-server 组件
#[tauri::command]
pub async fn update_aster(app_handle: AppHandle) -> Result<String, String> {
    info!("开始更新 aster-server");

    // 先卸载旧版本
    uninstall_aster().await?;

    // 安装新版本
    install_aster(app_handle).await
}

/// 获取 aster-server 二进制文件路径
#[tauri::command]
pub fn get_aster_binary_path() -> Result<String, String> {
    let component_dir = BinaryDownloader::get_component_dir(ASTER_COMPONENT_NAME)?;
    let binary_name = BinaryDownloader::get_platform_binary_name(ASTER_COMPONENT_NAME);
    let binary_path = component_dir.join(&binary_name);

    if binary_path.exists() {
        Ok(binary_path.to_string_lossy().to_string())
    } else {
        Err("aster-server 未安装".to_string())
    }
}

/// 检查 aster-server 是否已安装
#[tauri::command]
pub fn is_aster_installed() -> bool {
    let component_dir = match BinaryDownloader::get_component_dir(ASTER_COMPONENT_NAME) {
        Ok(dir) => dir,
        Err(_) => return false,
    };

    let binary_name = BinaryDownloader::get_platform_binary_name(ASTER_COMPONENT_NAME);
    let binary_path = component_dir.join(&binary_name);

    binary_path.exists()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_compare() {
        assert!(version_compare("0.34.0", "0.35.0"));
        assert!(version_compare("v0.34.0", "v0.35.0"));
        assert!(!version_compare("0.35.0", "0.34.0"));
        assert!(!version_compare("0.35.0", "0.35.0"));
        assert!(version_compare("1.0.0", "1.0.1"));
        assert!(version_compare("1.0.0", "1.1.0"));
        assert!(version_compare("1.0.0", "2.0.0"));
    }
}
