/**
 * @file API Key 格式验证属性测试
 * @description 测试 API Key 格式验证正确性
 * @module lib/utils/apiKeyValidation.test
 *
 * **Feature: provider-ui-refactor, Property 5: API Key 格式验证**
 * **Validates: Requirements 3.8**
 */

import { describe, expect, it } from "vitest";
import { test } from "@fast-check/vitest";
import * as fc from "fast-check";
import {
  validateApiKeyFormat,
  getApiKeyFormatDescription,
  isApiKeyRequired,
  getProvidersWithValidationRules,
} from "./apiKeyValidation";
import { getSystemProviderIds, SYSTEM_PROVIDERS } from "../config/providers";
import type { SystemProviderId, ProviderType } from "../types/provider";

// 生成有效的 API Key 后缀（只包含字母数字）
const alphanumericArbitrary = fc
  .string({ minLength: 30, maxLength: 80 })
  .map((s) => s.replace(/[^a-zA-Z0-9]/g, "x"));

describe("API Key 格式验证", () => {
  /**
   * Property 5: API Key 格式验证
   *
   * *对于任意* 输入的 API Key 字符串，系统应能正确判断其格式是否有效
   *
   * **Validates: Requirements 3.8**
   */
  describe("Property 5: API Key 格式验证", () => {
    // 获取所有有验证规则的 Provider
    const providersWithRules = getProvidersWithValidationRules();

    test.prop(
      [
        fc.constantFrom(...providersWithRules),
        fc.string({ minLength: 1, maxLength: 200 }),
      ],
      { numRuns: 100 },
    )(
      "对于任意 Provider 和任意字符串，验证函数应返回有效的结果结构",
      (providerId: string, apiKey: string) => {
        const result = validateApiKeyFormat(apiKey, providerId);

        // 验证结果结构
        expect(typeof result.valid).toBe("boolean");
        if (!result.valid) {
          expect(typeof result.error).toBe("string");
          expect(result.error!.length).toBeGreaterThan(0);
        }
      },
    );

    test.prop([fc.constantFrom(...providersWithRules)], { numRuns: 100 })(
      "空字符串应被正确处理（根据 Provider 是否要求 API Key）",
      (providerId: string) => {
        const result = validateApiKeyFormat("", providerId);
        const required = isApiKeyRequired(providerId);

        if (required) {
          // 如果 API Key 是必需的，空字符串应该无效
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
        } else {
          // 如果 API Key 是可选的，空字符串应该有效（可能有警告）
          expect(result.valid).toBe(true);
        }
      },
    );

    // 测试特定 Provider 的前缀验证
    describe("前缀验证", () => {
      // 测试有效前缀
      it("OpenAI 有效前缀应通过验证", () => {
        const validKeys = [
          "sk-1234567890abcdefghijklmnopqrstuvwxyz",
          "sk-proj-1234567890abcdefghijklmnopqrstuvwxyz",
        ];
        for (const key of validKeys) {
          const result = validateApiKeyFormat(key, "openai");
          expect(result.valid).toBe(true);
        }
      });

      it("Anthropic 有效前缀应通过验证", () => {
        const result = validateApiKeyFormat(
          "sk-ant-1234567890abcdefghijklmnopqrstuvwxyz",
          "anthropic",
        );
        expect(result.valid).toBe(true);
      });

      it("Gemini 有效前缀应通过验证", () => {
        const result = validateApiKeyFormat(
          "AIza1234567890abcdefghijklmnopqrstuvwxyz",
          "gemini",
        );
        expect(result.valid).toBe(true);
      });

      it("Groq 有效前缀应通过验证", () => {
        const result = validateApiKeyFormat(
          "gsk_1234567890abcdefghijklmnopqrstuvwxyz",
          "groq",
        );
        expect(result.valid).toBe(true);
      });

      // 测试无效前缀
      test.prop([alphanumericArbitrary], { numRuns: 100 })(
        "OpenAI 无效前缀应被拒绝",
        (suffix: string) => {
          const result = validateApiKeyFormat("invalid-" + suffix, "openai");
          expect(result.valid).toBe(false);
        },
      );

      test.prop([alphanumericArbitrary], { numRuns: 100 })(
        "Anthropic 无效前缀应被拒绝",
        (suffix: string) => {
          const result = validateApiKeyFormat("invalid-" + suffix, "anthropic");
          expect(result.valid).toBe(false);
        },
      );

      test.prop([alphanumericArbitrary], { numRuns: 100 })(
        "Gemini 无效前缀应被拒绝",
        (suffix: string) => {
          const result = validateApiKeyFormat("invalid-" + suffix, "gemini");
          expect(result.valid).toBe(false);
        },
      );
    });

    // 测试长度验证
    describe("长度验证", () => {
      test.prop([fc.string({ minLength: 1, maxLength: 5 })], { numRuns: 100 })(
        "过短的 API Key 应被拒绝（对于要求最小长度的 Provider）",
        (shortKey: string) => {
          // OpenAI 要求最小 20 字符
          const result = validateApiKeyFormat(shortKey, "openai");
          expect(result.valid).toBe(false);
        },
      );

      test.prop([fc.string({ minLength: 300, maxLength: 500 })], {
        numRuns: 100,
      })("过长的 API Key 应被拒绝", (longKey: string) => {
        // OpenAI 最大 200 字符
        const result = validateApiKeyFormat(longKey, "openai");
        expect(result.valid).toBe(false);
      });
    });

    // 测试通用验证（无特定 Provider）
    describe("通用验证", () => {
      test.prop([alphanumericArbitrary], { numRuns: 100 })(
        "符合通用格式的 API Key 应通过验证",
        (apiKey: string) => {
          const result = validateApiKeyFormat(apiKey);
          expect(result.valid).toBe(true);
        },
      );

      it("包含非法字符的 API Key 应被拒绝", () => {
        const invalidKeys = [
          "api key with spaces",
          "api@key#with$special",
          "api\nkey\twith\rcontrol",
        ];
        for (const key of invalidKeys) {
          const result = validateApiKeyFormat(key);
          expect(result.valid).toBe(false);
        }
      });
    });
  });

  describe("辅助函数", () => {
    const systemProviderIds = getSystemProviderIds();

    test.prop([fc.constantFrom(...systemProviderIds)], { numRuns: 100 })(
      "getApiKeyFormatDescription 应返回非空字符串",
      (providerId: SystemProviderId) => {
        const description = getApiKeyFormatDescription(providerId);
        expect(typeof description).toBe("string");
        expect(description.length).toBeGreaterThan(0);
      },
    );

    test.prop([fc.constantFrom(...systemProviderIds)], { numRuns: 100 })(
      "isApiKeyRequired 应返回布尔值",
      (providerId: SystemProviderId) => {
        const required = isApiKeyRequired(providerId);
        expect(typeof required).toBe("boolean");
      },
    );

    it("getProvidersWithValidationRules 应返回非空数组", () => {
      const providers = getProvidersWithValidationRules();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
    });

    it("所有 System Provider 应有对应的验证规则或使用默认规则", () => {
      for (const providerId of systemProviderIds) {
        const provider = SYSTEM_PROVIDERS[providerId];
        // 验证函数应该能处理所有 Provider
        const result = validateApiKeyFormat(
          "test-key-12345678901234567890",
          providerId,
          provider.type,
        );
        expect(typeof result.valid).toBe("boolean");
      }
    });
  });

  describe("Provider Type 默认规则", () => {
    const providerTypes: ProviderType[] = [
      "openai",
      "openai-response",
      "anthropic",
      "gemini",
      "azure-openai",
      "vertexai",
      "aws-bedrock",
      "ollama",
      "fal",
      "new-api",
      "gateway",
    ];

    test.prop([fc.constantFrom(...providerTypes), alphanumericArbitrary], {
      numRuns: 100,
    })(
      "基于 Provider Type 的验证应返回有效结果",
      (providerType: ProviderType, apiKey: string) => {
        const result = validateApiKeyFormat(apiKey, undefined, providerType);
        expect(typeof result.valid).toBe("boolean");
      },
    );
  });
});
