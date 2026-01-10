/**
 * @file 步骤结果展示组件
 * @description 展示步骤完成后的结果
 * @module components/content-creator/core/StepGuide/StepResult
 */

import React, { memo } from "react";
import styled from "styled-components";
import { Check, Edit2, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepResult as StepResultType, ContentFile } from "../../types";

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const ResultCard = styled.div`
  padding: 16px;
  background: hsl(var(--muted) / 0.3);
  border-radius: 12px;
  border: 1px solid hsl(var(--border));
`;

const ResultHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
`;

const ResultTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: hsl(var(--foreground));
`;

const SuccessIcon = styled.div`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: hsl(142 76% 36% / 0.1);
  color: hsl(142 76% 36%);
  display: flex;
  align-items: center;
  justify-content: center;
`;

const EditButton = styled(Button)`
  gap: 4px;
`;

const UserInputSection = styled.div`
  margin-bottom: 12px;
`;

const SectionLabel = styled.div`
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  margin-bottom: 6px;
`;

const InputList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const InputItem = styled.div`
  display: flex;
  gap: 8px;
  font-size: 13px;
`;

const InputLabel = styled.span`
  color: hsl(var(--muted-foreground));
  min-width: 80px;
`;

const InputValue = styled.span`
  color: hsl(var(--foreground));
`;

const AIOutputSection = styled.div`
  padding-top: 12px;
  border-top: 1px solid hsl(var(--border));
`;

const AIOutputContent = styled.div`
  font-size: 14px;
  color: hsl(var(--foreground));
  line-height: 1.6;
  white-space: pre-wrap;
`;

const ArtifactsSection = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid hsl(var(--border));
`;

const ArtifactCard = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s;

  &:hover {
    border-color: hsl(var(--primary));
  }
`;

const ArtifactIcon = styled.div`
  color: hsl(var(--primary));
`;

const ArtifactName = styled.span`
  font-size: 13px;
  color: hsl(var(--foreground));
`;

interface StepResultProps {
  /** 步骤结果 */
  result: StepResultType;
  /** 步骤标题 */
  title?: string;
  /** 编辑回调 */
  onEdit?: () => void;
  /** 点击产物回调 */
  onArtifactClick?: (file: ContentFile) => void;
}

/**
 * 步骤结果展示组件
 *
 * 展示用户输入、AI 输出和生成的产物
 */
export const StepResult: React.FC<StepResultProps> = memo(
  ({ result, title = "已完成", onEdit, onArtifactClick }) => {
    const { userInput, aiOutput, artifacts } = result;

    // 格式化用户输入值
    const formatValue = (value: unknown): string => {
      if (Array.isArray(value)) {
        return value.join("、");
      }
      if (typeof value === "object" && value !== null) {
        return JSON.stringify(value);
      }
      return String(value);
    };

    // 渲染用户输入部分
    const renderUserInput = (): React.JSX.Element | null => {
      if (!userInput || Object.keys(userInput).length === 0) {
        return null;
      }
      const entries = Object.entries(userInput) as [string, unknown][];
      return (
        <UserInputSection>
          <SectionLabel>你的输入</SectionLabel>
          <InputList>
            {entries.map(([key, val]) => (
              <InputItem key={key}>
                <InputLabel>{key}:</InputLabel>
                <InputValue>{formatValue(val)}</InputValue>
              </InputItem>
            ))}
          </InputList>
        </UserInputSection>
      );
    };

    return (
      <Container>
        <ResultCard>
          <ResultHeader>
            <ResultTitle>
              <SuccessIcon>
                <Check size={14} />
              </SuccessIcon>
              {title}
            </ResultTitle>
            {onEdit && (
              <EditButton variant="ghost" size="sm" onClick={onEdit}>
                <Edit2 size={14} />
                编辑
              </EditButton>
            )}
          </ResultHeader>

          {/* 用户输入 */}
          {renderUserInput() as React.ReactNode}

          {/* AI 输出 */}
          {aiOutput ? (
            <AIOutputSection>
              <SectionLabel>
                <Sparkles
                  size={12}
                  style={{ display: "inline", marginRight: 4 }}
                />
                AI 生成
              </SectionLabel>
              <AIOutputContent>
                {typeof aiOutput === "string"
                  ? aiOutput
                  : JSON.stringify(aiOutput, null, 2)}
              </AIOutputContent>
            </AIOutputSection>
          ) : null}

          {/* 产物列表 */}
          {artifacts && artifacts.length > 0 && (
            <ArtifactsSection>
              <SectionLabel style={{ width: "100%" }}>生成的文件</SectionLabel>
              {artifacts.map((file) => (
                <ArtifactCard
                  key={file.id}
                  onClick={() => onArtifactClick?.(file)}
                >
                  <ArtifactIcon>
                    <FileText size={16} />
                  </ArtifactIcon>
                  <ArtifactName>{file.name}</ArtifactName>
                </ArtifactCard>
              ))}
            </ArtifactsSection>
          )}
        </ResultCard>
      </Container>
    );
  },
);

StepResult.displayName = "StepResult";
