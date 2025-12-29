/**
 * 二进制组件管理 API
 *
 * 提供 aster-server 等二进制组件的安装、卸载、更新功能
 */

import { invoke } from "@tauri-apps/api/core";

/**
 * 二进制组件状态
 */
export interface BinaryComponentStatus {
  /** 组件名称 */
  name: string;
  /** 是否已安装 */
  installed: boolean;
  /** 已安装版本 */
  installed_version: string | null;
  /** 最新可用版本 */
  latest_version: string | null;
  /** 是否有更新 */
  has_update: boolean;
  /** 二进制文件路径 */
  binary_path: string | null;
  /** 安装时间 */
  installed_at: string | null;
  /** 描述 */
  description: string | null;
}

/**
 * 下载进度事件
 */
export interface DownloadProgress {
  /** 组件名称 */
  component: string;
  /** 已下载字节数 */
  downloaded: number;
  /** 总字节数 */
  total: number;
  /** 下载百分比 */
  percentage: number;
}

/**
 * 获取 aster-server 组件状态
 */
export async function getAsterStatus(): Promise<BinaryComponentStatus> {
  return invoke<BinaryComponentStatus>("get_aster_status");
}

/**
 * 安装 aster-server 组件
 */
export async function installAster(): Promise<string> {
  return invoke<string>("install_aster");
}

/**
 * 卸载 aster-server 组件
 */
export async function uninstallAster(): Promise<string> {
  return invoke<string>("uninstall_aster");
}

/**
 * 检查 aster-server 更新
 */
export async function checkAsterUpdate(): Promise<BinaryComponentStatus> {
  return invoke<BinaryComponentStatus>("check_aster_update");
}

/**
 * 更新 aster-server 组件
 */
export async function updateAster(): Promise<string> {
  return invoke<string>("update_aster");
}

/**
 * 获取 aster-server 二进制文件路径
 */
export async function getAsterBinaryPath(): Promise<string> {
  return invoke<string>("get_aster_binary_path");
}

/**
 * 检查 aster-server 是否已安装
 */
export async function isAsterInstalled(): Promise<boolean> {
  return invoke<boolean>("is_aster_installed");
}
