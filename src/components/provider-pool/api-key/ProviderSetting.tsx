/**
 * @file ProviderSetting 组件
 * @description Provider 设置面板组件，集成所有子组件，显示 Provider 头部信息和配置
 * @module components/provider-pool/api-key/ProviderSetting
 *
 * **Feature: provider-ui-refactor**
 * **Validates: Requirements 4.1, 6.3, 6.4**
 */

import React from "react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { ProviderIcon } from "@/icons/providers";
import { ApiKeyList } from "./ApiKeyList";
import { ProviderConfigForm } from "./ProviderConfigForm";
import {
  ConnectionTestButton,
  ConnectionTestResult,
} from "./ConnectionTestButton";
import { ProviderModelList } from "./ProviderModelList";
import type {
  ProviderWithKeysDisplay,
  UpdateProviderRequest,
} from "@/lib/api/apiKeyProvider";

// ============================================================================
// 类型定义
// ============================================================================

export interface ProviderSettingProps {
  /** Provider 数据（包含 API Keys） */
  provider: ProviderWithKeysDisplay | null;
  /** 更新 Provider 配置回调 */
  onUpdate?: (id: string, request: UpdateProviderRequest) => Promise<void>;
  /** 添加 API Key 回调 */
  onAddApiKey?: (
    providerId: string,
    apiKey: string,
    alias?: string,
  ) => Promise<void>;
  /** 删除 API Key 回调 */
  onDeleteApiKey?: (keyId: string) => void;
  /** 切换 API Key 启用状态回调 */
  onToggleApiKey?: (keyId: string, enabled: boolean) => void;
  /** 测试连接回调 */
  onTestConnection?: (providerId: string) => Promise<ConnectionTestResult>;
  /** 删除自定义 Provider 回调 */
  onDeleteProvider?: (providerId: string) => void;
  /** 是否正在加载 */
  loading?: boolean;
  /** 额外的 CSS 类名 */
  className?: string;
}

// ============================================================================
// 组件实现
// ============================================================================

/**
 * Provider 设置面板组件
 *
 * 显示选中 Provider 的完整配置界面，包括：
 * - Provider 头部信息（图标、名称、启用开关）
 * - API Key 列表
 * - Provider 配置表单
 * - 连接测试按钮
 *
 * @example
 * ```tsx
 * <ProviderSetting
 *   provider={selectedProvider}
 *   onUpdate={updateProvider}
 *   onAddApiKey={addApiKey}
 *   onDeleteApiKey={deleteApiKey}
 *   onToggleApiKey={toggleApiKey}
 *   onTestConnection={testConnection}
 * />
 * ```
 */
