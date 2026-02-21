/**
 * @file CompactModelSelector.tsx
 * @description 紧凑型模型选择器组件 - 用于 General Chat 输入栏上方
 * @module components/general-chat/chat/CompactModelSelector
 */

import React from "react";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ModelSelector } from "@/components/input-kit";

export interface CompactModelSelectorProps {
  /** 自定义类名 */
  className?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 当前 provider 类型 */
  providerType: string;
  /** 当前模型 */
  model: string;
  /** 切换 provider */
  setProviderType: (providerType: string) => void;
  /** 切换模型 */
  setModel: (model: string) => void;
  /** provider 是否可用 */
  hasAvailableProvider: boolean;
  /** provider 是否加载中 */
  isLoading?: boolean;
  /** 错误信息 */
  error?: string | null;
}

export const CompactModelSelector: React.FC<CompactModelSelectorProps> = ({
  className,
  disabled = false,
  providerType,
  model,
  setProviderType,
  setModel,
  hasAvailableProvider,
  isLoading = false,
  error = null,
}) => {

  if (!hasAvailableProvider && !isLoading) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 text-sm text-amber-600",
          className,
        )}
      >
        <AlertTriangle className="h-4 w-4" />
        <span>请先配置 Provider 凭证</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <ModelSelector
        providerType={providerType}
        setProviderType={setProviderType}
        model={model}
        setModel={setModel}
        compactTrigger
        popoverSide="top"
        disabled={disabled || isLoading}
      />
      {error && (
        <span className="inline-flex items-center gap-1 text-xs text-destructive">
          <AlertCircle size={12} />
          模型加载异常
        </span>
      )}
    </div>
  );
};

export default CompactModelSelector;
