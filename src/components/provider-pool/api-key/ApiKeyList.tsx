/**
 * @file ApiKeyList 组件
 * @description API Key 列表组件，显示 Provider 的所有 API Key，支持添加新 API Key
 * @module components/provider-pool/api-key/ApiKeyList
 *
 * **Feature: provider-ui-refactor**
 * **Validates: Requirements 7.1**
 */

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiKeyItem } from "./ApiKeyItem";
import type { ApiKeyDisplay } from "@/lib/api/apiKeyProvider";

// ============================================================================
// 图标组件
// ============================================================================

const PlusIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className={cn("w-4 h-4", className)}
  >
    <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
  </svg>
);

const EyeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className={cn("w-4 h-4", className)}
  >
    <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
    <path
      fillRule="evenodd"
      d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
      clipRule="evenodd"
    />
  </svg>
);

const EyeSlashIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className={cn("w-4 h-4", className)}
  >
    <path
      fillRule="evenodd"
      d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.092 1.092a2.5 2.5 0 013.374 3.373l1.091 1.092a4 4 0 00-5.557-5.557z"
      clipRule="evenodd"
    />
    <path d="M10.748 13.93l2.523 2.523a9.987 9.987 0 01-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 010-1.186A10.007 10.007 0 012.839 6.02L6.07 9.252a4 4 0 004.678 4.678z" />
  </svg>
);

// ============================================================================
// 类型定义
// ============================================================================

export interface ApiKeyListProps {
  /** API Key 列表 */
  apiKeys: ApiKeyDisplay[];
  /** Provider ID */
  providerId: string;
  /** 添加 API Key 回调 */
  onAdd?: (providerId: string, apiKey: string, alias?: string) => Promise<void>;
  /** 切换 API Key 启用状态回调 */
  onToggle?: (keyId: string, enabled: boolean) => void;
  /** 删除 API Key 回调 */
  onDelete?: (keyId: string) => void;
  /** 是否正在加载 */
  loading?: boolean;
  /** 额外的 CSS 类名 */
  className?: string;
}

// ============================================================================
// 组件实现
// ============================================================================

/**
 * API Key 列表组件
 *
 * 显示 Provider 的所有 API Key，并提供添加新 API Key 的功能。
 *
 * @example
 * ```tsx
 * <ApiKeyList
 *   apiKeys={provider.api_keys}
 *   providerId={provider.id}
 *   onAdd={addApiKey}
 *   onToggle={toggleApiKey}
 *   onDelete={deleteApiKey}
 * />
 * ```
 */
