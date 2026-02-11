/**
 * 小说画布组件
 *
 * 用于小说项目的章节编辑
 */

import React, { memo, useCallback } from "react";
import styled from "styled-components";
import { X, Plus, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { NovelCanvasState, Chapter } from "./types";
import { countWords } from "./types";

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: hsl(var(--background));
  border-right: 1px solid hsl(var(--border));
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid hsl(var(--border));
`;

const Title = styled.h3`
  font-size: 14px;
  font-weight: 600;
`;

const Content = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
`;

const ChapterList = styled.div`
  width: 220px;
  border-right: 1px solid hsl(var(--border));
  display: flex;
  flex-direction: column;
`;

const ChapterListHeader = styled.div`
  padding: 12px;
  border-bottom: 1px solid hsl(var(--border));
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ChapterItem = styled.div<{ $active?: boolean }>`
  padding: 12px;
  cursor: pointer;
  border-bottom: 1px solid hsl(var(--border));
  background: ${({ $active }) =>
    $active ? "hsl(var(--accent))" : "transparent"};

  &:hover {
    background: hsl(var(--accent));
  }
`;

const ChapterTitle = styled.div`
  font-weight: 500;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const ChapterMeta = styled.div`
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  margin-top: 4px;
`;

const EditorArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

const ChapterHeader = styled.div`
  padding: 16px;
  border-bottom: 1px solid hsl(var(--border));
  display: flex;
  gap: 12px;
  align-items: center;
`;

const EditorContainer = styled.div`
  flex: 1;
  padding: 24px;
  display: flex;
  flex-direction: column;
`;

const Editor = styled(Textarea)`
  flex: 1;
  min-height: 400px;
  font-size: 16px;
  line-height: 1.8;
  resize: none;
  border: none;
  background: transparent;

  &:focus {
    outline: none;
    box-shadow: none;
  }
`;

const StatusBar = styled.div`
  padding: 8px 16px;
  border-top: 1px solid hsl(var(--border));
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
`;

interface NovelCanvasProps {
  state: NovelCanvasState;
  onStateChange: (state: NovelCanvasState) => void;
  onClose: () => void;
}

export const NovelCanvas: React.FC<NovelCanvasProps> = memo(
  ({ state, onStateChange, onClose }) => {
    const currentChapter = state.chapters.find(
      (c) => c.id === state.currentChapterId,
    );

    const handleChapterSelect = useCallback(
      (chapterId: string) => {
        onStateChange({ ...state, currentChapterId: chapterId });
      },
      [state, onStateChange],
    );

    const handleAddChapter = useCallback(() => {
      const now = Date.now();
      const newChapter: Chapter = {
        id: crypto.randomUUID(),
        number: state.chapters.length + 1,
        title: `第${state.chapters.length + 1}章`,
        content: "",
        wordCount: 0,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      };
      onStateChange({
        ...state,
        chapters: [...state.chapters, newChapter],
        currentChapterId: newChapter.id,
      });
    }, [state, onStateChange]);

    const handleUpdateChapter = useCallback(
      (updates: Partial<Chapter>) => {
        if (!currentChapter) return;
        const now = Date.now();
        const updatedChapters = state.chapters.map((c) =>
          c.id === currentChapter.id
            ? {
                ...c,
                ...updates,
                wordCount: updates.content
                  ? countWords(updates.content)
                  : c.wordCount,
                updatedAt: now,
              }
            : c,
        );
        onStateChange({ ...state, chapters: updatedChapters });
      },
      [state, currentChapter, onStateChange],
    );

    const totalWords = state.chapters.reduce((sum, c) => sum + c.wordCount, 0);
    const completedCount = state.chapters.filter(
      (c) => c.status === "completed",
    ).length;

    return (
      <Container>
        <Header>
          <Title>小说编辑器</Title>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </Header>

        <Content>
          <ChapterList>
            <ChapterListHeader>
              <span className="text-sm font-medium">章节</span>
              <Button variant="ghost" size="icon" onClick={handleAddChapter}>
                <Plus className="h-4 w-4" />
              </Button>
            </ChapterListHeader>
            <ScrollArea className="flex-1">
              {state.chapters.map((chapter) => (
                <ChapterItem
                  key={chapter.id}
                  $active={chapter.id === state.currentChapterId}
                  onClick={() => handleChapterSelect(chapter.id)}
                >
                  <ChapterTitle>
                    {chapter.status === "completed" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    )}
                    {chapter.title}
                  </ChapterTitle>
                  <ChapterMeta>{chapter.wordCount} 字</ChapterMeta>
                </ChapterItem>
              ))}
            </ScrollArea>
          </ChapterList>

          <EditorArea>
            {currentChapter && (
              <>
                <ChapterHeader>
                  <Input
                    value={currentChapter.title}
                    onChange={(e) =>
                      handleUpdateChapter({ title: e.target.value })
                    }
                    placeholder="章节标题"
                    className="text-lg font-medium"
                  />
                  <Button
                    variant={
                      currentChapter.status === "completed"
                        ? "secondary"
                        : "outline"
                    }
                    size="sm"
                    onClick={() =>
                      handleUpdateChapter({
                        status:
                          currentChapter.status === "completed"
                            ? "draft"
                            : "completed",
                      })
                    }
                  >
                    {currentChapter.status === "completed"
                      ? "已完成"
                      : "标记完成"}
                  </Button>
                </ChapterHeader>

                <EditorContainer>
                  <Editor
                    value={currentChapter.content}
                    onChange={(e) =>
                      handleUpdateChapter({ content: e.target.value })
                    }
                    placeholder="开始写作..."
                  />
                </EditorContainer>
              </>
            )}
          </EditorArea>
        </Content>

        <StatusBar>
          <span>
            {completedCount}/{state.chapters.length} 章完成
          </span>
          <span>总字数：{totalWords.toLocaleString()}</span>
        </StatusBar>
      </Container>
    );
  },
);

NovelCanvas.displayName = "NovelCanvas";
