/**
 * @file 图片生成页面
 * @description AI 图片生成功能主页面，复用凭证池的 API Key Provider
 * @module components/image-gen/ImageGenPage
 */

import React, { useState, useEffect, useRef } from "react";
import styled, { css, keyframes } from "styled-components";
import {
  Plus,
  ChevronDown,
  Image as ImageIcon,
  Loader2,
  Trash2,
  ExternalLink,
  Send,
  Settings,
  Sparkles,
  Command,
  LayoutTemplate,
  Maximize2,
  Wand2,
} from "lucide-react";
import { useImageGen } from "./useImageGen";
import type { Page } from "@/types/page";

interface ImageGenPageProps {
  onNavigate?: (page: Page) => void;
}

// --- Animations ---
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

// --- Styled Components ---

const Container = styled.div`
  display: flex;
  height: 100%;
  background: radial-gradient(
    circle at 30% 20%,
    hsl(var(--muted) / 0.3) 0%,
    hsl(var(--background)) 70%
  );
  color: hsl(var(--foreground));
  overflow: hidden;
  font-family:
    -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto,
    sans-serif;
  position: relative;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      hsl(var(--border) / 0.5),
      transparent
    );
    z-index: 10;
  }
`;

const Sidebar = styled.div`
  width: 300px;
  min-width: 300px;
  background: hsl(var(--card) / 0.3);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-right: 1px solid hsl(var(--border) / 0.4);
  display: flex;
  flex-direction: column;
  padding: 32px 24px;
  gap: 32px;
  z-index: 20;
  transition: transform 0.3s ease;
`;

const SidebarHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 24px;
  border-bottom: 1px solid hsl(var(--border) / 0.4);
  color: hsl(var(--foreground));
  font-weight: 700;
  font-size: 20px;
  letter-spacing: -0.5px;

  svg {
    color: hsl(var(--primary));
    filter: drop-shadow(0 2px 4px rgba(var(--primary), 0.3));
  }
`;

const SidebarSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  animation: ${fadeIn} 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;

  &:nth-child(2) {
    animation-delay: 0.1s;
  }
  &:nth-child(3) {
    animation-delay: 0.2s;
  }
  &:nth-child(4) {
    animation-delay: 0.3s;
  }
`;

const SidebarLabel = styled.div`
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: hsl(var(--muted-foreground));
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
`;

const SelectWrapper = styled.div`
  position: relative;
`;

const SelectButton = styled.button<{ $disabled?: boolean; $isOpen?: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid
    ${(props) =>
      props.$isOpen ? "hsl(var(--primary))" : "hsl(var(--border) / 0.6)"};
  border-radius: 16px;
  background: ${(props) =>
    props.$isOpen ? "hsl(var(--primary) / 0.04)" : "hsl(var(--card) / 0.5)"};
  color: ${(props) =>
    props.$disabled
      ? "hsl(var(--muted-foreground))"
      : "hsl(var(--foreground))"};
  font-size: 14px;
  font-weight: 500;
  cursor: ${(props) => (props.$disabled ? "not-allowed" : "pointer")};
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);

  &:hover:not(:disabled) {
    border-color: hsl(var(--primary) / 0.5);
    background: hsl(var(--accent) / 0.4);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
    transform: scale(0.99);
  }

  .icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 8px;
    background: hsl(var(--primary) / 0.1);
    color: hsl(var(--primary));
  }
`;

const SelectDropdown = styled.div<{ $open: boolean }>`
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 16px;
  box-shadow: 0 20px 40px -8px rgba(0, 0, 0, 0.2);
  z-index: 100;
  display: ${(props) => (props.$open ? "block" : "none")};
  max-height: 320px;
  overflow-y: auto;
  padding: 8px;
  animation: ${fadeIn} 0.2s ease;
  transform-origin: top center;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: hsl(var(--border));
    border-radius: 4px;
  }
