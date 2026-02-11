/**
 * 创建项目对话框
 *
 * 用于创建新项目
 */

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  ProjectType,
  USER_PROJECT_TYPES,
  extractErrorMessage,
  getCreateProjectErrorMessage,
  getProjectTypeLabel,
  getProjectTypeIcon,
  getProjectByRootPath,
  getWorkspaceProjectsRoot,
  resolveProjectRootPath,
} from "@/lib/api/project";
import { toast } from "sonner";

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string, type: ProjectType) => Promise<void>;
  defaultType?: ProjectType;
  defaultName?: string;
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  onSubmit,
  defaultType,
  defaultName,
}: CreateProjectDialogProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ProjectType>(defaultType || "general");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workspaceRootPath, setWorkspaceRootPath] = useState("");
  const [resolvedProjectPath, setResolvedProjectPath] = useState("");
  const [pathChecking, setPathChecking] = useState(false);
  const [pathConflictMessage, setPathConflictMessage] = useState("");

  // 当对话框打开且 defaultType 变化时，更新类型选择
  useEffect(() => {
    if (open && defaultType) {
      setType(defaultType);
    }
  }, [open, defaultType]);

  // 当对话框打开且 defaultName 变化时，更新项目名称
  useEffect(() => {
    if (open && defaultName) {
      setName(defaultName);
    }
  }, [open, defaultName]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let mounted = true;

    const loadWorkspaceRoot = async () => {
      try {
        const root = await getWorkspaceProjectsRoot();
        if (mounted) {
          setWorkspaceRootPath(root);
        }
      } catch (error) {
        console.error("加载 workspace 目录失败:", error);
        if (mounted) {
          setWorkspaceRootPath("");
        }
      }
    };

    void loadWorkspaceRoot();

    return () => {
      mounted = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const projectName = name.trim();
    if (!projectName) {
      setResolvedProjectPath("");
      setPathChecking(false);
      setPathConflictMessage("");
      return;
    }

    let mounted = true;

    const resolvePath = async () => {
      try {
        const path = await resolveProjectRootPath(projectName);
        if (mounted) {
          setResolvedProjectPath(path);
          setPathConflictMessage("");
        }
      } catch (error) {
        console.error("解析项目目录失败:", error);
        if (mounted) {
          setResolvedProjectPath("");
          setPathConflictMessage("");
        }
      }
    };

    void resolvePath();

    return () => {
      mounted = false;
    };
  }, [open, name]);

  useEffect(() => {
    if (!open || !resolvedProjectPath) {
      setPathChecking(false);
      setPathConflictMessage("");
      return;
    }

    let mounted = true;
    setPathChecking(true);

    const checkPathConflict = async () => {
      try {
        const existingProject = await getProjectByRootPath(resolvedProjectPath);
        if (!mounted) {
          return;
        }

        if (existingProject) {
          setPathConflictMessage(`路径已存在项目：${existingProject.name}`);
        } else {
          setPathConflictMessage("");
        }
      } catch (error) {
        console.error("检查项目路径冲突失败:", error);
        if (mounted) {
          setPathConflictMessage("");
        }
      } finally {
        if (mounted) {
          setPathChecking(false);
        }
      }
    };

    void checkPathConflict();

    return () => {
      mounted = false;
    };
  }, [open, resolvedProjectPath]);

  const handleSubmit = async () => {
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(name.trim(), type);
      setName("");
      setType(defaultType || "general");
      onOpenChange(false);
    } catch (error) {
      console.error("创建项目失败:", error);
      const message = extractErrorMessage(error);
      const friendlyMessage = getCreateProjectErrorMessage(message);
      toast.error(`创建项目失败: ${friendlyMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>新建项目</DialogTitle>
          <DialogDescription>
            创建一个新的内容创作项目，目录将固定在 workspace 目录下。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-4">
          {/* 项目名称 */}
          <div className="grid gap-2">
            <Label htmlFor="name">项目名称</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入项目名称..."
              autoFocus
            />
          </div>

          {/* 项目类型 */}
          <div className="grid gap-3">
            <Label>项目类型</Label>
            <div className="grid grid-cols-3 gap-3">
              {USER_PROJECT_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all",
                    "hover:border-primary/50 hover:bg-accent/50",
                    type === t
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border",
                  )}
                  onClick={() => setType(t)}
                >
                  <span className="text-2xl">{getProjectTypeIcon(t)}</span>
                  <span className="text-xs font-medium">
                    {getProjectTypeLabel(t)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="workspace-root">workspace 目录</Label>
            <Input
              id="workspace-root"
              value={workspaceRootPath}
              placeholder="加载中..."
              readOnly
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="project-path-preview">项目路径预览</Label>
            <Input
              id="project-path-preview"
              value={resolvedProjectPath}
              placeholder="请输入项目名称"
              readOnly
            />
            <p className="text-xs text-muted-foreground break-all">
              将创建到：
              {resolvedProjectPath || "请输入项目名称"}
            </p>
            {pathChecking && (
              <p className="text-xs text-muted-foreground">正在检查路径...</p>
            )}
            {!pathChecking && pathConflictMessage && (
              <p className="text-xs text-destructive">{pathConflictMessage}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !name.trim() ||
              isSubmitting ||
              pathChecking ||
              !!pathConflictMessage
            }
          >
            {isSubmitting ? "创建中..." : "创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
