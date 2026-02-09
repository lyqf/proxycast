import React from "react";
import { Box, Home, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectSelector } from "@/components/projects/ProjectSelector";
import { Navbar } from "../styles";

interface ChatNavbarProps {
  isRunning: boolean;
  onToggleHistory: () => void;
  onToggleFullscreen: () => void;
  onToggleSettings?: () => void;
  onBackHome?: () => void;
  projectId?: string | null;
  onProjectChange?: (projectId: string) => void;
  workspaceType?: string;
}

export const ChatNavbar: React.FC<ChatNavbarProps> = ({
  isRunning: _isRunning,
  onToggleHistory,
  onToggleFullscreen: _onToggleFullscreen,
  onToggleSettings,
  onBackHome,
  projectId = null,
  onProjectChange,
  workspaceType,
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
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          onClick={onToggleHistory}
        >
          <Box size={18} />
        </Button>
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
