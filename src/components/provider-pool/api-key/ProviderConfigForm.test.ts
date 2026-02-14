/**
 * @file ProviderConfigForm 属性测试
 * @description 测试 Provider 类型处理正确性
 * @module components/provider-pool/api-key/ProviderConfigForm.test
 *
 * **Feature: provider-ui-refactor**
 * **Property 7: Provider 类型处理正确性**
 * **Validates: Requirements 5.1-5.5**
 */

import { describe, expect } from "vitest";
import { test } from "@fast-check/vitest";
import * as fc from "fast-check";
import {
  getFieldsForProviderType,
  providerTypeRequiresField,
} from "./ProviderConfigForm";
import type { ProviderType } from "@/lib/types/provider";

// ============================================================================
// 测试数据生成器
// ============================================================================

/**
 * 所有有效的 Provider 类型
 */
const ALL_PROVIDER_TYPES: ProviderType[] = [
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

/**
 * 生成随机 Provider 类型
 */
const providerTypeArbitrary: fc.Arbitrary<ProviderType> = fc.constantFrom(
  ...ALL_PROVIDER_TYPES,
);

/**
 * Provider 类型与其额外字段的映射
 */
const EXPECTED_EXTRA_FIELDS: Record<ProviderType, string[]> = {
  openai: [],
  "openai-response": [],
  codex: [],
  anthropic: [],
  "anthropic-compatible": [],
  gemini: [],
  "azure-openai": ["apiVersion"],
  vertexai: ["project", "location"],
  "aws-bedrock": ["region"],
  ollama: [],
  fal: [],
  "new-api": [],
  gateway: [],
};

// ============================================================================
// Property 7: Provider 类型处理正确性
// ============================================================================

describe("Property 7: Provider 类型处理正确性", () => {
  /**
   * Property 7: Provider 类型处理正确性
   *
   * *对于任意* Provider Type，系统应使用对应的 API 调用方式，并显示该类型所需的额外配置字段
   *
   * **Validates: Requirements 5.1-5.5**
   */
  test.prop([providerTypeArbitrary], { numRuns: 100 })(
    "每个 Provider 类型应返回正确的字段列表",
    (type: ProviderType) => {
      const fields = getFieldsForProviderType(type);

      // 所有类型都应包含 apiHost 字段
      expect(fields).toContain("apiHost");

      // 验证额外字段
      const expectedExtra = EXPECTED_EXTRA_FIELDS[type];
      for (const field of expectedExtra) {
        expect(fields).toContain(field);
      }

      // 验证字段数量正确
      expect(fields.length).toBe(1 + expectedExtra.length);
    },
  );

  test.prop([providerTypeArbitrary], { numRuns: 100 })(
    "apiHost 字段对所有 Provider 类型都是必需的",
    (type: ProviderType) => {
      expect(providerTypeRequiresField(type, "apiHost")).toBe(true);
    },
  );

  test.prop([providerTypeArbitrary], { numRuns: 100 })(
    "Azure OpenAI 类型应需要 apiVersion 字段",
    (type: ProviderType) => {
      const requiresApiVersion = providerTypeRequiresField(type, "apiVersion");
      expect(requiresApiVersion).toBe(type === "azure-openai");
    },
  );

  test.prop([providerTypeArbitrary], { numRuns: 100 })(
    "VertexAI 类型应需要 project 和 location 字段",
    (type: ProviderType) => {
      const requiresProject = providerTypeRequiresField(type, "project");
      const requiresLocation = providerTypeRequiresField(type, "location");

      expect(requiresProject).toBe(type === "vertexai");
      expect(requiresLocation).toBe(type === "vertexai");
    },
  );

  test.prop([providerTypeArbitrary], { numRuns: 100 })(
    "AWS Bedrock 类型应需要 region 字段",
    (type: ProviderType) => {
      const requiresRegion = providerTypeRequiresField(type, "region");
      expect(requiresRegion).toBe(type === "aws-bedrock");
    },
  );

  test.prop([providerTypeArbitrary], { numRuns: 100 })(
    "标准 OpenAI 兼容类型不应需要额外字段",
    (type: ProviderType) => {
      const standardTypes: ProviderType[] = [
        "openai",
        "openai-response",
        "anthropic",
        "gemini",
        "ollama",
        "fal",
        "new-api",
        "gateway",
      ];

      if (standardTypes.includes(type)) {
        const fields = getFieldsForProviderType(type);
        // 只应有 apiHost 字段
        expect(fields.length).toBe(1);
        expect(fields[0]).toBe("apiHost");
      }
    },
  );

  // 具体类型的单元测试
  describe("具体 Provider 类型字段验证", () => {
    test("openai 类型只需要 apiHost", () => {
      const fields = getFieldsForProviderType("openai");
      expect(fields).toEqual(["apiHost"]);
    });

    test("openai-response 类型只需要 apiHost", () => {
      const fields = getFieldsForProviderType("openai-response");
      expect(fields).toEqual(["apiHost"]);
    });

    test("anthropic 类型只需要 apiHost", () => {
      const fields = getFieldsForProviderType("anthropic");
      expect(fields).toEqual(["apiHost"]);
    });

    test("gemini 类型只需要 apiHost", () => {
      const fields = getFieldsForProviderType("gemini");
      expect(fields).toEqual(["apiHost"]);
    });

    test("azure-openai 类型需要 apiHost 和 apiVersion", () => {
      const fields = getFieldsForProviderType("azure-openai");
      expect(fields).toContain("apiHost");
      expect(fields).toContain("apiVersion");
      expect(fields.length).toBe(2);
    });

    test("vertexai 类型需要 apiHost、project 和 location", () => {
      const fields = getFieldsForProviderType("vertexai");
      expect(fields).toContain("apiHost");
      expect(fields).toContain("project");
      expect(fields).toContain("location");
      expect(fields.length).toBe(3);
    });

    test("aws-bedrock 类型需要 apiHost 和 region", () => {
      const fields = getFieldsForProviderType("aws-bedrock");
      expect(fields).toContain("apiHost");
      expect(fields).toContain("region");
      expect(fields.length).toBe(2);
    });

    test("ollama 类型只需要 apiHost", () => {
      const fields = getFieldsForProviderType("ollama");
      expect(fields).toEqual(["apiHost"]);
    });

    test("fal 类型只需要 apiHost", () => {
      const fields = getFieldsForProviderType("fal");
      expect(fields).toEqual(["apiHost"]);
    });

    test("new-api 类型只需要 apiHost", () => {
      const fields = getFieldsForProviderType("new-api");
      expect(fields).toEqual(["apiHost"]);
    });

    test("gateway 类型只需要 apiHost", () => {
      const fields = getFieldsForProviderType("gateway");
      expect(fields).toEqual(["apiHost"]);
    });
  });

  // 边界情况测试
  describe("边界情况", () => {
    test("所有 Provider 类型都应被支持", () => {
      for (const type of ALL_PROVIDER_TYPES) {
        const fields = getFieldsForProviderType(type);
        expect(Array.isArray(fields)).toBe(true);
        expect(fields.length).toBeGreaterThan(0);
      }
    });

    test("不存在的字段应返回 false", () => {
      for (const type of ALL_PROVIDER_TYPES) {
        expect(providerTypeRequiresField(type, "nonExistentField")).toBe(false);
      }
    });
  });
});
