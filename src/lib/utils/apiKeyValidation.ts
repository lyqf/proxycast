/**
 * @file API Key 格式验证
 * @description 各 Provider 的 API Key 格式验证规则
 * @module lib/utils/apiKeyValidation
 *
 * **Feature: provider-ui-refactor, Property 5: API Key 格式验证**
 * **Validates: Requirements 3.8**
 */

import type { ProviderType, SystemProviderId } from "../types/provider";

// ============================================================================
// 验证结果类型
// ============================================================================

/**
 * API Key 验证结果
 */
export interface ApiKeyValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 错误信息（无效时） */
  error?: string;
  /** 警告信息（可选） */
  warning?: string;
}

// ============================================================================
// API Key 格式规则
// ============================================================================

/**
 * API Key 格式规则定义
 */
interface ApiKeyFormatRule {
  /** 正则表达式模式 */
  pattern?: RegExp;
  /** 最小长度 */
  minLength?: number;
  /** 最大长度 */
  maxLength?: number;
  /** 前缀要求 */
  prefix?: string | string[];
  /** 自定义验证函数 */
  customValidator?: (key: string) => ApiKeyValidationResult;
  /** 格式描述（用于错误提示） */
  description: string;
}

/**
 * 各 Provider 的 API Key 格式规则
 */
const API_KEY_FORMAT_RULES: Partial<
  Record<SystemProviderId, ApiKeyFormatRule>
