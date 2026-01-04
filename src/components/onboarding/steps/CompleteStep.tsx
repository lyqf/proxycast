/**
 * 初次安装引导 - 完成页
 */

import styled from "styled-components";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, PartyPopper } from "lucide-react";
import { onboardingPlugins } from "../constants";
import type { PluginInstallState } from "./InstallProgressStep";

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 24px;
  text-align: center;
`;

const IconContainer = styled.div`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: hsl(142.1 76.2% 36.3% / 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;

  svg {
    width: 40px;
    height: 40px;
    color: hsl(142.1 76.2% 36.3%);
  }
`;

const Title = styled.h2`
  font-size: 24px;
  font-weight: 600;
  color: hsl(var(--foreground));
  margin-bottom: 8px;
`;

const Subtitle = styled.p`
  font-size: 14px;
  color: hsl(var(--muted-foreground));
  margin-bottom: 32px;
  max-width: 400px;
`;

const ResultList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 400px;
  margin-bottom: 32px;
`;

const ResultItem = styled.div<{ $success: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  background: ${({ $success }) =>
    $success ? "hsl(142.1 76.2% 36.3% / 0.1)" : "hsl(0 84.2% 60.2% / 0.1)"};

  svg {
    width: 20px;
    height: 20px;
    color: ${({ $success }) =>
      $success ? "hsl(142.1 76.2% 36.3%)" : "hsl(0 84.2% 60.2%)"};
    flex-shrink: 0;
  }
`;

const ResultText = styled.span<{ $success: boolean }>`
  font-size: 14px;
  color: ${({ $success }) =>
    $success ? "hsl(142.1 76.2% 36.3%)" : "hsl(0 84.2% 60.2%)"};
`;

const NoPluginsMessage = styled.p`
  font-size: 14px;
  color: hsl(var(--muted-foreground));
  margin-bottom: 32px;
`;

interface CompleteStepProps {
  installResults: PluginInstallState[];
  onFinish: () => void;
}

export function CompleteStep({ installResults, onFinish }: CompleteStepProps) {
  const successCount = installResults.filter(
    (r) => r.status === "complete",
  ).length;
  const failedCount = installResults.filter(
    (r) => r.status === "failed",
  ).length;
  const hasResults = installResults.length > 0;

  return (
    <Container>
      <IconContainer>
        <PartyPopper />
      </IconContainer>

      <Title>设置完成！</Title>
      <Subtitle>
        {hasResults
          ? successCount === installResults.length
            ? "所有插件已成功安装，您可以开始使用 ProxyCast 了。"
            : `已安装 ${successCount} 个插件${failedCount > 0 ? `，${failedCount} 个安装失败` : ""}。您可以稍后在插件中心重试。`
          : "您已跳过插件安装，可以稍后在插件中心安装需要的插件。"}
      </Subtitle>

      {hasResults && (
        <ResultList>
          {installResults.map((result) => {
            const plugin = onboardingPlugins.find(
              (p) => p.id === result.pluginId,
            );
            const isSuccess = result.status === "complete";

            return (
              <ResultItem key={result.pluginId} $success={isSuccess}>
                {isSuccess ? <CheckCircle /> : <XCircle />}
                <ResultText $success={isSuccess}>
                  {plugin?.name || result.pluginId}
                  {isSuccess ? " 安装成功" : " 安装失败"}
                </ResultText>
              </ResultItem>
            );
          })}
        </ResultList>
      )}

      {!hasResults && (
        <NoPluginsMessage>
          提示：您可以在左侧导航栏的"插件中心"随时安装插件
        </NoPluginsMessage>
      )}

      <Button size="lg" onClick={onFinish}>
        开始使用
      </Button>
    </Container>
  );
}