`;

const SelectOption = styled.div<{ $selected?: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  border-radius: 10px;
  background: ${(props) =>
    props.$selected ? "hsl(var(--primary) / 0.08)" : "transparent"};
  color: ${(props) =>
    props.$selected ? "hsl(var(--primary))" : "hsl(var(--foreground))"};
  font-size: 14px;
  font-weight: ${(props) => (props.$selected ? "600" : "400")};
  transition: all 0.15s;
  margin-bottom: 2px;

  &:hover {
    background: hsl(var(--accent));
  }
`;

const IconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;

  &:hover {
    background: hsl(var(--muted));
    color: hsl(var(--foreground));
  }
`;

const MainContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  height: 100vh;
`;

const ImageDisplayArea = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  padding-bottom: 160px; // Space for prompt bar
  overflow: hidden;
`;

const ImageContainer = styled.div<{ $hasImage: boolean }>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  max-height: 100%;
  transition: all 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);

  ${(props) =>
    props.$hasImage &&
    css`
      perspective: 1000px;
      animation: ${fadeIn} 0.8s ease;

      &::before {
        content: "";
        position: absolute;
        inset: 20px;
        background: black;
        filter: blur(40px);
        opacity: 0.4;
        z-index: -1;
        border-radius: 50%;
        transform: translateY(20px) scale(0.9);
      }
    `}
`;

const GeneratedImg = styled.img`
  max-width: 100%;
  max-height: calc(100vh - 240px);
  border-radius: 20px;
  border: 1px solid hsl(var(--border) / 0.5);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  transition: transform 0.3s ease;

  &:hover {
    transform: scale(1.01);
  }
`;

const ImageActions = styled.div`
  position: absolute;
  top: 20px;
  right: 20px;
  display: flex;
  gap: 10px;
  opacity: 0;
  transform: translateY(-10px);
  transition: all 0.3s ease;

  ${ImageContainer}:hover & {
    opacity: 1;
    transform: translateY(0);
  }
`;

const ActionButton = styled.button`
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);

  &:hover {
    background: rgba(0, 0, 0, 0.7);
    transform: scale(1.1);
    box-shadow: 0 8px 12px rgba(0, 0, 0, 0.2);
  }
`;

const PromptBarContainer = styled.div`
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  width: 800px;
  max-width: 90%;
  z-index: 50;
`;

const PromptBar = styled.div`
  display: flex;
  gap: 16px;
  padding: 12px;
  padding-left: 20px;
  background: hsl(var(--card) / 0.85);
  backdrop-filter: blur(32px);
  -webkit-backdrop-filter: blur(32px);
  border: 1px solid hsl(var(--border) / 0.6);
  border-radius: 24px;
  box-shadow:
    0 10px 40px -10px rgba(0, 0, 0, 0.1),
    0 0 0 1px rgba(255, 255, 255, 0.1) inset;
  transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);

  &:focus-within {
    transform: translateY(-6px);
    box-shadow:
      0 20px 60px -10px rgba(0, 0, 0, 0.15),
      0 0 0 2px hsl(var(--primary) / 0.3);
    background: hsl(var(--card) / 0.95);
  }
`;

const PromptInput = styled.textarea`
  flex: 1;
  min-height: 44px;
  max-height: 160px;
  padding: 10px 0;
  border: none;
  background: transparent;
  color: hsl(var(--foreground));
  font-size: 16px;
  line-height: 1.5;
  resize: none;
  font-family: inherit;

  &:focus {
    outline: none;
  }

  &::placeholder {
    color: hsl(var(--muted-foreground));
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const GenerateButton = styled.button<{ $disabled?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border: none;
  border-radius: 18px;
  background: ${(props) =>
    props.$disabled ? "hsl(var(--muted))" : "hsl(var(--primary))"};
  color: ${(props) =>
    props.$disabled
      ? "hsl(var(--muted-foreground))"
      : "hsl(var(--primary-foreground))"};
  cursor: ${(props) => (props.$disabled ? "not-allowed" : "pointer")};
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: ${(props) =>
    props.$disabled ? "none" : "0 8px 20px -4px hsl(var(--primary) / 0.5)"};
  flex-shrink: 0;

  &:hover:not(:disabled) {
    transform: scale(1.08) rotate(-5deg);
    box-shadow: 0 12px 24px -6px hsl(var(--primary) / 0.6);
  }

  &:active:not(:disabled) {
    transform: scale(0.92);
  }
`;

