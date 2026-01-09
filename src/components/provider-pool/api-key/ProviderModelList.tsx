/**
 * @file ProviderModelList 组件
 * @description 显示 Provider 支持的模型列表
 * @module components/provider-pool/api-key/ProviderModelList
 */

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useModelRegistry } from "@/hooks/useModelRegistry";
import { Eye, Wrench, Brain, Sparkles, Loader2 } from "lucide-react";
import type { EnhancedModelMetadata } from "@/lib/types/modelRegistry";
import { mapProviderIdToRegistryId } from "./providerTypeMapping";

// ============================================================================
// 类型定义
// ============================================================================

export interface ProviderModelListProps {
  /** Provider ID，如 "deepseek", "openai", "anthropic" */
  providerId: string;
  /** Provider 类型（API 协议），如 "anthropic", "openai", "gemini" */
  providerType: string;
  /** 额外的 CSS 类名 */
  className?: string;
  /** 最大显示数量，默认显示全部 */
  maxItems?: number;
}

// ============================================================================
// 子组件
// ============================================================================

interface ModelItemProps {
  model: EnhancedModelMetadata;
}

/**
 * 单个模型项
 */
const ModelItem: React.FC<ModelItemProps> = ({ model }) => {
  return (
    <div
      className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 transition-colors"
      data-testid={`model-item-${model.id}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">
            {model.display_name}
          </span>
        </div>
        <div className="text-xs text-muted-foreground truncate">{model.id}</div>
      </div>

      {/* 能力标签 */}
      <div className="flex items-center gap-1.5 ml-2">
        {model.capabilities.vision && (
          <span
            className="text-blue-500"
            title="支持视觉"
            data-testid="capability-vision"
          >
            <Eye className="h-3.5 w-3.5" />
          </span>
        )}
        {model.capabilities.tools && (
          <span
            className="text-orange-500"
            title="支持工具调用"
            data-testid="capability-tools"
          >
            <Wrench className="h-3.5 w-3.5" />
          </span>
        )}
        {model.capabilities.reasoning && (
          <span
            className="text-purple-500"
            title="支持推理"
            data-testid="capability-reasoning"
          >
            <Brain className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 主组件
// ============================================================================

/**
 * Provider 支持的模型列表组件
 *
 * 显示指定 Provider 支持的所有模型，包括模型名称和能力标签
 *
 * @example
 * ```tsx
 * <ProviderModelList providerType="anthropic" />
 * ```
 */
export const ProviderModelList: React.FC<ProviderModelListProps> = ({
  providerId,
  providerType,
  className,
  maxItems,
}) => {
  // 转换 Provider ID 为 registry ID（优先使用 providerId，回退到 providerType）
  const registryProviderId = useMemo(
    () => mapProviderIdToRegistryId(providerId, providerType),
    [providerId, providerType],
  );

  // 获取模型数据
  const { models, loading, error } = useModelRegistry({
    autoLoad: true,
    providerFilter: [registryProviderId],
  });

  // 限制显示数量
  const displayModels = useMemo(() => {
    if (maxItems && maxItems > 0) {
      return models.slice(0, maxItems);
    }
    return models;
  }, [models, maxItems]);

  const hasMore = maxItems && models.length > maxItems;

  // 加载状态
  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center justify-center py-8 text-muted-foreground",
          className,
        )}
        data-testid="provider-model-list-loading"
      >
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-sm">加载模型列表...</span>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div
        className={cn("py-4 text-center text-sm text-red-500", className)}
        data-testid="provider-model-list-error"
      >
        加载失败: {error}
      </div>
    );
  }

  // 空状态
  if (models.length === 0) {
    return (
      <div
        className={cn(
          "py-4 text-center text-sm text-muted-foreground",
          className,
        )}
        data-testid="provider-model-list-empty"
      >
        暂无模型数据
      </div>
    );
  }

  return (
    <div
      className={cn("space-y-1", className)}
      data-testid="provider-model-list"
    >
      {/* 标题 */}
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          支持的模型
          <span className="text-xs text-muted-foreground font-normal">
            ({models.length})
          </span>
        </h4>
      </div>

      {/* 模型列表 */}
      <div className="border rounded-md divide-y divide-border">
        {displayModels.map((model) => (
          <ModelItem key={model.id} model={model} />
        ))}
      </div>

      {/* 显示更多提示 */}
      {hasMore && (
        <p className="text-xs text-muted-foreground text-center pt-2">
          还有 {models.length - maxItems!} 个模型未显示
        </p>
      )}
    </div>
  );
};

export default ProviderModelList;
