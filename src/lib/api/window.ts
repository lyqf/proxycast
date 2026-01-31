/**
 * 窗口控制 API
 *
 * 提供窗口基本控制功能
 */

import { safeInvoke } from "@/lib/dev-bridge";

/**
 * 窗口大小
 */
export interface WindowSize {
  width: number;
  height: number;
}

/**
 * 窗口控制 API
 */
export const windowApi = {
  /**
   * 获取当前窗口大小
   */
  async getWindowSize(): Promise<WindowSize> {
    return safeInvoke("get_window_size");
  },

  /**
   * 设置窗口大小
   */
  async setWindowSize(size: WindowSize): Promise<void> {
    return safeInvoke("set_window_size", { size });
  },

  /**
   * 切换全屏模式
   */
  async toggleFullscreen(): Promise<boolean> {
    return safeInvoke("toggle_fullscreen");
  },

  /**
   * 检查是否处于全屏模式
   */
  async isFullscreen(): Promise<boolean> {
    return safeInvoke("is_fullscreen");
  },

  /**
   * 居中窗口
   */
  async centerWindow(): Promise<void> {
    return safeInvoke("center_window");
  },
};

export default windowApi;
