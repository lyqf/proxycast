/**
 * @file ProviderConfigForm 组件
 * @description Provider 配置表单组件，显示 API Host 和根据 Provider Type 显示额外字段
 * @module components/provider-pool/api-key/ProviderConfigForm
 *
 * **Feature: provider-ui-refactor**
 * **Validates: Requirements 4.1, 4.2, 5.3-5.5**
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ProviderWithKeysDisplay,
  UpdateProviderRequest,
} from "@/lib/api/apiKeyProvider";
import type { ProviderType } from "@/lib/types/provider";

// ============================================================================
// 常量
// ============================================================================

/** 防抖延迟时间（毫秒） */
const DEBOUNCE_DELAY = 500;

/** 支持的 Provider 类型列表 */
const PROVIDER_TYPES: { value: ProviderType; label: string }[] = [
  { value: "openai", label: "OpenAI 兼容" },
  { value: "openai-response", label: "OpenAI Responses API" },
  { value: "codex", label: "Codex CLI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "anthropic-compatible", label: "Anthropic 兼容" },
  { value: "gemini", label: "Gemini" },
  { value: "azure-openai", label: "Azure OpenAI" },
  { value: "vertexai", label: "VertexAI" },
  { value: "aws-bedrock", label: "AWS Bedrock" },
  { value: "ollama", label: "Ollama" },
  { value: "fal", label: "Fal" },
  { value: "new-api", label: "New API" },
  { value: "gateway", label: "Vercel AI Gateway" },
];

/** Provider 类型对应的额外字段配置 */
const PROVIDER_TYPE_FIELDS: Record<ProviderType, string[]> = {
  openai: [],
  "openai-response": [],
  codex: [],
  anthropic: [],
  "anthropic-compatible": [], // Anthropic 兼容格式，无需额外字段
  gemini: [],
  "azure-openai": ["apiVersion"],
  vertexai: ["project", "location"],
  "aws-bedrock": ["region"],
  ollama: [],
  fal: [],
  "new-api": [],
  gateway: [],
};

/** 字段标签映射 */
const FIELD_LABELS: Record<string, string> = {
  apiHost: "API Host",
  apiVersion: "API Version",
  project: "Project ID",
  location: "Location",
  region: "Region",
};

/** 字段占位符映射 */
const FIELD_PLACEHOLDERS: Record<string, string> = {
  apiHost: "https://api.example.com",
  apiVersion: "2024-02-15-preview",
  project: "your-project-id",
  location: "us-central1",
  region: "us-east-1",
};

/** 字段帮助文本映射 */
const FIELD_HELP_TEXT: Record<string, string> = {
  apiHost: "API 服务的基础 URL",
  apiVersion: "Azure OpenAI API 版本",
  project: "Google Cloud 项目 ID",
  location: "VertexAI 服务位置",
  region: "AWS Bedrock 区域",
};

// ============================================================================
// 类型定义
// ============================================================================

export interface ProviderConfigFormProps {
  /** Provider 数据 */
  provider: ProviderWithKeysDisplay;
  /** 更新回调 */
  onUpdate?: (id: string, request: UpdateProviderRequest) => Promise<void>;
  /** 是否正在加载 */
  loading?: boolean;
  /** 额外的 CSS 类名 */
  className?: string;
}

interface FormState {
  providerType: ProviderType;
  apiHost: string;
  apiVersion: string;
  project: string;
  location: string;
  region: string;
  customModels: string;
}

// ============================================================================
// 组件实现
// ============================================================================

/**
 * Provider 配置表单组件
 *
 * 显示 Provider 的配置字段，包括：
 * - API Host（所有 Provider 都有）
 * - 根据 Provider Type 显示额外字段：
 *   - Azure OpenAI: API Version
 *   - VertexAI: Project, Location
 *   - AWS Bedrock: Region
 *
 * 支持自动保存（防抖）。
 *
 * @example
 * ```tsx
 * <ProviderConfigForm
 *   provider={provider}
 *   onUpdate={updateProvider}
 * />
 * ```
 */
export const ProviderConfigForm: React.FC<ProviderConfigFormProps> = ({
  provider,
  onUpdate,
  loading = false,
  className,
}) => {
  // 表单状态
  const [formState, setFormState] = useState<FormState>({
    providerType: (provider.type as ProviderType) || "openai",
    apiHost: provider.api_host || "",
    apiVersion: provider.api_version || "",
    project: provider.project || "",
    location: provider.location || "",
    region: provider.region || "",
    customModels: (provider.custom_models || []).join(", "),
  });

  // 保存状态
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // 防抖定时器
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 当 provider 变化时，重置表单状态
  useEffect(() => {
    setFormState({
      providerType: (provider.type as ProviderType) || "openai",
      apiHost: provider.api_host || "",
      apiVersion: provider.api_version || "",
      project: provider.project || "",
      location: provider.location || "",
      region: provider.region || "",
      customModels: (provider.custom_models || []).join(", "),
    });
    setSaveError(null);
  }, [
    provider.id,
    provider.type,
    provider.api_host,
    provider.api_version,
    provider.project,
    provider.location,
    provider.region,
    provider.custom_models,
  ]);

  // 保存配置
  const saveConfig = useCallback(
    async (state: FormState) => {
      if (!onUpdate) return;

      setIsSaving(true);
      setSaveError(null);

      try {
        // 解析自定义模型列表（逗号分隔）
        const customModels = state.customModels
          .split(",")
          .map((m) => m.trim())
          .filter((m) => m.length > 0);

        const request: UpdateProviderRequest = {
          // 只有自定义 Provider 才发送 type 字段
          type: !provider.is_system ? state.providerType : undefined,
          api_host: state.apiHost || undefined,
          api_version: state.apiVersion || undefined,
          project: state.project || undefined,
          location: state.location || undefined,
          region: state.region || undefined,
          custom_models: customModels.length > 0 ? customModels : undefined,
        };

        await onUpdate(provider.id, request);
        setLastSaved(new Date());
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "保存失败");
      } finally {
        setIsSaving(false);
      }
    },
    [provider.id, provider.is_system, onUpdate],
  );

  // 防抖保存
  const debouncedSave = useCallback(
    (state: FormState) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        saveConfig(state);
      }, DEBOUNCE_DELAY);
    },
    [saveConfig],
  );

  // 清理定时器
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // 处理字段变化
  const handleFieldChange = (field: keyof FormState, value: string) => {
    const newState = { ...formState, [field]: value };
    setFormState(newState);
    debouncedSave(newState);
  };

  // 获取当前 Provider 类型需要显示的额外字段
  // 使用 formState 中的 providerType，这样修改类型后会立即更新显示的字段
  const extraFields = PROVIDER_TYPE_FIELDS[formState.providerType] || [];

  // 格式化最后保存时间
  const formatLastSaved = (date: Date | null): string => {
    if (!date) return "";
    return `已保存于 ${date.toLocaleTimeString("zh-CN")}`;
  };

  return (
    <div
      className={cn("space-y-4", className)}
      data-testid="provider-config-form"
    >
      {/* Provider 类型选择器（仅自定义 Provider 显示） */}
      {!provider.is_system && (
        <div className="space-y-1.5">
          <Label htmlFor="provider-type" className="text-sm font-medium">
            Provider 类型
          </Label>
          <Select
            value={formState.providerType}
            onValueChange={(value) =>
              handleFieldChange("providerType", value as ProviderType)
            }
            disabled={loading || isSaving}
          >
            <SelectTrigger data-testid="provider-type-select">
              <SelectValue placeholder="选择 Provider 类型" />
            </SelectTrigger>
            <SelectContent>
              {PROVIDER_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            选择 API 协议类型，不同类型使用不同的请求格式
          </p>
        </div>
      )}

      {/* API Host 字段（所有 Provider 都有） */}
      <div className="space-y-1.5">
        <Label htmlFor="api-host" className="text-sm font-medium">
          {FIELD_LABELS.apiHost}
        </Label>
        <Input
          id="api-host"
          type="text"
          value={formState.apiHost}
          onChange={(e) => handleFieldChange("apiHost", e.target.value)}
          placeholder={FIELD_PLACEHOLDERS.apiHost}
          disabled={loading || isSaving}
          data-testid="api-host-input"
        />
        <p className="text-xs text-muted-foreground">
          {FIELD_HELP_TEXT.apiHost}
        </p>
      </div>

      {/* Azure OpenAI: API Version */}
      {extraFields.includes("apiVersion") && (
        <div className="space-y-1.5">
          <Label htmlFor="api-version" className="text-sm font-medium">
            {FIELD_LABELS.apiVersion}
          </Label>
          <Input
            id="api-version"
            type="text"
            value={formState.apiVersion}
            onChange={(e) => handleFieldChange("apiVersion", e.target.value)}
            placeholder={FIELD_PLACEHOLDERS.apiVersion}
            disabled={loading || isSaving}
            data-testid="api-version-input"
          />
          <p className="text-xs text-muted-foreground">
            {FIELD_HELP_TEXT.apiVersion}
          </p>
        </div>
      )}

      {/* VertexAI: Project */}
      {extraFields.includes("project") && (
        <div className="space-y-1.5">
          <Label htmlFor="project" className="text-sm font-medium">
            {FIELD_LABELS.project}
          </Label>
          <Input
            id="project"
            type="text"
            value={formState.project}
            onChange={(e) => handleFieldChange("project", e.target.value)}
            placeholder={FIELD_PLACEHOLDERS.project}
            disabled={loading || isSaving}
            data-testid="project-input"
          />
          <p className="text-xs text-muted-foreground">
            {FIELD_HELP_TEXT.project}
          </p>
        </div>
      )}

      {/* VertexAI: Location */}
      {extraFields.includes("location") && (
        <div className="space-y-1.5">
          <Label htmlFor="location" className="text-sm font-medium">
            {FIELD_LABELS.location}
          </Label>
          <Input
            id="location"
            type="text"
            value={formState.location}
            onChange={(e) => handleFieldChange("location", e.target.value)}
            placeholder={FIELD_PLACEHOLDERS.location}
            disabled={loading || isSaving}
            data-testid="location-input"
          />
          <p className="text-xs text-muted-foreground">
            {FIELD_HELP_TEXT.location}
          </p>
        </div>
      )}

      {/* AWS Bedrock: Region */}
      {extraFields.includes("region") && (
        <div className="space-y-1.5">
          <Label htmlFor="region" className="text-sm font-medium">
            {FIELD_LABELS.region}
          </Label>
          <Input
            id="region"
            type="text"
            value={formState.region}
            onChange={(e) => handleFieldChange("region", e.target.value)}
            placeholder={FIELD_PLACEHOLDERS.region}
            disabled={loading || isSaving}
            data-testid="region-input"
          />
          <p className="text-xs text-muted-foreground">
            {FIELD_HELP_TEXT.region}
          </p>
        </div>
      )}

      {/* 自定义模型列表 */}
      <div className="space-y-1.5">
        <Label htmlFor="custom-models" className="text-sm font-medium">
          自定义模型
        </Label>
        <Input
          id="custom-models"
          type="text"
          value={formState.customModels}
          onChange={(e) => handleFieldChange("customModels", e.target.value)}
          placeholder="glm-4, glm-4-flash, glm-4.7"
          disabled={loading || isSaving}
          data-testid="custom-models-input"
        />
        <p className="text-xs text-muted-foreground">
          该 Provider 支持的模型列表，用逗号分隔。用于不支持 /models 接口的
          Provider（如智谱）
        </p>
      </div>

      {/* 保存状态指示 */}
      <div className="flex items-center justify-between text-xs">
        {isSaving ? (
          <span
            className="text-muted-foreground"
            data-testid="saving-indicator"
          >
            保存中...
          </span>
        ) : saveError ? (
          <span className="text-red-500" data-testid="save-error">
            {saveError}
          </span>
        ) : lastSaved ? (
          <span className="text-green-600" data-testid="save-success">
            {formatLastSaved(lastSaved)}
          </span>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 辅助函数（用于测试）
// ============================================================================

/**
 * 获取指定 Provider 类型需要显示的字段列表
 * 用于属性测试验证 Provider 类型处理正确性
 */
export function getFieldsForProviderType(type: ProviderType): string[] {
  const baseFields = ["apiHost"];
  const extraFields = PROVIDER_TYPE_FIELDS[type] || [];
  return [...baseFields, ...extraFields];
}

/**
 * 验证 Provider 类型是否需要特定字段
 */
export function providerTypeRequiresField(
  type: ProviderType,
  field: string,
): boolean {
  if (field === "apiHost") return true;
  const extraFields = PROVIDER_TYPE_FIELDS[type] || [];
  return extraFields.includes(field);
}

export default ProviderConfigForm;