const HistorySidebar = styled.div`
  width: 90px;
  min-width: 90px;
  background: hsl(var(--card) / 0.35);
  backdrop-filter: blur(24px);
  border-left: 1px solid hsl(var(--border) / 0.4);
  display: flex;
  flex-direction: column;
  padding: 20px 0;
  gap: 20px;
  align-items: center;
  z-index: 20;
`;

const NewImageButton = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border: 1px dashed hsl(var(--border) / 0.8);
  border-radius: 18px;
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    border-color: hsl(var(--primary));
    color: hsl(var(--primary));
    background: hsl(var(--primary) / 0.08);
    background: hsl(var(--primary) / 0.08);
    transform: scale(1.05);
  }
`;

const HistoryList = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  width: 100%;
  align-items: center;
  padding-bottom: 20px;

  &::-webkit-scrollbar {
    display: none;
  }
`;

const HistoryItemDeleteBtn = styled.button`
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: hsl(var(--card) / 0.8);
  border: 1px solid hsl(var(--destructive) / 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  color: hsl(var(--destructive));
  opacity: 0;
  transform: scale(0.8);
  transition: all 0.2s;
  z-index: 20;
  cursor: pointer;

  &:hover {
    background: hsl(var(--destructive));
    color: white;
    transform: scale(1.1);
  }
`;

const HistoryItem = styled.div<{ $selected?: boolean }>`
  width: 56px;
  height: 56px;
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  position: relative;
  border: 2px solid
    ${(props) => (props.$selected ? "hsl(var(--primary))" : "transparent")};
  transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  flex-shrink: 0;

  &:hover {
    transform: scale(1.1);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
    z-index: 10;
  }

  &:hover ${HistoryItemDeleteBtn} {
    opacity: 1;
    transform: scale(1);
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.4s;
  }

  &:hover img {
    transform: scale(1.1);
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  color: hsl(var(--muted-foreground));
  text-align: center;
  max-width: 480px;
  padding: 40px;
  background: hsl(var(--card) / 0.4);
  backdrop-filter: blur(10px);
  border-radius: 32px;
  border: 1px solid hsl(var(--border) / 0.4);
  box-shadow: 0 20px 60px -20px rgba(0, 0, 0, 0.1);
  animation: ${fadeIn} 0.8s ease;

  h3 {
    font-size: 24px;
    font-weight: 700;
    color: hsl(var(--foreground));
    margin: 0;
  }

  p {
    margin: 0;
    line-height: 1.6;
    font-size: 16px;
  }
`;

