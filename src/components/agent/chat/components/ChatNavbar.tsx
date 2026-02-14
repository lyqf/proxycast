import React from "react";
import {
  Box,
  FolderOpen,
  Home,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectSelector } from "@/components/projects/ProjectSelector";
import { Navbar } from "../styles";

interface ChatNavbarProps {
  isRunning: boolean;
  onToggleHistory: () => void;
  showHistoryToggle?: boolean;
  onToggleFullscreen: () => void;
  onBackToProjectManagement?: () => void;
  onBackToResources?: () => void;
  onToggleSettings?: () => void;
  onBackHome?: () => void;
  projectId?: string | null;
  onProjectChange?: (projectId: string) => void;
  workspaceType?: string;
  novelCanvasControls?: {
    chapterListCollapsed: boolean;
    onToggleChapterList: () => void;
    onAddChapter: () => void;
    onCloseCanvas: () => void;
  } | null;
}

export const ChatNavbar: React.FC<ChatNavbarProps> = ({
  isRunning: _isRunning,
  onToggleHistory,
  showHistoryToggle = true,
  onToggleFullscreen: _onToggleFullscreen,
  onBackToProjectManagement,
  onBackToResources,
  onToggleSettings,
  onBackHome,
  projectId = null,
  onProjectChange,
  workspaceType,
  novelCanvasControls = null,
}) => {
  return (
    <Navbar>
      <div className="flex items-center gap-2">
        {onBackHome && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={onBackHome}
            title="返回首页"
          >
            <Home size={18} />
          </Button>
        )}
        {onBackToResources && (
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={onBackToResources}
          >
            <FolderOpen size={16} className="mr-1.5" />
            返回资源
          </Button>
        )}
        {showHistoryToggle && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={onToggleHistory}
          >
            <Box size={18} />
          </Button>
        )}
        {onBackToProjectManagement && (
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={onBackToProjectManagement}
          >
            项目管理
          </Button>
        )}
        {novelCanvasControls && (
          <>
            <div className="h-5 w-px bg-border" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={novelCanvasControls.onToggleChapterList}
              title={
                novelCanvasControls.chapterListCollapsed
                  ? "展开章节栏"
                  : "收起章节栏"
              }
            >
              {novelCanvasControls.chapterListCollapsed ? (
                <PanelLeftOpen size={18} />
              ) : (
                <PanelLeftClose size={18} />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={novelCanvasControls.onAddChapter}
              title="新建章节"
            >
              <Plus size={18} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={novelCanvasControls.onCloseCanvas}
              title="关闭画布"
            >
              <X size={18} />
            </Button>
          </>
        )}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <ProjectSelector
          value={projectId}
          onChange={(nextProjectId) => onProjectChange?.(nextProjectId)}
          workspaceType={workspaceType}
          placeholder="选择项目"
          dropdownSide="bottom"
          dropdownAlign="end"
          className="h-8 text-xs min-w-[160px] max-w-[220px]"
        />

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          onClick={onToggleSettings}
        >
          <Settings2 size={18} />
        </Button>
      </div>
    </Navbar>
  );
};
