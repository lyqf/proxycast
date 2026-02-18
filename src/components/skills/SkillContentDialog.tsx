/**
 * @file SkillContentDialog.tsx
 * @description Skill 内容查看弹窗，展示本地 SKILL.md 的 Markdown 预览
 *
 * 功能：
 * - 展示 Skill 名称和说明
 * - 加载中状态
 * - 错误状态
 * - Markdown 内容预览
 *
 * @module components/skills
 */

import { Loader2, AlertCircle, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MarkdownPreview } from "@/components/preview/MarkdownPreview";
import "@/components/preview/preview.css";

export interface SkillContentDialogProps {
  /** Skill 名称 */
  skillName: string;
  /** 是否打开 */
  open: boolean;
  /** 打开状态变化 */
  onOpenChange: (open: boolean) => void;
  /** SKILL.md 内容 */
  content: string;
  /** 是否正在加载 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
}

export function SkillContentDialog({
  skillName,
  open,
  onOpenChange,
  content,
  loading,
  error,
}: SkillContentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent maxWidth="max-w-5xl" className="h-[80vh] p-0 overflow-hidden">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            {skillName}
          </DialogTitle>
          <DialogDescription>查看本地 SKILL.md 内容</DialogDescription>
        </DialogHeader>

        <div className="h-[calc(80vh-88px)] overflow-auto [--terminal-bg:#ffffff] [--terminal-fg:#111827] [--terminal-border:#e5e7eb] [--terminal-muted:#6b7280] [--terminal-accent:#2563eb] [--terminal-tab-bg:#f8fafc]">
          {loading && (
            <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              正在读取 SKILL.md...
            </div>
          )}

          {!loading && error && (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-red-600">
              <AlertCircle className="h-8 w-8" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && (
            <>
              {content.trim() ? (
                <MarkdownPreview content={content} />
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
                  SKILL.md 内容为空
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