export const ProviderSetting: React.FC<ProviderSettingProps> = ({
  provider,
  onUpdate,
  onAddApiKey,
  onDeleteApiKey,
  onToggleApiKey,
  onTestConnection,
  onDeleteProvider,
  loading = false,
  className,
}) => {
  // 空状态
  if (!provider) {
    return (
      <div
        className={cn(
          "flex items-center justify-center h-full text-muted-foreground",
          className,
        )}
        data-testid="provider-setting-empty"
      >
        <div className="text-center">
          <p className="text-sm">请从左侧列表选择一个 Provider</p>
          <p className="text-xs mt-1">选择后可在此处配置 API Key 和其他设置</p>
        </div>
      </div>
    );
  }

  // 处理启用/禁用切换
  const handleToggleEnabled = async (enabled: boolean) => {
    if (onUpdate) {
      await onUpdate(provider.id, { enabled });
    }
  };

  return (
    <div
      className={cn("flex flex-col h-full", className)}
      data-testid="provider-setting"
      data-provider-id={provider.id}
    >
      {/* Provider 头部 */}
      <div
        className="flex items-center gap-4 p-4 border-b border-border"
        data-testid="provider-header"
      >
        {/* 图标 */}
        <ProviderIcon
          providerType={provider.id}
          size={40}
          className="flex-shrink-0"
          data-testid="provider-icon"
        />

        {/* 名称和类型 */}
        <div className="flex-1 min-w-0">
          <h3
            className="text-lg font-semibold truncate"
            data-testid="provider-name"
          >
            {provider.name}
          </h3>
          <p
            className="text-sm text-muted-foreground"
            data-testid="provider-type"
          >
            类型: {provider.type}
            {provider.is_system && (
              <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                系统预设
              </span>
            )}
          </p>
        </div>

        {/* 启用开关 */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {provider.enabled ? "已启用" : "已禁用"}
          </span>
          <Switch
            checked={provider.enabled}
            onCheckedChange={handleToggleEnabled}
            disabled={loading}
            data-testid="provider-enabled-switch"
          />
        </div>

        {/* 删除按钮（仅自定义 Provider） */}
        {!provider.is_system && onDeleteProvider && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDeleteProvider(provider.id)}
            disabled={loading}
            className="text-muted-foreground hover:text-red-600 hover:bg-red-50"
            title="删除此 Provider"
            data-testid="delete-provider-button"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* API Key 列表 */}
        <section data-testid="api-key-section">
          <ApiKeyList
            key={`${provider.id}-${provider.api_keys?.length || 0}`}
            apiKeys={provider.api_keys || []}
            providerId={provider.id}
            onAdd={onAddApiKey}
            onToggle={onToggleApiKey}
            onDelete={onDeleteApiKey}
            loading={loading}
          />
        </section>

        {/* 分隔线 */}
        <div className="border-t border-border" />

        {/* Provider 配置表单 */}
        <section data-testid="config-section">
          <h4 className="text-sm font-medium text-foreground mb-3">配置</h4>
          <ProviderConfigForm
            provider={provider}
            onUpdate={onUpdate}
            loading={loading}
          />
        </section>

        {/* 分隔线 */}
        <div className="border-t border-border" />

        {/* 连接测试 */}
        <section data-testid="connection-test-section">
          <h4 className="text-sm font-medium text-foreground mb-3">连接测试</h4>
          <ConnectionTestButton
            providerId={provider.id}
            onTest={onTestConnection}
            disabled={
              loading ||
              !provider.enabled ||
              (provider.api_keys?.length ?? 0) === 0
            }
          />
          {(provider.api_keys?.length ?? 0) === 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              请先添加 API Key 后再进行连接测试
            </p>
          )}
        </section>

        {/* 分隔线 */}
        <div className="border-t border-border" />

        {/* 支持的模型列表 */}
        <section data-testid="supported-models-section">
          <ProviderModelList
            providerId={provider.id}
            providerType={provider.type}
          />
        </section>
      </div>
    </div>
  );
};

// ============================================================================
// 辅助函数（用于测试）
// ============================================================================

/**
 * 从 Provider 数据中提取设置面板显示所需的信息
 * 用于属性测试验证设置面板字段完整性
 */
export function extractProviderSettingInfo(
  provider: ProviderWithKeysDisplay | null,
): {
  hasProvider: boolean;
  hasIcon: boolean;
  hasName: boolean;
  hasEnabledSwitch: boolean;
  hasApiKeySection: boolean;
  hasConfigSection: boolean;
  hasConnectionTest: boolean;
} {
  if (!provider) {
    return {
      hasProvider: false,
      hasIcon: false,
      hasName: false,
      hasEnabledSwitch: false,
      hasApiKeySection: false,
      hasConfigSection: false,
      hasConnectionTest: false,
    };
  }

  return {
    hasProvider: true,
    hasIcon: typeof provider.id === "string" && provider.id.length > 0,
    hasName: typeof provider.name === "string" && provider.name.length > 0,
    hasEnabledSwitch: typeof provider.enabled === "boolean",
    hasApiKeySection: true,
    hasConfigSection: true,
    hasConnectionTest: true,
  };
}

export default ProviderSetting;
