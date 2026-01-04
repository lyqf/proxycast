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

const TOTAL_STEPS = 5;

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
        setCurrentStep(5); // 直接跳到完成页
      } else {
        setCurrentStep((prev) => prev + 1);
      }
    }
  }, [currentStep, selectedPlugins]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      // 如果从完成页返回且没有安装结果，返回到插件选择
      if (currentStep === 5 && installResults.length === 0) {
        setCurrentStep(3);
      } else if (currentStep === 5) {
        // 已经安装过，不能返回
        return;
      } else {
        setCurrentStep((prev) => prev - 1);
      }
    }
  }, [currentStep, installResults]);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const handleInstallComplete = useCallback((results: PluginInstallState[]) => {
    setInstallResults(results);
    setCurrentStep(5);
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
  const showFooter =
    currentStep !== 1 && currentStep !== 4 && currentStep !== 5;

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