> = {
  // ===== 主流 AI =====
  openai: {
    prefix: ["sk-", "sk-proj-"],
    minLength: 20,
    maxLength: 200,
    description: 'OpenAI API Key 应以 "sk-" 或 "sk-proj-" 开头',
  },
  anthropic: {
    prefix: "sk-ant-",
    minLength: 20,
    maxLength: 200,
    description: 'Anthropic API Key 应以 "sk-ant-" 开头',
  },
  gemini: {
    prefix: "AIza",
    minLength: 30,
    maxLength: 50,
    description: 'Gemini API Key 应以 "AIza" 开头',
  },
  deepseek: {
    prefix: "sk-",
    minLength: 20,
    maxLength: 100,
    description: 'DeepSeek API Key 应以 "sk-" 开头',
  },
  moonshot: {
    prefix: "sk-",
    minLength: 20,
    maxLength: 100,
    description: 'Moonshot API Key 应以 "sk-" 开头',
  },
  groq: {
    prefix: "gsk_",
    minLength: 20,
    maxLength: 100,
    description: 'Groq API Key 应以 "gsk_" 开头',
  },
  grok: {
    prefix: "xai-",
    minLength: 20,
    maxLength: 100,
    description: 'Grok API Key 应以 "xai-" 开头',
  },
  mistral: {
    minLength: 20,
    maxLength: 100,
    description: "Mistral API Key 长度应在 20-100 字符之间",
  },
  perplexity: {
    prefix: "pplx-",
    minLength: 20,
    maxLength: 100,
    description: 'Perplexity API Key 应以 "pplx-" 开头',
  },
  cohere: {
    minLength: 20,
    maxLength: 100,
    description: "Cohere API Key 长度应在 20-100 字符之间",
  },

  // ===== 国内 AI =====
  zhipu: {
    minLength: 20,
    maxLength: 200,
    description: "智谱 API Key 长度应在 20-200 字符之间",
  },
  baichuan: {
    minLength: 20,
    maxLength: 100,
    description: "百川 API Key 长度应在 20-100 字符之间",
  },
  dashscope: {
    prefix: "sk-",
    minLength: 20,
    maxLength: 100,
    description: '通义千问 API Key 应以 "sk-" 开头',
  },
  stepfun: {
    minLength: 20,
    maxLength: 100,
    description: "阶跃星辰 API Key 长度应在 20-100 字符之间",
  },
  doubao: {
    minLength: 20,
    maxLength: 200,
    description: "豆包 API Key 长度应在 20-200 字符之间",
  },
  minimax: {
    minLength: 20,
    maxLength: 100,
    description: "MiniMax API Key 长度应在 20-100 字符之间",
  },
  yi: {
    minLength: 20,
    maxLength: 100,
    description: "零一万物 API Key 长度应在 20-100 字符之间",
  },
  hunyuan: {
    minLength: 20,
    maxLength: 200,
    description: "腾讯混元 API Key 长度应在 20-200 字符之间",
  },
  "tencent-cloud-ti": {
    minLength: 20,
    maxLength: 200,
    description: "腾讯云 TI API Key 长度应在 20-200 字符之间",
  },
  "baidu-cloud": {
    minLength: 20,
    maxLength: 200,
    description: "百度云 API Key 长度应在 20-200 字符之间",
  },
  infini: {
    minLength: 20,
    maxLength: 100,
    description: "无问芯穹 API Key 长度应在 20-100 字符之间",
  },
  modelscope: {
    minLength: 20,
    maxLength: 100,
    description: "魔搭 API Key 长度应在 20-100 字符之间",
  },
  xirang: {
    minLength: 20,
    maxLength: 100,
    description: "息壤 API Key 长度应在 20-100 字符之间",
  },
  mimo: {
    minLength: 20,
    maxLength: 100,
    description: "小米 MiMo API Key 长度应在 20-100 字符之间",
  },
  zhinao: {
    minLength: 20,
    maxLength: 100,
    description: "360 智脑 API Key 长度应在 20-100 字符之间",
  },

  // ===== 云服务 =====
  "azure-openai": {
    minLength: 20,
    maxLength: 100,
    description: "Azure OpenAI API Key 长度应在 20-100 字符之间",
  },
  vertexai: {
    // VertexAI 使用 Service Account JSON，格式较复杂
    minLength: 10,
    maxLength: 5000,
    description: "VertexAI 需要 Service Account 凭证",
  },
  "aws-bedrock": {
    // AWS Bedrock 使用 Access Key ID + Secret
    minLength: 16,
    maxLength: 128,
    description: "AWS Bedrock 需要 Access Key ID",
  },
  github: {
    prefix: ["ghp_", "gho_", "ghu_", "ghs_", "ghr_", "github_pat_"],
    minLength: 20,
    maxLength: 200,
    description:
      'GitHub Token 应以 "ghp_"、"gho_"、"ghu_"、"ghs_"、"ghr_" 或 "github_pat_" 开头',
  },
  copilot: {
    prefix: ["ghp_", "gho_", "ghu_", "ghs_", "ghr_", "github_pat_"],
    minLength: 20,
    maxLength: 200,
    description:
      'GitHub Copilot Token 应以 "ghp_"、"gho_"、"ghu_"、"ghs_"、"ghr_" 或 "github_pat_" 开头',
  },

  // ===== API 聚合 =====
  silicon: {
    prefix: "sk-",
    minLength: 20,
    maxLength: 100,
    description: 'Silicon Flow API Key 应以 "sk-" 开头',
  },
  openrouter: {
    prefix: "sk-or-",
    minLength: 20,
    maxLength: 100,
    description: 'OpenRouter API Key 应以 "sk-or-" 开头',
  },
  aihubmix: {
    minLength: 20,
    maxLength: 100,
    description: "AiHubMix API Key 长度应在 20-100 字符之间",
  },
  "302ai": {
    prefix: "sk-",
    minLength: 20,
    maxLength: 100,
    description: '302.AI API Key 应以 "sk-" 开头',
  },
  together: {
    minLength: 20,
    maxLength: 100,
    description: "Together API Key 长度应在 20-100 字符之间",
  },
  fireworks: {
    prefix: "fw_",
    minLength: 20,
    maxLength: 100,
    description: 'Fireworks API Key 应以 "fw_" 开头',
  },
  nvidia: {
    prefix: "nvapi-",
    minLength: 20,
    maxLength: 100,
    description: 'NVIDIA API Key 应以 "nvapi-" 开头',
  },
  hyperbolic: {
    minLength: 20,
    maxLength: 100,
    description: "Hyperbolic API Key 长度应在 20-100 字符之间",
  },
  cerebras: {
    prefix: "csk-",
    minLength: 20,
    maxLength: 100,
    description: 'Cerebras API Key 应以 "csk-" 开头',
  },
  ppio: {
    minLength: 20,
    maxLength: 100,
    description: "PPIO API Key 长度应在 20-100 字符之间",
  },
  qiniu: {
    minLength: 20,
    maxLength: 100,
    description: "七牛 API Key 长度应在 20-100 字符之间",
  },
  tokenflux: {
    minLength: 20,
    maxLength: 100,
    description: "TokenFlux API Key 长度应在 20-100 字符之间",
  },
  cephalon: {
    minLength: 20,
    maxLength: 100,
    description: "Cephalon API Key 长度应在 20-100 字符之间",
  },
  lanyun: {
    minLength: 20,
    maxLength: 100,
    description: "蓝云 API Key 长度应在 20-100 字符之间",
  },
  ph8: {
    minLength: 20,
    maxLength: 100,
    description: "PH8 API Key 长度应在 20-100 字符之间",
  },
  sophnet: {
    minLength: 20,
    maxLength: 100,
    description: "SophNet API Key 长度应在 20-100 字符之间",
  },
  ocoolai: {
    minLength: 20,
    maxLength: 100,
    description: "ocoolAI API Key 长度应在 20-100 字符之间",
  },
  dmxapi: {
    minLength: 20,
    maxLength: 100,
    description: "DMXAPI API Key 长度应在 20-100 字符之间",
  },
  aionly: {
    minLength: 20,
    maxLength: 100,
    description: "AIOnly API Key 长度应在 20-100 字符之间",
  },
  burncloud: {
    minLength: 20,
    maxLength: 100,
    description: "BurnCloud API Key 长度应在 20-100 字符之间",
  },
  alayanew: {
    minLength: 20,
    maxLength: 100,
    description: "AlayaNew API Key 长度应在 20-100 字符之间",
  },
  longcat: {
    minLength: 20,
    maxLength: 100,
    description: "LongCat API Key 长度应在 20-100 字符之间",
  },
  poe: {
    minLength: 20,
    maxLength: 100,
    description: "Poe API Key 长度应在 20-100 字符之间",
  },
  huggingface: {
    prefix: "hf_",
    minLength: 20,
    maxLength: 100,
    description: 'Hugging Face API Key 应以 "hf_" 开头',
  },
  "vercel-gateway": {
    minLength: 10,
    maxLength: 200,
    description: "Vercel AI Gateway API Key 长度应在 10-200 字符之间",
  },

  // ===== 本地服务 =====
  ollama: {
    // Ollama 通常不需要 API Key，但支持自定义
    minLength: 0,
    maxLength: 200,
    description: "Ollama 通常不需要 API Key",
  },
  lmstudio: {
    // LM Studio 通常不需要 API Key
    minLength: 0,
    maxLength: 200,
    description: "LM Studio 通常不需要 API Key",
  },
  "new-api": {
    prefix: "sk-",
    minLength: 20,
    maxLength: 100,
    description: 'New API Key 应以 "sk-" 开头',
  },
  gpustack: {
    minLength: 0,
    maxLength: 200,
    description: "GPUStack API Key 可选",
  },
  ovms: {
    minLength: 0,
    maxLength: 200,
    description: "OpenVINO Model Server API Key 可选",
  },

  // ===== 专用服务 =====
  jina: {
    prefix: "jina_",
    minLength: 20,
    maxLength: 100,
    description: 'Jina API Key 应以 "jina_" 开头',
  },
  voyageai: {
    prefix: "pa-",
    minLength: 20,
    maxLength: 100,
    description: 'VoyageAI API Key 应以 "pa-" 开头',
  },
  cherryin: {
    minLength: 20,
    maxLength: 100,
    description: "CherryIN API Key 长度应在 20-100 字符之间",
  },
};

