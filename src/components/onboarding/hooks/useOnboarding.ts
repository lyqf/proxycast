/**
 * 初次安装引导 - 状态管理 Hook
 */

import { useState, useEffect, useCallback } from "react";
import {
  STORAGE_KEYS,
  ONBOARDING_VERSION,
  type UserProfile,
} from "../constants";

/**
 * 引导状态 Hook
 *
 * 管理首次启动检测和引导完成状态
 */
export function useOnboardingState() {
  // null 表示正在检测中
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    // 检测是否需要显示引导
    const isComplete =
      localStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETE) === "true";
    const version = localStorage.getItem(STORAGE_KEYS.ONBOARDING_VERSION);

    // 首次启动或版本升级时显示引导
    setNeedsOnboarding(!isComplete || version !== ONBOARDING_VERSION);
  }, []);

  /**
   * 完成引导
   */
  const completeOnboarding = useCallback((userProfile?: UserProfile) => {
    localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, "true");
    localStorage.setItem(STORAGE_KEYS.ONBOARDING_VERSION, ONBOARDING_VERSION);
    if (userProfile) {
      localStorage.setItem(STORAGE_KEYS.USER_PROFILE, userProfile);
    }
    setNeedsOnboarding(false);
  }, []);

  /**
   * 重置引导（用于设置页面"重新运行引导"）
   */
  const resetOnboarding = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.ONBOARDING_COMPLETE);
    localStorage.removeItem(STORAGE_KEYS.ONBOARDING_VERSION);
    localStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
    setNeedsOnboarding(true);
  }, []);

  /**
   * 获取保存的用户群体
   */
  const getSavedUserProfile = useCallback((): UserProfile | null => {
    const saved = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    if (saved === "developer" || saved === "general") {
      return saved;
    }
    return null;
  }, []);

  return {
    needsOnboarding,
    completeOnboarding,
    resetOnboarding,
    getSavedUserProfile,
  };
}
