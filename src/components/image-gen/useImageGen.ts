/**
 * @file 图片生成 Hook
 * @description 管理图片生成状态，复用凭证池的 API Key Provider
 * @module components/image-gen/useImageGen
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { useApiKeyProvider } from "@/hooks/useApiKeyProvider";
import { apiKeyProviderApi } from "@/lib/api/apiKeyProvider";
import type {
  GeneratedImage,
  ImageGenRequest,
  ImageGenResponse,
  ImageGenModel,
} from "./types";
import { IMAGE_GEN_MODELS, IMAGE_GEN_PROVIDER_IDS } from "./types";

const HISTORY_KEY = "image-gen-history";

interface GenerateImageOptions {
  imageCount?: number;
  referenceImages?: string[];
  size?: string;
}

function extractImageUrlFromResponse(content: string): string | null {
  const base64Match = content.match(
    /!\[.*?\]\((data:image\/[^;]+;base64,[^)]+)\)/,
  );
  if (base64Match) {
    return base64Match[1];
  }

  const urlMatch = content.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/);
  if (urlMatch) {
    return urlMatch[1];
  }

  return null;
}

async function requestImageFromNewApi(
  apiHost: string,
  apiKey: string,
  model: string,
  prompt: string,
  referenceImages: string[],
): Promise<string> {
  const referenceText =
    referenceImages.length > 0
      ? `\n参考图链接：\n${referenceImages
          .map((url, index) => `${index + 1}. ${url}`)
          .join("\n")}`
      : "";

  const chatRequest = {
    model,
    messages: [
      {
        role: "user",
        content:
          "请根据以下描述生成一张图片，并以 Markdown 图片格式返回结果。" +
          `\n描述：${prompt}${referenceText}`,
      },
    ],
    temperature: 0.7,
    stream: false,
  };

  const response = await fetch(`${apiHost}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(chatRequest),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`请求失败: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  const imageUrl = extractImageUrlFromResponse(content);

  if (!imageUrl) {
    throw new Error("未能从响应中提取图片");
  }

  return imageUrl;
}

/**
 * 检查 Provider 是否支持图片生成
 * 通过 Provider ID 或 type 匹配
 */
function isImageGenProvider(providerId: string, providerType: string): boolean {
  return (
    IMAGE_GEN_PROVIDER_IDS.includes(providerId) ||
    IMAGE_GEN_PROVIDER_IDS.includes(providerType)
  );
}

/**
 * 根据 Provider 获取支持的图片模型
 * 优先使用 Provider 的 custom_models，回退到预设模型
 */
function getModelsForProvider(
  providerId: string,
  providerType: string,
  customModels?: string[],
): ImageGenModel[] {
  // 优先使用 Provider 的自定义模型
  if (customModels && customModels.length > 0) {
    return customModels.map((modelId) => ({
      id: modelId,
      name: modelId,
      supportedSizes: [
        "1024x1024",
        "768x1344",
        "1344x768",
        "1792x1024",
        "1024x1792",
      ],
    }));
  }
  // 回退到预设模型（Provider ID 匹配）
  if (IMAGE_GEN_MODELS[providerId]) {
    return IMAGE_GEN_MODELS[providerId];
  }
  // 回退到预设模型（Provider type 匹配）
  if (IMAGE_GEN_MODELS[providerType]) {
    return IMAGE_GEN_MODELS[providerType];
  }
  return [];
}