/**
 * 非 SystemProviderId 的特殊规则（如后端动态扩展 Provider）。
 */
const SPECIAL_PROVIDER_RULES: Record<string, ApiKeyFormatRule> = {
  fal: {
    minLength: 10,
    maxLength: 200,
    description: "Fal API Key 长度应在 10-200 字符之间",
  },
};

/**
 * 基于 Provider Type 的默认验证规则
 */
const DEFAULT_RULES_BY_TYPE: Partial<Record<ProviderType, ApiKeyFormatRule>> = {
  openai: {
    prefix: "sk-",
    minLength: 20,
    maxLength: 200,
    description: 'OpenAI 兼容 API Key 应以 "sk-" 开头',
  },
  "openai-response": {
    prefix: ["sk-", "sk-proj-"],
    minLength: 20,
    maxLength: 200,
    description: 'OpenAI API Key 应以 "sk-" 或 "sk-proj-" 开头',
  },
  anthropic: {
    prefix: "sk-ant-",
    minLength: 20,
    maxLength: 200,
    description: 'Anthropic API Key 应以 "sk-ant-" 开头',
  },
  gemini: {
    prefix: "AIza",
    minLength: 30,
    maxLength: 50,
    description: 'Gemini API Key 应以 "AIza" 开头',
  },
  "azure-openai": {
    minLength: 20,
    maxLength: 100,
    description: "Azure OpenAI API Key 长度应在 20-100 字符之间",
  },
  vertexai: {
    minLength: 10,
    maxLength: 5000,
    description: "VertexAI 需要 Service Account 凭证",
  },
  "aws-bedrock": {
    minLength: 16,
    maxLength: 128,
    description: "AWS Bedrock 需要 Access Key ID",
  },
  ollama: {
    minLength: 0,
    maxLength: 200,
    description: "Ollama 通常不需要 API Key",
  },
  fal: {
    minLength: 10,
    maxLength: 200,
    description: "Fal API Key 长度应在 10-200 字符之间",
  },
  "new-api": {
    prefix: "sk-",
    minLength: 20,
    maxLength: 100,
    description: 'New API Key 应以 "sk-" 开头',
  },
  gateway: {
    minLength: 10,
    maxLength: 200,
    description: "Gateway API Key 长度应在 10-200 字符之间",
  },
};

