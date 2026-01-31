/**
 * 初次安装引导 - 主向导组件
 */

import { useState, useCallback, useEffect } from "react";
import styled from "styled-components";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { WelcomeStep } from "./steps/WelcomeStep";
import { UserProfileStep } from "./steps/UserProfileStep";
import { PluginSelectStep } from "./steps/PluginSelectStep";
import {
  InstallProgressStep,
  type PluginInstallState,
} from "./steps/InstallProgressStep";
import { VoiceShortcutTestStep } from "./steps/VoiceShortcutTestStep";
import { MicrophoneTestStep } from "./steps/MicrophoneTestStep";
import { VoiceDemoStep } from "./steps/VoiceDemoStep";
import { CompleteStep } from "./steps/CompleteStep";
import { userProfiles, type UserProfile } from "./constants";

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: hsl(var(--background));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 100;
`;

const Container = styled.div`
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: hsl(var(--card));
  border-radius: 16px;
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.25),
    0 0 0 1px hsl(var(--border));
  overflow: hidden;
`;

const StepIndicator = styled.div`
  display: flex;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  border-bottom: 1px solid hsl(var(--border));
`;

const StepDot = styled.div<{ $active: boolean; $completed: boolean }>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${({ $active, $completed }) =>
    $active
      ? "hsl(var(--primary))"
      : $completed
        ? "hsl(var(--primary) / 0.5)"
        : "hsl(var(--muted))"};
  transition: all 0.2s;
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
`;

const Footer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-top: 1px solid hsl(var(--border));
  background: hsl(var(--card));
`;

const FooterLeft = styled.div``;

const FooterRight = styled.div`
  display: flex;
  gap: 12px;