export function useImageGen() {
  const { providers, loading: providersLoading } = useApiKeyProvider();

  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [selectedSize, setSelectedSize] = useState<string>("1024x1024");
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // 过滤出支持图片生成、启用且有 API Key 的 Provider
  const availableProviders = useMemo(() => {
    console.log(
      "[useImageGen] 支持图片生成的 Provider IDs:",
      IMAGE_GEN_PROVIDER_IDS,
    );
    console.log(
      "[useImageGen] 所有 Provider:",
      providers.map((p) => ({
        id: p.id,
        type: p.type,
        enabled: p.enabled,
        api_key_count: p.api_key_count,
        isImageGen: isImageGenProvider(p.id, p.type),
      })),
    );

    const filtered = providers.filter(
      (p) =>
        p.enabled && p.api_key_count > 0 && isImageGenProvider(p.id, p.type),
    );

    console.log(
      "[useImageGen] 过滤后的 Provider:",
      filtered.map((p) => p.id),
    );
    return filtered;
  }, [providers]);

  // 从 localStorage 加载历史记录
  useEffect(() => {
    const saved = localStorage.getItem(HISTORY_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as GeneratedImage[];
        setImages(parsed);
        if (parsed.length > 0) {
          setSelectedImageId(parsed[0].id);
        }
      } catch (e) {
        console.error("加载历史记录失败:", e);
      }
    }
  }, []);

  // 自动选择第一个可用的 Provider
  useEffect(() => {
    if (!selectedProviderId && availableProviders.length > 0) {
      const firstProvider = availableProviders[0];
      setSelectedProviderId(firstProvider.id);
      // 设置默认模型
      const models = getModelsForProvider(
        firstProvider.id,
        firstProvider.type,
        firstProvider.custom_models,
      );
      if (models.length > 0) {
        setSelectedModelId(models[0].id);
      }
    }
  }, [availableProviders, selectedProviderId]);

  // 保存历史记录
  const saveHistory = useCallback((newImages: GeneratedImage[]) => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(newImages.slice(0, 50)));
  }, []);

  // 获取当前选中的 Provider
  const selectedProvider = useMemo(() => {
    return availableProviders.find((p) => p.id === selectedProviderId);
  }, [availableProviders, selectedProviderId]);

  // 获取当前 Provider 支持的模型
  const availableModels = useMemo(() => {
    if (!selectedProvider) return [];
    return getModelsForProvider(
      selectedProvider.id,
      selectedProvider.type,
      selectedProvider.custom_models,
    );
  }, [selectedProvider]);

  // 获取当前选中的模型
  const selectedModel = useMemo(() => {
    return availableModels.find((m) => m.id === selectedModelId);
  }, [availableModels, selectedModelId]);

  // 获取当前选中的图片
  const selectedImage = useMemo(() => {
    return images.find((img) => img.id === selectedImageId);
  }, [images, selectedImageId]);

  // 切换 Provider 时更新模型
  const handleProviderChange = useCallback(
    (providerId: string) => {
      setSelectedProviderId(providerId);
      const provider = availableProviders.find((p) => p.id === providerId);
      if (provider) {
        const models = getModelsForProvider(
          provider.id,
          provider.type,
          provider.custom_models,
        );
        if (models.length > 0) {
          setSelectedModelId(models[0].id);
        }
      }
    },
    [availableProviders],
  );

  // 生成图片
  const generateImage = useCallback(
    async (prompt: string, options?: GenerateImageOptions) => {
      if (!selectedProvider) {
        throw new Error("请先在凭证池中配置 API Key Provider");
      }

      const generationCount = Math.max(
        1,
        Math.min(options?.imageCount ?? 1, 8),
      );
      const requestSize = options?.size || selectedSize;
      const referenceImages = options?.referenceImages || [];

      const baseId = Date.now();
      const generationItems: GeneratedImage[] = Array.from(
        { length: generationCount },
        (_, index) => ({
          id: `img-${baseId}-${index}`,
          url: "",
          prompt,
          model: selectedModelId,
          size: requestSize,
          providerId: selectedProvider.id,
          providerName: selectedProvider.name,
          createdAt: baseId + index,
          status: "generating",
        }),
      );

      setImages((prev) => {
        const updated = [...generationItems, ...prev];
        saveHistory(updated);
        return updated;
      });
      setSelectedImageId(generationItems[0]?.id || null);

      setGenerating(true);

      try {
        const isNewApi =
          selectedProvider.id === "new-api" ||
          selectedProvider.type === "new-api" ||
          selectedProvider.type === "NewApi";

        if (isNewApi) {
          for (const item of generationItems) {
            try {
              const apiKey = await apiKeyProviderApi.getNextApiKey(
                selectedProvider.id,
              );
              if (!apiKey) {
                throw new Error(
                  "该 Provider 没有可用的 API Key，请在凭证池中添加",
                );
              }

              const imageUrl = await requestImageFromNewApi(
                selectedProvider.api_host,
                apiKey,
                selectedModelId,
                prompt,
                referenceImages,
              );

              setImages((prev) => {
                const updated = prev.map((img) =>
                  img.id === item.id
                    ? { ...img, url: imageUrl, status: "complete" as const }
                    : img,
                );
                saveHistory(updated);
                return updated;
              });
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);

              setImages((prev) => {
                const updated = prev.map((img) =>
                  img.id === item.id
                    ? { ...img, status: "error" as const, error: errorMessage }
                    : img,
                );
                saveHistory(updated);
                return updated;
              });
            }
          }
        } else {
          const apiKey = await apiKeyProviderApi.getNextApiKey(
            selectedProvider.id,
          );
          if (!apiKey) {
            throw new Error("该 Provider 没有可用的 API Key，请在凭证池中添加");
          }

          const request: ImageGenRequest = {
            model: selectedModelId,
            prompt,
            n: generationCount,
            size: requestSize,
          };

          const response = await fetch(
            `${selectedProvider.api_host}/v1/images/generations`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify(request),
            },
          );

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`请求失败: ${response.status} - ${errorText}`);
          }

          const data = (await response.json()) as ImageGenResponse;
          const urls = data.data.map((item) => item.url).filter(Boolean);

          if (urls.length === 0) {
            throw new Error("未返回图片 URL");
          }

          setImages((prev) => {
            const updated = prev.map((img) => {
              const index = generationItems.findIndex(
                (item) => item.id === img.id,
              );

              if (index === -1) return img;

              const imageUrl = urls[index];
              if (imageUrl) {
                return { ...img, url: imageUrl, status: "complete" as const };
              }

              return {
                ...img,
                status: "error" as const,
                error: "服务返回的图片数量少于请求数量",
              };
            });

            saveHistory(updated);
            return updated;
          });
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        setImages((prev) => {
          const updated = prev.map((img) =>
            generationItems.some((item) => item.id === img.id) &&
            img.status === "generating"
              ? { ...img, status: "error" as const, error: errorMessage }
              : img,
          );
          saveHistory(updated);
          return updated;
        });
        throw error;
      } finally {
        setGenerating(false);
      }
    },
    [selectedProvider, selectedModelId, selectedSize, saveHistory],
  );

  // 删除图片
  const deleteImage = useCallback(
    (id: string) => {
      setImages((prev) => {
        const updated = prev.filter((img) => img.id !== id);
        if (selectedImageId === id) {
          setSelectedImageId(updated[0]?.id || null);
        }
        saveHistory(updated);
        return updated;
      });
    },
    [selectedImageId, saveHistory],
  );

  // 新建图片（创建一个新的空白图片项）
  const newImage = useCallback(() => {
    console.log("[useImageGen] newImage 被调用，创建新图片项");
    const imageId = `img-${Date.now()}`;
    const newImg: GeneratedImage = {
      id: imageId,
      url: "",
      prompt: "",
      model: selectedModelId,
      size: selectedSize,
      providerId: selectedProviderId,
      providerName: selectedProvider?.name || "",
      createdAt: Date.now(),
      status: "pending",
    };

    setImages((prev) => {
      const updated = [newImg, ...prev];
      saveHistory(updated);
      return updated;
    });
    setSelectedImageId(imageId);
  }, [
    selectedModelId,
    selectedSize,
    selectedProviderId,
    selectedProvider,
    saveHistory,
  ]);

  return {
    // Provider 相关
    availableProviders,
    selectedProvider,
    selectedProviderId,
    setSelectedProviderId: handleProviderChange,
    providersLoading,

    // 模型相关
    availableModels,
    selectedModel,
    selectedModelId,
    setSelectedModelId,

    // 尺寸相关
    selectedSize,
    setSelectedSize,

    // 图片相关
    images,
    selectedImage,
    selectedImageId,
    setSelectedImageId,
    generating,

    // 操作
    generateImage,
    deleteImage,
    newImage,
  };
}
