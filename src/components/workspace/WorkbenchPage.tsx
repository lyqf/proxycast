/**
 * @file WorkbenchPage.tsx
 * @description 主题工作台页面，按主题管理项目并复用 Agent 对话与画布
 * @module components/workspace/WorkbenchPage
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileText,
  FolderOpen,
  Home,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  type ContentListItem,
  type Project,
  type ProjectType,
  createContent,
  createProject,
  formatRelativeTime,
  generateProjectName,
  getContentTypeLabel,
  getDefaultContentTypeForProject,
  getDefaultProjectPath,
  getProjectTypeLabel,
  listContents,
  listProjects,
  updateContent,
} from "@/lib/api/project";
import type {
  Page,
  PageParams,
  WorkspaceTheme,
  WorkspaceViewMode,
} from "@/types/page";
import { toast } from "sonner";
import { AgentChatPage } from "@/components/agent";
import { ProjectDetailPage } from "@/components/projects/ProjectDetailPage";

export interface WorkbenchPageProps {
  onNavigate?: (page: Page, params?: PageParams) => void;
  projectId?: string;
  contentId?: string;
  theme: WorkspaceTheme;
  viewMode?: WorkspaceViewMode;
}

type WorkspaceMode = WorkspaceViewMode;

export function WorkbenchPage({
  onNavigate,
  projectId: initialProjectId,
  contentId: initialContentId,
  theme,
  viewMode: initialViewMode,
}: WorkbenchPageProps) {
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(
    initialViewMode ?? (initialContentId ? "workspace" : "project-management"),
  );

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    initialProjectId ?? null,
  );

  const [contents, setContents] = useState<ContentListItem[]>([]);
  const [contentsLoading, setContentsLoading] = useState(false);
  const [selectedContentId, setSelectedContentId] = useState<string | null>(
    initialContentId ?? null,
  );

  const [projectQuery, setProjectQuery] = useState("");
  const [contentQuery, setContentQuery] = useState("");

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const filteredProjects = useMemo(() => {
    const query = projectQuery.trim().toLowerCase();
    if (!query) {
      return projects;
    }

    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(query) ||
        project.tags.some((tag) => tag.toLowerCase().includes(query)),
    );
  }, [projects, projectQuery]);

  const filteredContents = useMemo(() => {
    const query = contentQuery.trim().toLowerCase();
    if (!query) {
      return contents;
    }

    return contents.filter((content) =>
      content.title.toLowerCase().includes(query),
    );
  }, [contents, contentQuery]);

  const handleEnterWorkspace = useCallback((contentId: string) => {
    setSelectedContentId(contentId);
    setWorkspaceMode("workspace");
    setShowRightSidebar(true);
  }, []);

  const handleOpenProjectDetail = useCallback(() => {
    if (!selectedProjectId) {
      return;
    }

    setWorkspaceMode("project-detail");
    setShowLeftSidebar(true);
    setShowRightSidebar(false);
  }, [selectedProjectId]);

  const loadProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const allProjects = await listProjects();
      const typedProjects = allProjects.filter(
        (project) =>
          project.workspaceType === (theme as ProjectType) &&
          !project.isArchived,
      );

      setProjects(typedProjects);
      setSelectedProjectId((previousId) => {
        if (
          initialProjectId &&
          typedProjects.some((project) => project.id === initialProjectId)
        ) {
          return initialProjectId;
        }

        if (
          previousId &&
          typedProjects.some((project) => project.id === previousId)
        ) {
          return previousId;
        }

        return typedProjects[0]?.id ?? null;
      });
    } catch (error) {
      console.error("加载主题项目失败:", error);
      toast.error("加载项目失败");
    } finally {
      setProjectsLoading(false);
    }
  }, [initialProjectId, theme]);

  const loadContents = useCallback(
    async (projectId: string) => {
      setContentsLoading(true);
      try {
        const contentList = await listContents(projectId);
        setContents(contentList);

        setSelectedContentId((previousId) => {
          if (
            initialContentId &&
            contentList.some((content) => content.id === initialContentId)
          ) {
            return initialContentId;
          }

          if (
            previousId &&
            contentList.some((content) => content.id === previousId)
          ) {
            return previousId;
          }

          return contentList[0]?.id ?? null;
        });
      } catch (error) {
        console.error("加载文稿失败:", error);
        toast.error("加载文稿失败");
      } finally {
        setContentsLoading(false);
      }
    },
    [initialContentId],
  );

  const handleCreateProject = useCallback(async () => {
    try {
      const projectName = generateProjectName(theme as ProjectType);
      const rootPath = getDefaultProjectPath();
      await createProject({
        name: projectName,
        rootPath,
        workspaceType: theme as ProjectType,
      });
      toast.success("已创建新项目");
      await loadProjects();
    } catch (error) {
      console.error("创建项目失败:", error);
      toast.error("创建项目失败");
    }
  }, [loadProjects, theme]);

  const handleCreateContent = useCallback(async () => {
    if (!selectedProjectId) {
      return;
    }

    try {
      const defaultType = getDefaultContentTypeForProject(theme as ProjectType);
      const created = await createContent({
        project_id: selectedProjectId,
        title: `新${getContentTypeLabel(defaultType)}`,
        content_type: defaultType,
      });

      await loadContents(selectedProjectId);
      handleEnterWorkspace(created.id);
      toast.success("已创建新文稿");
    } catch (error) {
      console.error("创建文稿失败:", error);
      toast.error("创建文稿失败");
    }
  }, [handleEnterWorkspace, loadContents, selectedProjectId, theme]);

  const handleQuickSaveCurrent = useCallback(async () => {
    if (!selectedContentId || !selectedProjectId) {
      return;
    }

    try {
      await updateContent(selectedContentId, {
        metadata: {
          saved_from: "theme-workspace",
          saved_at: Date.now(),
        },
      });
      toast.success("已保存当前文稿");
      await loadContents(selectedProjectId);
    } catch (error) {
      console.error("保存失败:", error);
      toast.error("保存失败");
    }
  }, [loadContents, selectedContentId, selectedProjectId]);

  useEffect(() => {
    const nextMode: WorkspaceMode =
      initialViewMode ??
      (initialContentId ? "workspace" : "project-management");

    setProjectQuery("");
    setContentQuery("");
    setSelectedProjectId(initialProjectId ?? null);
    setSelectedContentId(initialContentId ?? null);
    setWorkspaceMode(nextMode);
    setShowLeftSidebar(true);
    setShowRightSidebar(nextMode === "workspace");
    setContents([]);
    void loadProjects();
  }, [
    initialContentId,
    initialProjectId,
    initialViewMode,
    loadProjects,
    theme,
  ]);

  useEffect(() => {
    if (!selectedProjectId) {
      setContents([]);
      setSelectedContentId(null);
      return;
    }

    void loadContents(selectedProjectId);
  }, [loadContents, selectedProjectId]);

  const handleBackHome = useCallback(() => {
    onNavigate?.("agent", {
      theme: "general",
      lockTheme: false,
    });
  }, [onNavigate]);

  const handleBackToProjectManagement = useCallback(() => {
    setWorkspaceMode("project-management");
    setShowLeftSidebar(true);
    setShowRightSidebar(false);
  }, []);

  const shouldRenderLeftSidebar =
    workspaceMode !== "workspace" || showLeftSidebar;

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="h-12 border-b px-3 flex items-center gap-2 bg-background">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleBackHome}
          title="回到首页"
        >
          <Home className="h-4 w-4" />
        </Button>

        {workspaceMode === "workspace" && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowLeftSidebar((visible) => !visible)}
              title={showLeftSidebar ? "隐藏左侧栏" : "显示左侧栏"}
            >
              {showLeftSidebar ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowRightSidebar((visible) => !visible)}
              title={showRightSidebar ? "隐藏右侧栏" : "显示右侧栏"}
            >
              {showRightSidebar ? (
                <PanelRightClose className="h-4 w-4" />
              ) : (
                <PanelRightOpen className="h-4 w-4" />
              )}
            </Button>
          </>
        )}

        {workspaceMode !== "project-management" && (
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={handleBackToProjectManagement}
          >
            项目管理
          </Button>
        )}

        <div className="text-sm font-medium ml-2">
          {getProjectTypeLabel(theme)}
        </div>
        {selectedProject && (
          <div className="text-xs text-muted-foreground truncate">
            {selectedProject.name}
          </div>
        )}
      </header>

      <div className="flex flex-1 min-h-0">
        {shouldRenderLeftSidebar && (
          <aside className="w-[320px] min-w-[300px] border-r bg-muted/20 flex flex-col">
            <div className="px-3 py-3 border-b space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">
                    {getProjectTypeLabel(theme)}
                  </h2>
                  <p className="text-xs text-muted-foreground">主题项目管理</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      void loadProjects();
                    }}
                    disabled={projectsLoading}
                  >
                    <RefreshCw
                      className={cn(
                        "h-4 w-4",
                        projectsLoading && "animate-spin",
                      )}
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      void handleCreateProject();
                    }}
                    title="新建项目"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Input
                value={projectQuery}
                onChange={(event) => setProjectQuery(event.target.value)}
                placeholder="搜索项目..."
                className="h-8 text-xs"
              />
            </div>

            <div className="flex-1 min-h-0 flex flex-col">
              <div className="min-h-0 basis-1/2 border-b flex flex-col">
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  项目
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-1">
                    {filteredProjects.length === 0 ? (
                      <div className="px-2 py-6 text-xs text-muted-foreground text-center">
                        该主题下暂无项目
                      </div>
                    ) : (
                      filteredProjects.map((project) => (
                        <button
                          key={project.id}
                          className={cn(
                            "w-full text-left rounded-md px-2 py-2 transition-colors",
                            "hover:bg-accent",
                            selectedProjectId === project.id &&
                              "bg-accent text-accent-foreground",
                          )}
                          onClick={() => {
                            setSelectedProjectId(project.id);
                            setContentQuery("");
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <FolderOpen className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium truncate">
                              {project.name}
                            </span>
                          </div>
                          <div className="mt-1 text-[11px] text-muted-foreground truncate">
                            {getProjectTypeLabel(project.workspaceType)}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>

              <div className="min-h-0 basis-1/2 flex flex-col">
                <div className="px-3 py-2 flex items-center gap-2">
                  <div className="text-xs text-muted-foreground flex-1">
                    文稿
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      void handleCreateContent();
                    }}
                    disabled={!selectedProjectId}
                    title="新建文稿"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="px-2 pb-2">
                  <Input
                    value={contentQuery}
                    onChange={(event) => setContentQuery(event.target.value)}
                    placeholder="搜索文稿..."
                    className="h-8 text-xs"
                    disabled={!selectedProjectId}
                  />
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-1">
                    {contentsLoading ? (
                      <div className="px-2 py-6 text-xs text-muted-foreground text-center">
                        文稿加载中...
                      </div>
                    ) : filteredContents.length === 0 ? (
                      <div className="px-2 py-6 text-xs text-muted-foreground text-center">
                        还没有文稿
                      </div>
                    ) : (
                      filteredContents.map((content) => (
                        <button
                          key={content.id}
                          className={cn(
                            "w-full text-left rounded-md px-2 py-2 transition-colors",
                            "hover:bg-accent",
                            selectedContentId === content.id &&
                              "bg-accent text-accent-foreground",
                          )}
                          onClick={() => handleEnterWorkspace(content.id)}
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium truncate">
                              {content.title}
                            </span>
                          </div>
                          <div className="mt-1 text-[11px] text-muted-foreground truncate">
                            {formatRelativeTime(content.updated_at)}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </aside>
        )}

        <main className="flex-1 min-w-0 min-h-0 flex flex-col">
          {workspaceMode === "project-management" ? (
            <div className="h-full rounded-lg border bg-card flex flex-col items-center justify-center gap-3 text-muted-foreground m-4">
              <Sparkles className="h-8 w-8 opacity-60" />
              <p className="text-sm">先完成项目管理，再进入三栏作业界面</p>
              <p className="text-xs text-muted-foreground">
                在左侧选择文稿，或先新建文稿
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    void handleCreateProject();
                  }}
                >
                  <FolderOpen className="h-4 w-4 mr-1" />
                  新建项目
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    void handleCreateContent();
                  }}
                  disabled={!selectedProjectId}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  新建文稿并进入作业
                </Button>
                <Button
                  variant="outline"
                  onClick={handleOpenProjectDetail}
                  disabled={!selectedProjectId}
                >
                  <FolderOpen className="h-4 w-4 mr-1" />
                  项目详情
                </Button>
              </div>
            </div>
          ) : workspaceMode === "project-detail" ? (
            !selectedProjectId ? (
              <div className="h-full rounded-lg border bg-card flex flex-col items-center justify-center gap-3 text-muted-foreground m-4">
                <Sparkles className="h-8 w-8 opacity-60" />
                <p className="text-sm">请先在左侧选择项目</p>
              </div>
            ) : (
              <ProjectDetailPage
                projectId={selectedProjectId}
                onBack={handleBackToProjectManagement}
                onNavigateToChat={() => {
                  setWorkspaceMode("workspace");
                  setShowRightSidebar(true);
                }}
              />
            )
          ) : !selectedProjectId || !selectedContentId ? (
            <div className="h-full rounded-lg border bg-card flex flex-col items-center justify-center gap-3 text-muted-foreground m-4">
              <Sparkles className="h-8 w-8 opacity-60" />
              <p className="text-sm">请先在左侧选择项目并打开文稿</p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    void handleCreateProject();
                  }}
                >
                  <FolderOpen className="h-4 w-4 mr-1" />
                  新建项目
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    void handleCreateContent();
                  }}
                  disabled={!selectedProjectId}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  新建文稿
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0">
              <AgentChatPage
                onNavigate={onNavigate}
                projectId={selectedProjectId}
                contentId={selectedContentId}
                theme={theme}
                lockTheme={true}
              />
            </div>
          )}
        </main>

        {workspaceMode === "workspace" && showRightSidebar && (
          <aside className="w-[260px] min-w-[260px] border-l bg-muted/10 p-4 flex flex-col gap-3">
            <h3 className="text-sm font-semibold">主题工具</h3>
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => {
                void handleQuickSaveCurrent();
              }}
              disabled={!selectedContentId}
            >
              <FileText className="h-4 w-4 mr-2" />
              快速保存
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={handleOpenProjectDetail}
              disabled={!selectedProjectId}
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              项目详情
            </Button>
          </aside>
        )}
      </div>
    </div>
  );
}

export default WorkbenchPage;