`;

const TOTAL_STEPS = 8;

interface OnboardingWizardProps {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [selectedPlugins, setSelectedPlugins] = useState<string[]>([]);
  const [installResults, setInstallResults] = useState<PluginInstallState[]>(
    [],
  );
  const [voiceShortcut, setVoiceShortcut] = useState(
    "CommandOrControl+Shift+V",
  );
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  // 加载语音配置
  useEffect(() => {
    (async () => {
      try {
        const { getVoiceInputConfig } = await import("@/lib/api/asrProvider");
        const config = await getVoiceInputConfig();
        setVoiceShortcut(config.shortcut);
        setVoiceEnabled(config.enabled);
      } catch (err) {
        console.error("加载语音配置失败:", err);
      }
    })();
  }, []);

  // 当用户选择群体时，自动选中默认插件
  useEffect(() => {
    if (userProfile) {
      const profile = userProfiles.find((p) => p.id === userProfile);
      if (profile) {
        setSelectedPlugins(profile.defaultPlugins);
      }
    }
  }, [userProfile]);

  const handleNext = useCallback(() => {
    if (currentStep < TOTAL_STEPS) {
      // 如果没有选择插件，跳过安装步骤
      if (currentStep === 3 && selectedPlugins.length === 0) {
        // 跳到语音快捷键测试（如果语音功能启用）或完成页
        setCurrentStep(voiceEnabled ? 5 : 8);
      } else if (currentStep === 4) {
        // 安装完成后，跳到语音快捷键测试（如果语音功能启用）或完成页
        // 注意：这个分支不会被执行，因为 InstallProgressStep 会调用 handleInstallComplete
      } else {
        setCurrentStep((prev) => prev + 1);
      }
    }
  }, [currentStep, selectedPlugins, voiceEnabled]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      // 如果从完成页返回
      if (currentStep === 8) {
        // 返回到语音演示或插件选择
        setCurrentStep(voiceEnabled ? 7 : 3);
      } else if (currentStep === 5 && installResults.length === 0) {
        // 从语音快捷键测试返回到插件选择
        setCurrentStep(3);
      } else if (currentStep === 5 && installResults.length > 0) {
        // 已经安装过，不能返回到安装步骤
        return;
      } else {
        setCurrentStep((prev) => prev - 1);
      }
    }
  }, [currentStep, installResults, voiceEnabled]);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const handleInstallComplete = useCallback(
    (results: PluginInstallState[]) => {
      setInstallResults(results);
      // 安装完成后，跳到语音快捷键测试（如果语音功能启用）或完成页
      setCurrentStep(voiceEnabled ? 5 : 8);
    },
    [voiceEnabled],
  );

  // 语音快捷键测试成功
  const handleShortcutTestSuccess = useCallback(() => {
    setCurrentStep(6);
  }, []);

  // 麦克风测试成功
  const handleMicTestSuccess = useCallback(() => {
    setCurrentStep(7);
  }, []);

  // 语音演示完成
  const handleVoiceDemoSuccess = useCallback(() => {
    setCurrentStep(8);
  }, []);

  // 跳过语音测试
  const handleSkipVoiceTest = useCallback(() => {
    setCurrentStep(8);
  }, []);

  const handleFinish = useCallback(() => {
    // 触发插件变化事件，刷新侧边栏
    window.dispatchEvent(new CustomEvent("plugin-changed"));
    onComplete();
  }, [onComplete]);

  // 渲染当前步骤
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <WelcomeStep onNext={handleNext} onSkip={handleSkip} />;
      case 2:
        return (
          <UserProfileStep
            selectedProfile={userProfile}
            onSelect={setUserProfile}
          />
        );
      case 3:
        return (
          <PluginSelectStep
            userProfile={userProfile}
            selectedPlugins={selectedPlugins}
            onSelectionChange={setSelectedPlugins}
          />
        );
      case 4:
        return (
          <InstallProgressStep
            selectedPlugins={selectedPlugins}
            onComplete={handleInstallComplete}
          />
        );
      case 5:
        return (
          <VoiceShortcutTestStep
            shortcut={voiceShortcut}
            onSuccess={handleShortcutTestSuccess}
            onSkip={handleSkipVoiceTest}
          />
        );
      case 6:
        return (
          <MicrophoneTestStep
            onSuccess={handleMicTestSuccess}
            onSkip={handleSkipVoiceTest}
          />
        );
      case 7:
        return (
          <VoiceDemoStep
            onSuccess={handleVoiceDemoSuccess}
            onSkip={handleSkipVoiceTest}
          />
        );
      case 8:
        return (
          <CompleteStep
            installResults={installResults}
            onFinish={handleFinish}
          />
        );
      default:
        return null;
    }
  };

  // 判断下一步按钮是否可用
  const canProceed = () => {
    switch (currentStep) {
      case 2:
        return userProfile !== null;
      default:
        return true;
    }
  };

  // 判断是否显示底部导航
  // 不显示底部导航的步骤：欢迎页、安装进度、语音测试步骤、完成页
  const showFooter =
    currentStep !== 1 &&
    currentStep !== 4 &&
    currentStep !== 5 &&
    currentStep !== 6 &&
    currentStep !== 7 &&
    currentStep !== 8;

  return (
    <Overlay>
      <Container>
        <StepIndicator>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <StepDot
              key={i}
              $active={currentStep === i + 1}
              $completed={currentStep > i + 1}
            />
          ))}
        </StepIndicator>

        <Content>{renderStep()}</Content>

        {showFooter && (
          <Footer>
            <FooterLeft>
              {currentStep > 1 && (
                <Button variant="ghost" onClick={handleBack}>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  上一步
                </Button>
              )}
            </FooterLeft>
            <FooterRight>
              <Button variant="outline" onClick={handleSkip}>
                跳过
              </Button>
              <Button onClick={handleNext} disabled={!canProceed()}>
                {currentStep === 3
                  ? selectedPlugins.length > 0
                    ? "开始安装"
                    : "跳过安装"
                  : "下一步"}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </FooterRight>
          </Footer>
        )}
      </Container>
    </Overlay>
  );
}