const LoaderWrapper = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: hsl(var(--muted) / 0.5);
  animation: pulse 2s infinite;

  @keyframes pulse {
    0% {
      opacity: 0.6;
    }
    50% {
      opacity: 1;
    }
    100% {
      opacity: 0.6;
    }
  }
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
    newImage,
  } = useImageGen();

  const [prompt, setPrompt] = useState("");
  const [providerDropdownOpen, setProviderDropdownOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [sizeDropdownOpen, setSizeDropdownOpen] = useState(false);

  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const providerRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (promptInputRef.current) {
      promptInputRef.current.style.height = "auto"; // Reset height
      // Cap max height in JS if needed, but CSS max-height handles it visually.
      // We just want it to grow.
      promptInputRef.current.style.height = `${Math.min(promptInputRef.current.scrollHeight, 160)}px`;
    }
  }, [prompt]);

  const handleNewImage = () => {
    newImage();
    setPrompt("");
    setTimeout(() => {
      promptInputRef.current?.focus();
    }, 100);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        providerRef.current &&
        !providerRef.current.contains(event.target as Node)
      ) {
        setProviderDropdownOpen(false);
      }
      if (
        modelRef.current &&
        !modelRef.current.contains(event.target as Node)
      ) {
        setModelDropdownOpen(false);
      }
      if (sizeRef.current && !sizeRef.current.contains(event.target as Node)) {
        setSizeDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const supportedSizes = selectedModel?.supportedSizes || [
    "1024x1024",
    "768x1344",
    "864x1152",
    "1344x768",
    "1152x864",
  ];

  const handleGenerate = async () => {
    if (!prompt.trim() || generating || !selectedProvider) return;
    try {
      await generateImage(prompt.trim());
      setPrompt("");
    } catch (error) {
      console.error("Generate failed:", error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const openInBrowser = (url: string) => {
    window.open(url, "_blank");
  };

  const goToProviderPool = () => {
    onNavigate?.("provider-pool");
  };

  return (
    <Container>
      <Sidebar>
        <SidebarHeader>
          <Sparkles size={24} fill="currentColor" />
          <span>图片工坊</span>
        </SidebarHeader>

        <SidebarSection>
          <SidebarLabel>
            提供商
            <IconButton onClick={goToProviderPool} title="管理提供商">
              <Settings size={14} />
            </IconButton>
          </SidebarLabel>
          <SelectWrapper ref={providerRef}>
            <SelectButton
              onClick={() => setProviderDropdownOpen(!providerDropdownOpen)}
              $disabled={providersLoading}
              $isOpen={providerDropdownOpen}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  overflow: "hidden",
                }}
              >
                <div className="icon-wrapper">
                  <Command size={14} />
                </div>
                <span className="truncate">
                  {selectedProvider?.name || "选择提供商"}
                </span>
              </div>
              <ChevronDown size={14} className="opacity-50" />
            </SelectButton>
            <SelectDropdown $open={providerDropdownOpen}>
              {availableProviders.map((provider) => (
                <SelectOption
                  key={provider.id}
                  $selected={provider.id === selectedProviderId}
                  onClick={() => {
                    setSelectedProviderId(provider.id);
                    setProviderDropdownOpen(false);
                  }}
                >
                  {provider.name}
                </SelectOption>
              ))}
              {availableProviders.length === 0 && (
                <div
                  style={{
                    padding: "12px",
                    textAlign: "center",
                    fontSize: "12px",
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  暂无可用提供商
                </div>
              )}
            </SelectDropdown>
          </SelectWrapper>
        </SidebarSection>

        <SidebarSection>
          <SidebarLabel>模型</SidebarLabel>
          <SelectWrapper ref={modelRef}>
            <SelectButton
              onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
              $disabled={!selectedProvider}
              $isOpen={modelDropdownOpen}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  overflow: "hidden",
                }}
              >
                <div className="icon-wrapper">
                  <LayoutTemplate size={14} />
                </div>
                <span className="truncate">
                  {selectedModel?.name || "选择模型"}
                </span>
              </div>
              <ChevronDown size={14} className="opacity-50" />
            </SelectButton>
            <SelectDropdown $open={modelDropdownOpen}>
              {availableModels.map((model) => (
                <SelectOption
                  key={model.id}
                  $selected={model.id === selectedModelId}
                  onClick={() => {
                    setSelectedModelId(model.id);
                    setModelDropdownOpen(false);
                  }}
                >
                  {model.name}
                </SelectOption>
              ))}
            </SelectDropdown>
          </SelectWrapper>
        </SidebarSection>

        <SidebarSection>
          <SidebarLabel>图片尺寸</SidebarLabel>
          <SelectWrapper ref={sizeRef}>
            <SelectButton
              onClick={() => setSizeDropdownOpen(!sizeDropdownOpen)}
              $isOpen={sizeDropdownOpen}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <div className="icon-wrapper">
                  <Maximize2 size={14} />
                </div>
                <span>
                  {selectedSize === "1024x1024" ? "方形 (1:1)" : selectedSize}
                </span>
              </div>
              <ChevronDown size={14} className="opacity-50" />
            </SelectButton>
            <SelectDropdown $open={sizeDropdownOpen}>
              {supportedSizes.map((size) => (
                <SelectOption
                  key={size}
                  $selected={size === selectedSize}
                  onClick={() => {
                    setSelectedSize(size);
                    setSizeDropdownOpen(false);
                  }}
                >
                  {size === "1024x1024" ? "方形 (1024x1024)" : size}
                </SelectOption>
              ))}
            </SelectDropdown>
          </SelectWrapper>
        </SidebarSection>
      </Sidebar>

      <MainContent>
        <ImageDisplayArea>
          {selectedImage?.status === "generating" ? (
            <ImageContainer $hasImage={false}>
              <EmptyState>
                <Loader2 size={48} className="animate-spin text-primary" />
                <h3>正在精心绘制...</h3>
                <p>将您的想象转化为像素...</p>
              </EmptyState>
            </ImageContainer>
          ) : selectedImage?.status === "complete" && selectedImage.url ? (
            <ImageContainer $hasImage={true}>
              <GeneratedImg
                src={selectedImage.url}
                alt={selectedImage.prompt}
              />
              <ImageActions>
                <ActionButton
                  onClick={() => openInBrowser(selectedImage.url)}
                  title="在浏览器中打开"
                >
                  <ExternalLink size={18} />
                </ActionButton>
                <ActionButton
                  onClick={() => deleteImage(selectedImage.id)}
                  title="删除"
                >
                  <Trash2 size={18} />
                </ActionButton>
              </ImageActions>
            </ImageContainer>
          ) : selectedImage?.status === "error" ? (
            <EmptyState>
              <div
                style={{ color: "hsl(var(--destructive))", marginBottom: 8 }}
              >
                <Wand2 size={40} />
              </div>
              <h3>生成失败</h3>
              <p style={{ color: "hsl(var(--destructive))" }}>
                {selectedImage.error}
              </p>
            </EmptyState>
          ) : (
            <EmptyState>
              <Wand2 size={56} className="text-primary opacity-80" />
              <h3>准备就绪</h3>
              <p>在下方输入详细的提示词以开始创作。</p>
            </EmptyState>
          )}
        </ImageDisplayArea>

        <PromptBarContainer>
          <PromptBar>
            <PromptInput
              ref={promptInputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="描述你想要生成的图片（例如：'赛博朋克风格的未来城市，日落时分，飞车穿梭，高细节'）..."
              disabled={generating || !selectedProvider}
            />
            <GenerateButton
              onClick={handleGenerate}
              $disabled={generating || !prompt.trim() || !selectedProvider}
              disabled={generating || !prompt.trim() || !selectedProvider}
            >
              {generating ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <Send size={24} />
              )}
            </GenerateButton>
          </PromptBar>
        </PromptBarContainer>
      </MainContent>

      <HistorySidebar>
        <NewImageButton onClick={handleNewImage} title="新建图片">
          <Plus size={24} />
        </NewImageButton>

        <div
          style={{
            width: "40px",
            height: "1px",
            background: "hsl(var(--border))",
            opacity: 0.5,
          }}
        />

        <HistoryList>
          {images.map((img) => (
            <HistoryItem
              key={img.id}
              $selected={img.id === selectedImageId}
              onClick={() => setSelectedImageId(img.id)}
            >
              {img.status === "generating" ? (
                <LoaderWrapper>
                  <Loader2 size={16} className="animate-spin" />
                </LoaderWrapper>
              ) : img.status === "complete" && img.url ? (
                <img src={img.url} alt={img.prompt} />
              ) : (
                <LoaderWrapper>
                  <ImageIcon size={16} />
                </LoaderWrapper>
              )}
              {img.status !== "generating" && (
                <HistoryItemDeleteBtn
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteImage(img.id);
                  }}
                  title="删除"
                >
                  <Trash2 size={10} />
                </HistoryItemDeleteBtn>
              )}
            </HistoryItem>
          ))}
        </HistoryList>
      </HistorySidebar>
    </Container>
  );
}