export const ApiKeyList: React.FC<ApiKeyListProps> = ({
  apiKeys,
  providerId,
  onAdd,
  onToggle,
  onDelete,
  loading = false,
  className,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newApiKey, setNewApiKey] = useState("");
  const [newAlias, setNewAlias] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 监听 apiKeys 变化，用于调试
  React.useEffect(() => {
    console.log(
      `[ApiKeyList] 组件更新: providerId=${providerId}, apiKeys.length=${apiKeys.length}`,
    );
    apiKeys.forEach((k, i) => {
      console.log(
        `[ApiKeyList]   [${i}] id=${k.id}, masked=${k.api_key_masked}`,
      );
    });
  }, [apiKeys, providerId]);

  // 监听 providerId 变化
  React.useEffect(() => {
    console.log(`[ApiKeyList] providerId 变化: ${providerId}`);
  }, [providerId]);

  const handleAdd = async () => {
    if (!newApiKey.trim()) {
      setError("请输入 API Key");
      return;
    }

    setIsAdding(true);
    setError(null);

    try {
      console.log("[ApiKeyList] 开始添加 API Key:", {
        providerId,
        alias: newAlias.trim() || undefined,
        apiKeyLength: newApiKey.trim().length,
      });
      await onAdd?.(providerId, newApiKey.trim(), newAlias.trim() || undefined);
      console.log(
        "[ApiKeyList] API Key 添加成功，当前 apiKeys:",
        apiKeys.length,
      );

      // 重置表单
      setNewApiKey("");
      setNewAlias("");
      setShowAddForm(false);
      setShowApiKey(false);
    } catch (e) {
      console.error("[ApiKeyList] API Key 添加失败:", e);
      setError(e instanceof Error ? e.message : "添加失败");
    } finally {
      setIsAdding(false);
    }
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setNewApiKey("");
    setNewAlias("");
    setShowApiKey(false);
    setError(null);
  };

  return (
    <div className={cn("space-y-3", className)} data-testid="api-key-list">
      {/* 标题和添加按钮 */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">
          API Keys ({apiKeys.length})
        </h4>
        {!showAddForm && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(true)}
            disabled={loading}
            data-testid="add-api-key-button"
          >
            <PlusIcon className="mr-1" />
            添加
          </Button>
        )}
      </div>

      {/* 添加表单 */}
      {showAddForm && (
        <div
          className="p-3 rounded-lg border border-border bg-muted/20 space-y-3"
          data-testid="add-api-key-form"
        >
          {/* API Key 输入 */}
          <div className="space-y-1.5">
            <Label htmlFor="new-api-key" className="text-xs">
              API Key <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="new-api-key"
                type={showApiKey ? "text" : "password"}
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                placeholder="输入 API Key"
                className="pr-10"
                disabled={isAdding}
                data-testid="new-api-key-input"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowApiKey(!showApiKey)}
                tabIndex={-1}
              >
                {showApiKey ? <EyeSlashIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          {/* 别名输入 */}
          <div className="space-y-1.5">
            <Label htmlFor="new-alias" className="text-xs">
              别名（可选）
            </Label>
            <Input
              id="new-alias"
              type="text"
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
              placeholder="例如：主账号、测试账号"
              disabled={isAdding}
              data-testid="new-alias-input"
            />
          </div>

          {/* 错误提示 */}
          {error && (
            <p className="text-xs text-red-500" data-testid="add-error">
              {error}
            </p>
          )}

          {/* 操作按钮 */}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isAdding}
            >
              取消
            </Button>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={isAdding || !newApiKey.trim()}
              data-testid="confirm-add-button"
            >
              {isAdding ? "添加中..." : "确认添加"}
            </Button>
          </div>
        </div>
      )}

      {/* API Key 列表 */}
      {apiKeys.length > 0 ? (
        <div className="space-y-2" data-testid="api-key-items">
          {apiKeys.map((apiKey) => (
            <ApiKeyItem
              key={apiKey.id}
              apiKey={apiKey}
              onToggle={onToggle}
              onDelete={onDelete}
              loading={loading}
            />
          ))}
        </div>
      ) : (
        !showAddForm && (
          <div
            className="py-8 text-center text-sm text-muted-foreground"
            data-testid="empty-state"
          >
            <p>暂无 API Key</p>
            <p className="mt-1 text-xs">
              点击上方「添加」按钮添加第一个 API Key
            </p>
          </div>
        )
      )}
    </div>
  );
};

// ============================================================================
// 辅助函数（用于测试）
// ============================================================================

/**
 * 获取 API Key 列表的统计信息
 * 用于属性测试验证
 */
export function getApiKeyListStats(apiKeys: ApiKeyDisplay[]): {
  total: number;
  enabled: number;
  disabled: number;
  totalUsage: number;
  totalErrors: number;
} {
  return {
    total: apiKeys.length,
    enabled: apiKeys.filter((k) => k.enabled).length,
    disabled: apiKeys.filter((k) => !k.enabled).length,
    totalUsage: apiKeys.reduce((sum, k) => sum + k.usage_count, 0),
    totalErrors: apiKeys.reduce((sum, k) => sum + k.error_count, 0),
  };
}

export default ApiKeyList;
