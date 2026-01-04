/**
 * 初次安装引导 - 欢迎页
 */

import styled from "styled-components";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 48px 24px;
`;

const LogoContainer = styled.div`
  width: 96px;
  height: 96px;
  margin-bottom: 32px;
  animation: float 3s ease-in-out infinite;

  @keyframes float {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-10px);
    }
  }
`;

const Logo = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
`;

const Title = styled.h1`
  font-size: 32px;
  font-weight: 700;
  color: hsl(var(--foreground));
  margin-bottom: 12px;
`;

const Subtitle = styled.p`
  font-size: 18px;
  color: hsl(var(--muted-foreground));
  margin-bottom: 8px;
`;

const Description = styled.p`
  font-size: 14px;
  color: hsl(var(--muted-foreground));
  max-width: 400px;
  line-height: 1.6;
  margin-bottom: 48px;
`;

const FeatureList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 48px;
  text-align: left;
`;

const FeatureItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  color: hsl(var(--muted-foreground));
  font-size: 14px;

  svg {
    width: 16px;
    height: 16px;
    color: hsl(var(--primary));
    flex-shrink: 0;
  }
`;

interface WelcomeStepProps {
  onNext: () => void;
  onSkip: () => void;
}

export function WelcomeStep({ onNext, onSkip }: WelcomeStepProps) {
  return (
    <Container>
      <LogoContainer>
        <Logo src="/logo.png" alt="ProxyCast" />
      </LogoContainer>

      <Title>欢迎使用 ProxyCast</Title>
      <Subtitle>AI API 聚合代理</Subtitle>
      <Description>
        让我们花一分钟时间，根据您的使用场景推荐合适的插件，提升您的使用体验。
      </Description>

      <FeatureList>
        <FeatureItem>
          <Sparkles />
          <span>多凭证池管理，自动轮换</span>
        </FeatureItem>
        <FeatureItem>
          <Sparkles />
          <span>支持 Claude、OpenAI、Gemini 等主流 API</span>
        </FeatureItem>
        <FeatureItem>
          <Sparkles />
          <span>插件扩展，按需安装</span>
        </FeatureItem>
      </FeatureList>

      <div className="flex gap-4">
        <Button variant="outline" onClick={onSkip}>
          跳过引导
        </Button>
        <Button onClick={onNext}>开始设置</Button>
      </div>
    </Container>
  );
}