// ============================================================================
// 验证函数
// ============================================================================

/**
 * 检查 API Key 是否匹配前缀要求
 */
function checkPrefix(apiKey: string, prefix: string | string[]): boolean {
  if (Array.isArray(prefix)) {
    return prefix.some((p) => apiKey.startsWith(p));
  }
  return apiKey.startsWith(prefix);
}

/**
 * 获取前缀描述字符串
 */
function getPrefixDescription(prefix: string | string[]): string {
  if (Array.isArray(prefix)) {
    return prefix.map((p) => `"${p}"`).join(" 或 ");
  }
  return `"${prefix}"`;
}

/**
 * 根据规则验证 API Key
 */
function validateWithRule(
  apiKey: string,
  rule: ApiKeyFormatRule,
): ApiKeyValidationResult {
  // 自定义验证器优先
  if (rule.customValidator) {
    return rule.customValidator(apiKey);
  }

  // 检查最小长度
  if (rule.minLength !== undefined && apiKey.length < rule.minLength) {
    // 对于允许空 Key 的 Provider（如 Ollama），空字符串是有效的
    if (rule.minLength === 0 && apiKey.length === 0) {
      return { valid: true, warning: "未设置 API Key，某些功能可能受限" };
    }
    return {
      valid: false,
      error: `API Key 长度不足，最少需要 ${rule.minLength} 个字符`,
    };
  }

  // 检查最大长度
  if (rule.maxLength !== undefined && apiKey.length > rule.maxLength) {
    return {
      valid: false,
      error: `API Key 长度超出限制，最多允许 ${rule.maxLength} 个字符`,
    };
  }

  // 检查前缀
  if (rule.prefix && !checkPrefix(apiKey, rule.prefix)) {
    return {
      valid: false,
      error: `API Key 格式不正确，应以 ${getPrefixDescription(rule.prefix)} 开头`,
    };
  }

  // 检查正则表达式
  if (rule.pattern && !rule.pattern.test(apiKey)) {
    return {
      valid: false,
      error: rule.description,
    };
  }

  return { valid: true };
}

/**
 * 验证 API Key 格式
 *
 * @param apiKey - 要验证的 API Key
 * @param providerId - Provider ID（可选，用于特定 Provider 的验证规则）
 * @param providerType - Provider Type（可选，用于基于类型的默认验证规则）
 * @returns 验证结果
 */
