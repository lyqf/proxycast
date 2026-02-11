/**
 * @file 图片生成页面
 * @description 对齐成熟产品风格的绘画工作台布局与交互
 * @module components/image-gen/ImageGenPage
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import {
  Home,
  Image as ImageIcon,
  ImagePlus,
  Loader2,
  Send,
  Settings,
  Sparkles,
  Trash2,
  ExternalLink,
  X,
} from "lucide-react";
import { useImageGen } from "./useImageGen";
import type { GeneratedImage } from "./types";
import type { Page } from "@/types/page";

interface ImageGenPageProps {
  onNavigate?: (page: Page) => void;
}

type ResolutionPreset = "1k" | "2k" | "4k";

interface ReferenceImageItem {
  id: string;
  name: string;
  url: string;
}

const RESOLUTION_OPTIONS: Array<{
  label: string;
  value: ResolutionPreset;
  longEdge: number;
}> = [
  { label: "1K", value: "1k", longEdge: 1024 },
  { label: "2K", value: "2k", longEdge: 2048 },
  { label: "4K", value: "4k", longEdge: 4096 },
];

const ASPECT_RATIO_OPTIONS = [
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "9:16",
  "5:4",
  "4:5",
  "16:9",
  "21:9",
];

const IMAGE_COUNT_PRESETS = [1, 2, 4, 8];

const FALLBACK_SUPPORTED_SIZES = [
  "1024x1024",
  "768x1344",
  "864x1152",
  "1344x768",
  "1152x864",
];

function parseSize(size: string): { width: number; height: number } | null {
  const [rawWidth, rawHeight] = size.split("x");
  const width = Number(rawWidth);
  const height = Number(rawHeight);

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return null;
  }

  return { width, height };
}

function parseAspectRatio(ratio: string): number {
  const [rawWidth, rawHeight] = ratio.split(":");
  const width = Number(rawWidth);
  const height = Number(rawHeight);

  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return 1;
  }

  return width / height;
}

function chooseClosestSize(
  supportedSizes: string[],
  aspectRatio: string,
  resolutionPreset: ResolutionPreset,
): string {
  const candidates = supportedSizes
    .map((size) => ({
      raw: size,
      parsed: parseSize(size),
    }))
    .filter(
      (
        candidate,
      ): candidate is {
        raw: string;
        parsed: { width: number; height: number };
      } => candidate.parsed !== null,
    );

  if (candidates.length === 0) {
    return FALLBACK_SUPPORTED_SIZES[0];
  }

  const ratioValue = parseAspectRatio(aspectRatio);
  const longEdge =
    RESOLUTION_OPTIONS.find((option) => option.value === resolutionPreset)
      ?.longEdge || 1024;

  const targetWidth =
    ratioValue >= 1 ? longEdge : Math.max(1, Math.round(longEdge * ratioValue));
  const targetHeight =
    ratioValue >= 1 ? Math.max(1, Math.round(longEdge / ratioValue)) : longEdge;

  const targetArea = targetWidth * targetHeight;

  const best = candidates.reduce(
    (current, candidate) => {
      const candidateRatio = candidate.parsed.width / candidate.parsed.height;
      const candidateArea = candidate.parsed.width * candidate.parsed.height;

      const ratioScore = Math.abs(Math.log(candidateRatio / ratioValue));
      const areaScore = Math.abs(candidateArea - targetArea) / targetArea;
      const totalScore = ratioScore * 3 + areaScore;

      if (totalScore < current.score) {
        return { score: totalScore, size: candidate.raw };
      }

      return current;
    },
    { score: Number.POSITIVE_INFINITY, size: candidates[0].raw },
  );

  return best.size;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("文件读取失败"));
    };

    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

function resolveBatchImages(
  images: GeneratedImage[],
  selectedImageId: string | null,
): GeneratedImage[] {
  if (!selectedImageId) {
    return [];
  }

  const batchMatch = selectedImageId.match(/^img-(\d+)-\d+$/);
  if (!batchMatch) {
    const single = images.find((item) => item.id === selectedImageId);
    return single ? [single] : [];
  }

  const batchPrefix = `img-${batchMatch[1]}-`;
  return images
    .filter((item) => item.id.startsWith(batchPrefix))
    .sort((left, right) => left.createdAt - right.createdAt);
}

function getStatusText(status: GeneratedImage["status"]): string {
  switch (status) {
    case "complete":
      return "已完成";
    case "error":
      return "失败";
    case "generating":
      return "生成中";
    default:
      return "待生成";
  }
}

const Container = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
`;

const PageLayout = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: hsl(var(--background));
`;

const HeaderBar = styled.div`
  display: flex;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--background));
`;

const BackButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid hsl(var(--border));
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: hsl(var(--accent));
    border-color: hsl(var(--accent));
  }
`;

const ControlPanel = styled.aside`
  width: 280px;
  min-width: 280px;
  padding: 16px 12px;
  border-right: 1px solid hsl(var(--border));
  background: hsl(var(--card) / 0.4);
  overflow-y: auto;
`;

const Section = styled.section`
  margin-bottom: 18px;
`;

const SectionTitle = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: hsl(var(--foreground));
`;

const Hint = styled.div`
  margin-top: 6px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
`;

const Select = styled.select`
  width: 100%;
  height: 38px;
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
  background: hsl(var(--background));
  padding: 0 10px;
  font-size: 14px;
  color: hsl(var(--foreground));

  &:focus {
    outline: none;
    border-color: hsl(var(--primary));
  }
`;

const SmallButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--background));
  color: hsl(var(--muted-foreground));
  cursor: pointer;

  &:hover {
    color: hsl(var(--foreground));
    border-color: hsl(var(--primary) / 0.4);
  }
`;

const UploadBox = styled.div<{ $dragging: boolean }>`
  border: 1px dashed
    ${({ $dragging }) =>
      $dragging ? "hsl(var(--primary))" : "hsl(var(--border))"};
  border-radius: 12px;
  min-height: 108px;
  background: ${({ $dragging }) =>
    $dragging ? "hsl(var(--primary) / 0.06)" : "hsl(var(--muted) / 0.2)"};
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 10px;
  cursor: pointer;
`;

const UploadText = styled.div`
  font-size: 12px;
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
`;

const Thumbs = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
`;

const ThumbItem = styled.div`
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  aspect-ratio: 1;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const RemoveThumb = styled.button`
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 999px;
  background: hsl(var(--background) / 0.9);
  color: hsl(var(--destructive));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
`;

const Segment = styled.div`
  display: flex;
  gap: 6px;
`;

const SegmentButton = styled.button<{ $active: boolean }>`
  flex: 1;
  height: 30px;
  border-radius: 8px;
  border: 1px solid
    ${({ $active }) => ($active ? "hsl(var(--primary))" : "transparent")};
  background: ${({ $active }) =>
    $active ? "hsl(var(--background))" : "hsl(var(--muted) / 0.35)"};
  color: ${({ $active }) =>
    $active ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))"};
  font-size: 13px;
  cursor: pointer;
`;

const RatioGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
`;

const RatioButton = styled.button<{ $active: boolean }>`
  height: 44px;
  border-radius: 8px;
  border: 1px solid
    ${({ $active }) => ($active ? "hsl(var(--primary))" : "hsl(var(--border))")};
  background: ${({ $active }) =>
    $active ? "hsl(var(--primary) / 0.08)" : "hsl(var(--background))"};
  color: ${({ $active }) =>
    $active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"};
  font-size: 12px;
  font-weight: ${({ $active }) => ($active ? 600 : 500)};
  cursor: pointer;
`;

const CountRow = styled.div`
  display: flex;
  gap: 6px;
`;

const CountButton = styled.button<{ $active: boolean }>`
  flex: 1;
  height: 30px;
  border-radius: 8px;
  border: 1px solid
    ${({ $active }) => ($active ? "hsl(var(--primary))" : "transparent")};
  background: ${({ $active }) =>
    $active ? "hsl(var(--background))" : "hsl(var(--muted) / 0.35)"};
  color: ${({ $active }) =>
    $active ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))"};
  font-size: 13px;
  cursor: pointer;
`;

const CountInput = styled.input`
  width: 100%;
  height: 32px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--background));
  padding: 0 10px;
  font-size: 13px;

  &:focus {
    outline: none;
    border-color: hsl(var(--primary));
  }
`;

const Workspace = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  padding: 14px;
`;

const Canvas = styled.div`
  flex: 1;
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
  background: hsl(var(--background));
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
`;

const Empty = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: hsl(var(--muted-foreground));

  h2 {
    margin: 0;
    font-size: 48px;
    font-weight: 700;
    letter-spacing: 2px;
    color: hsl(var(--foreground));
  }
`;

const PreviewImage = styled.img`
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
`;

const BatchGrid = styled.div`
  width: 100%;
  height: 100%;
  padding: 12px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  align-content: start;
  overflow: auto;
`;

const BatchItem = styled.button<{ $active: boolean }>`
  border: 1px solid
    ${({ $active }) => ($active ? "hsl(var(--primary))" : "hsl(var(--border))")};
  border-radius: 10px;
  background: hsl(var(--background));
  cursor: pointer;
  display: flex;
  flex-direction: column;
  padding: 8px;
  gap: 8px;
`;

const BatchPreviewWrap = styled.div`
  border-radius: 8px;
  background: hsl(var(--muted) / 0.25);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
`;

const BatchPlaceholder = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  color: hsl(var(--muted-foreground));
`;

const BatchMeta = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
`;

const CanvasActions = styled.div`
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 8px;
`;

const CanvasActionButton = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid hsl(var(--border));
  background: hsl(var(--background) / 0.92);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: hsl(var(--muted-foreground));
  cursor: pointer;

  &:hover {
    color: hsl(var(--foreground));
  }
`;

const PromptDock = styled.div`
  width: 78%;
  max-width: 860px;
  min-width: 520px;
  margin: 12px auto 0;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
  padding: 10px;
  display: flex;
  align-items: flex-end;
  gap: 10px;

  @media (max-width: 1100px) {
    width: 90%;
    min-width: 0;
  }
`;

const PromptInput = styled.textarea`
  flex: 1;
  min-height: 44px;
  max-height: 140px;
  border: none;
  resize: none;
  background: transparent;
  font-size: 14px;
  line-height: 1.5;
  color: hsl(var(--foreground));
  padding: 8px;
  font-family: inherit;

  &:focus {
    outline: none;
  }

  &::placeholder {
    color: hsl(var(--muted-foreground));
  }
`;

const GenerateButton = styled.button<{ $disabled: boolean }>`
  width: 52px;
  height: 52px;
  border: none;
  border-radius: 12px;
  background: ${({ $disabled }) =>
    $disabled ? "hsl(var(--muted))" : "hsl(var(--primary))"};
  color: ${({ $disabled }) =>
    $disabled
      ? "hsl(var(--muted-foreground))"
      : "hsl(var(--primary-foreground))"};
  cursor: ${({ $disabled }) => ($disabled ? "not-allowed" : "pointer")};
  display: inline-flex;
  align-items: center;
  justify-content: center;
`;

const Status = styled.div`
  margin-top: 8px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
`;

export function ImageGenPage({ onNavigate }: ImageGenPageProps) {
  const {
    availableProviders,
    selectedProvider,
    selectedProviderId,
    setSelectedProviderId,
    providersLoading,
    availableModels,
    selectedModel,
    selectedModelId,
    setSelectedModelId,
    selectedSize,
    setSelectedSize,
    images,
    selectedImage,
    selectedImageId,
    setSelectedImageId,
    generating,
    generateImage,
    deleteImage,
  } = useImageGen();

  const [prompt, setPrompt] = useState("");
  const [resolutionPreset, setResolutionPreset] =
    useState<ResolutionPreset>("1k");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [imageCount, setImageCount] = useState(1);
  const [isEditingCustomCount, setIsEditingCustomCount] = useState(false);
  const [customCountInput, setCustomCountInput] = useState("");
  const [referenceImages, setReferenceImages] = useState<ReferenceImageItem[]>(
    [],
  );
  const [isDraggingUpload, setIsDraggingUpload] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const supportedSizes = useMemo(() => {
    return selectedModel?.supportedSizes || FALLBACK_SUPPORTED_SIZES;
  }, [selectedModel]);

  const resolvedSize = useMemo(() => {
    return chooseClosestSize(supportedSizes, aspectRatio, resolutionPreset);
  }, [supportedSizes, aspectRatio, resolutionPreset]);

  useEffect(() => {
    if (resolvedSize !== selectedSize) {
      setSelectedSize(resolvedSize);
    }
  }, [resolvedSize, selectedSize, setSelectedSize]);

  const canGenerate =
    !!prompt.trim() && !!selectedProvider && !!selectedModelId && !generating;

  const selectedBatchImages = useMemo(() => {
    return resolveBatchImages(images, selectedImageId);
  }, [images, selectedImageId]);

  const shouldShowBatchGrid = selectedBatchImages.length > 1;

  const handleCountSelect = (count: number) => {
    setImageCount(count);
    setIsEditingCustomCount(false);
  };

  const handleCustomCountConfirm = () => {
    const next = Number(customCountInput);
    if (!Number.isFinite(next)) return;
    const normalized = Math.max(1, Math.min(8, Math.floor(next)));
    setImageCount(normalized);
    setIsEditingCustomCount(false);
    setCustomCountInput("");
  };

  const handleReferenceFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const remain = Math.max(0, 3 - referenceImages.length);
    if (remain === 0) return;

    const selectedFiles = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, remain);

    if (selectedFiles.length === 0) return;

    const loaded = await Promise.all(
      selectedFiles.map(async (file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        url: await fileToDataUrl(file),
      })),
    );

    setReferenceImages((prev) => [...prev, ...loaded].slice(0, 3));
  };

  const handleUploadChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    await handleReferenceFiles(event.target.files);
    event.target.value = "";
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;

    try {
      await generateImage(prompt.trim(), {
        imageCount,
        referenceImages: referenceImages.map((item) => item.url),
        size: resolvedSize,
      });
      setPrompt("");
    } catch (error) {
      console.error("图片生成失败:", error);
    }
  };

  const handlePromptKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleGenerate();
    }
  };

  const goCredentialManagement = () => {
    onNavigate?.("provider-pool");
  };

  const goHome = () => {
    onNavigate?.("agent");
  };

  return (
    <PageLayout>
      <HeaderBar>
        <BackButton onClick={goHome}>
          <Home size={16} />
          返回首页
        </BackButton>
      </HeaderBar>

      <Container>
        <ControlPanel>
          {availableProviders.length > 1 && (
            <Section>
              <SectionTitle>服务商</SectionTitle>
              <Select
                value={selectedProviderId || availableProviders[0]?.id || ""}
                onChange={(event) => setSelectedProviderId(event.target.value)}
                disabled={providersLoading}
              >
                {availableProviders.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </Select>
            </Section>
          )}

          <Section>
            <SectionTitle>
              模型
              <SmallButton onClick={goCredentialManagement} title="去凭证管理">
                <Settings size={14} />
              </SmallButton>
            </SectionTitle>
            <Select
              value={selectedModelId || availableModels[0]?.id || ""}
              onChange={(event) => setSelectedModelId(event.target.value)}
              disabled={!selectedProvider || availableModels.length === 0}
            >
              {availableModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </Select>
            <Hint>当前服务商：{selectedProvider?.name || "未选择"}</Hint>
          </Section>

          <Section>
            <SectionTitle>参考图</SectionTitle>
            {referenceImages.length > 0 ? (
              <Thumbs>
                {referenceImages.map((item) => (
                  <ThumbItem key={item.id} title={item.name}>
                    <img src={item.url} alt={item.name} />
                    <RemoveThumb
                      onClick={() => {
                        setReferenceImages((prev) =>
                          prev.filter((current) => current.id !== item.id),
                        );
                      }}
                    >
                      <X size={12} />
                    </RemoveThumb>
                  </ThumbItem>
                ))}
              </Thumbs>
            ) : (
              <UploadBox
                $dragging={isDraggingUpload}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDraggingUpload(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setIsDraggingUpload(false);
                }}
                onDrop={async (event) => {
                  event.preventDefault();
                  setIsDraggingUpload(false);
                  await handleReferenceFiles(event.dataTransfer.files);
                }}
              >
                <UploadText>
                  <ImagePlus size={24} style={{ marginBottom: 6 }} />
                  <div>点击或拖拽上传图片</div>
                  <div>支持最多 3 张图片</div>
                </UploadText>
              </UploadBox>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={handleUploadChange}
            />
          </Section>

          <Section>
            <SectionTitle>分辨率</SectionTitle>
            <Segment>
              {RESOLUTION_OPTIONS.map((option) => (
                <SegmentButton
                  key={option.value}
                  $active={resolutionPreset === option.value}
                  onClick={() => setResolutionPreset(option.value)}
                >
                  {option.label}
                </SegmentButton>
              ))}
            </Segment>
          </Section>

          <Section>
            <SectionTitle>宽高比</SectionTitle>
            <RatioGrid>
              {ASPECT_RATIO_OPTIONS.map((ratio) => (
                <RatioButton
                  key={ratio}
                  $active={aspectRatio === ratio}
                  onClick={() => setAspectRatio(ratio)}
                >
                  {ratio}
                </RatioButton>
              ))}
            </RatioGrid>
          </Section>

          <Section>
            <SectionTitle>图片数量</SectionTitle>
            {isEditingCustomCount ? (
              <CountInput
                type="number"
                min={1}
                max={8}
                value={customCountInput}
                onChange={(event) => setCustomCountInput(event.target.value)}
                onBlur={handleCustomCountConfirm}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleCustomCountConfirm();
                  }
                }}
                autoFocus
              />
            ) : (
              <CountRow>
                {IMAGE_COUNT_PRESETS.map((count) => (
                  <CountButton
                    key={count}
                    $active={imageCount === count}
                    onClick={() => handleCountSelect(count)}
                  >
                    {count}
                  </CountButton>
                ))}
                <CountButton
                  $active={!IMAGE_COUNT_PRESETS.includes(imageCount)}
                  onClick={() => {
                    setCustomCountInput(String(imageCount));
                    setIsEditingCustomCount(true);
                  }}
                >
                  +
                </CountButton>
              </CountRow>
            )}
          </Section>

          <Status>实际输出尺寸：{resolvedSize}</Status>
        </ControlPanel>

        <Workspace>
          <Canvas>
            {shouldShowBatchGrid ? (
              <BatchGrid>
                {selectedBatchImages.map((item, index) => {
                  const parsedSize = parseSize(item.size);
                  const previewStyle = parsedSize
                    ? {
                        aspectRatio: `${parsedSize.width}/${parsedSize.height}`,
                      }
                    : undefined;

                  return (
                    <BatchItem
                      key={item.id}
                      $active={item.id === selectedImageId}
                      onClick={() => setSelectedImageId(item.id)}
                    >
                      <BatchPreviewWrap style={previewStyle}>
                        {item.status === "complete" && item.url ? (
                          <img
                            src={item.url}
                            alt={item.prompt || `生成图片 ${index + 1}`}
                          />
                        ) : (
                          <BatchPlaceholder>
                            {item.status === "error" ? (
                              <ImageIcon size={28} />
                            ) : (
                              <Loader2 size={28} className="animate-spin" />
                            )}
                            <span>{getStatusText(item.status)}</span>
                          </BatchPlaceholder>
                        )}
                      </BatchPreviewWrap>

                      <BatchMeta>
                        <span>第 {index + 1} 张</span>
                        <span>{getStatusText(item.status)}</span>
                      </BatchMeta>
                    </BatchItem>
                  );
                })}
              </BatchGrid>
            ) : selectedImage?.status === "complete" && selectedImage.url ? (
              <>
                <PreviewImage
                  src={selectedImage.url}
                  alt={selectedImage.prompt}
                />
                <CanvasActions>
                  <CanvasActionButton
                    title="在浏览器打开"
                    onClick={() => window.open(selectedImage.url, "_blank")}
                  >
                    <ExternalLink size={16} />
                  </CanvasActionButton>
                  <CanvasActionButton
                    title="删除"
                    onClick={() => deleteImage(selectedImage.id)}
                  >
                    <Trash2 size={16} />
                  </CanvasActionButton>
                </CanvasActions>
              </>
            ) : selectedImage?.status === "error" ? (
              <Empty>
                <ImageIcon size={52} />
                <h2 style={{ fontSize: 28, letterSpacing: 0 }}>生成失败</h2>
                <div>{selectedImage.error || "请重试"}</div>
              </Empty>
            ) : (
              <Empty>
                {generating || selectedImage?.status === "generating" ? (
                  <Loader2 size={56} className="animate-spin" />
                ) : (
                  <Sparkles size={56} />
                )}
                <h2>绘画</h2>
              </Empty>
            )}

            {shouldShowBatchGrid &&
              selectedImage?.status === "complete" &&
              selectedImage.url && (
                <CanvasActions>
                  <CanvasActionButton
                    title="在浏览器打开"
                    onClick={() => window.open(selectedImage.url, "_blank")}
                  >
                    <ExternalLink size={16} />
                  </CanvasActionButton>
                  <CanvasActionButton
                    title="删除"
                    onClick={() => deleteImage(selectedImage.id)}
                  >
                    <Trash2 size={16} />
                  </CanvasActionButton>
                </CanvasActions>
              )}
          </Canvas>

          <PromptDock>
            <PromptInput
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={handlePromptKeyDown}
              placeholder="描述你想要生成的内容"
              disabled={!selectedProvider || !selectedModelId || generating}
            />
            <GenerateButton
              $disabled={!canGenerate}
              onClick={handleGenerate}
              disabled={!canGenerate}
              title={generating ? "生成中" : "开始生成"}
            >
              {generating ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Send size={20} />
              )}
            </GenerateButton>
          </PromptDock>

          {!selectedProvider && (
            <Status>
              当前没有可用绘画服务，请先到凭证管理添加可用 Provider。
            </Status>
          )}
        </Workspace>
      </Container>
    </PageLayout>
  );
}

export default ImageGenPage;