export function validateApiKeyFormat(
  apiKey: string,
  providerId?: string,
  providerType?: ProviderType,
): ApiKeyValidationResult {
  // 空字符串检查（除非 Provider 允许空 Key）
  if (!apiKey || apiKey.trim().length === 0) {
    // 检查是否为允许空 Key 的 Provider
    const specialRule = providerId
      ? SPECIAL_PROVIDER_RULES[providerId.toLowerCase()]
      : undefined;
    const rule = providerId
      ? API_KEY_FORMAT_RULES[providerId as SystemProviderId]
      : undefined;
    if (specialRule?.minLength === 0 || rule?.minLength === 0) {
      return { valid: true, warning: "未设置 API Key，某些功能可能受限" };
    }
    return { valid: false, error: "API Key 不能为空" };
  }

  // 去除首尾空白
  const trimmedKey = apiKey.trim();

  // 1. 优先使用特定 Provider 的规则
  if (providerId) {
    const specialRule = SPECIAL_PROVIDER_RULES[providerId.toLowerCase()];
    if (specialRule) {
      return validateWithRule(trimmedKey, specialRule);
    }

    const providerRule = API_KEY_FORMAT_RULES[providerId as SystemProviderId];
    if (providerRule) {
      return validateWithRule(trimmedKey, providerRule);
    }
  }

  // 2. 使用基于 Provider Type 的默认规则
  if (providerType) {
    const typeRule = DEFAULT_RULES_BY_TYPE[providerType];
    if (typeRule) {
      return validateWithRule(trimmedKey, typeRule);
    }
  }

  // 3. 通用验证（无特定规则时）
  // 基本长度检查
  if (trimmedKey.length < 10) {
    return { valid: false, error: "API Key 长度不足，最少需要 10 个字符" };
  }

  if (trimmedKey.length > 5000) {
    return { valid: false, error: "API Key 长度超出限制" };
  }

  // 检查是否包含非法字符（只允许字母、数字、下划线、连字符、点）
  if (!/^[\w\-._]+$/.test(trimmedKey)) {
    return {
      valid: false,
      error: "API Key 包含非法字符，只允许字母、数字、下划线、连字符和点",
    };
  }

  return { valid: true };
}

/**
 * 获取 Provider 的 API Key 格式描述
 *
 * @param providerId - Provider ID
 * @param providerType - Provider Type
 * @returns 格式描述字符串
 */
export function getApiKeyFormatDescription(
  providerId?: string,
  providerType?: ProviderType,
): string {
  // 优先使用特定 Provider 的描述
  if (providerId) {
    const specialRule = SPECIAL_PROVIDER_RULES[providerId.toLowerCase()];
    if (specialRule) {
      return specialRule.description;
    }

    const providerRule = API_KEY_FORMAT_RULES[providerId as SystemProviderId];
    if (providerRule) {
      return providerRule.description;
    }
  }

  // 使用基于 Provider Type 的描述
  if (providerType) {
    const typeRule = DEFAULT_RULES_BY_TYPE[providerType];
    if (typeRule) {
      return typeRule.description;
    }
  }

  return "API Key 长度应在 10-5000 字符之间";
}

/**
 * 检查 Provider 是否需要 API Key
 *
 * @param providerId - Provider ID
 * @returns 是否需要 API Key
 */
export function isApiKeyRequired(providerId: string): boolean {
  const specialRule = SPECIAL_PROVIDER_RULES[providerId.toLowerCase()];
  if (specialRule) {
    return specialRule.minLength !== 0;
  }

  const rule = API_KEY_FORMAT_RULES[providerId as SystemProviderId];
  // 如果 minLength 为 0，则 API Key 是可选的
  return rule?.minLength !== 0;
}

/**
 * 获取所有已定义验证规则的 Provider ID 列表
 */
export function getProvidersWithValidationRules(): string[] {
  return [
    ...Object.keys(API_KEY_FORMAT_RULES),
    ...Object.keys(SPECIAL_PROVIDER_RULES),
  ];
}

/**
 * 获取特定 Provider 的验证规则
 */
export function getValidationRule(
  providerId: string,
): ApiKeyFormatRule | undefined {
  return (
    SPECIAL_PROVIDER_RULES[providerId.toLowerCase()] ||
    API_KEY_FORMAT_RULES[providerId as SystemProviderId]
  );
}
