/**
 * 页面类型定义
 *
 * 支持静态页面和动态插件页面
 * - 静态页面: 预定义的页面标识符
 * - 动态插件页面: `plugin:${string}` 格式，如 "plugin:machine-id-tool"
 *
 * @module types/page
 */

import type { SettingsTabs } from "./settings";

export type WorkspaceTheme =
  | "general"
  | "social-media"
  | "poster"
  | "music"
  | "knowledge"
  | "planning"
  | "document"
  | "video"
  | "novel";

export type ThemeWorkspacePage =
  | "workspace-general"
  | "workspace-social-media"
  | "workspace-poster"
  | "workspace-music"
  | "workspace-knowledge"
  | "workspace-planning"
  | "workspace-document"
  | "workspace-video"
  | "workspace-novel";

export const LAST_THEME_WORKSPACE_PAGE_STORAGE_KEY =
  "proxycast:last-theme-workspace-page";

export const THEME_WORKSPACE_PAGE_MAP: Record<
  WorkspaceTheme,
  ThemeWorkspacePage
> = {
  general: "workspace-general",
  "social-media": "workspace-social-media",
  poster: "workspace-poster",
  music: "workspace-music",
  knowledge: "workspace-knowledge",
  planning: "workspace-planning",
  document: "workspace-document",
  video: "workspace-video",
  novel: "workspace-novel",
};

export const WORKSPACE_PAGE_THEME_MAP: Record<
  ThemeWorkspacePage,
  WorkspaceTheme
> = {
  "workspace-general": "general",
  "workspace-social-media": "social-media",
  "workspace-poster": "poster",
  "workspace-music": "music",
  "workspace-knowledge": "knowledge",
  "workspace-planning": "planning",
  "workspace-document": "document",
  "workspace-video": "video",
  "workspace-novel": "novel",
};

export type Page =
  | "provider-pool"
  | "api-server"
  | "agent"
  | "workspace"
  | ThemeWorkspacePage
  | "image-gen"
  | "mcp"
  | "tools"
  | "plugins"
  | "settings"
  | "memory"
  | "terminal"
  | "sysinfo"
  | "files"
  | "web"
  | "image-analysis"
  | "projects"
  | "project-detail"
  | `plugin:${string}`;

export function isThemeWorkspacePage(page: Page): page is ThemeWorkspacePage {
  return page in WORKSPACE_PAGE_THEME_MAP;
}

export function getThemeWorkspacePage(
  theme: WorkspaceTheme,
): ThemeWorkspacePage {
  return THEME_WORKSPACE_PAGE_MAP[theme];
}

export function getThemeByWorkspacePage(
  page: ThemeWorkspacePage,
): WorkspaceTheme {
  return WORKSPACE_PAGE_THEME_MAP[page];
}

export function getDefaultThemeWorkspacePage(): ThemeWorkspacePage {
  return THEME_WORKSPACE_PAGE_MAP.general;
}

export type WorkspaceViewMode =
  | "project-management"
  | "workspace"
  | "project-detail";

/**
 * Agent 页面参数
 * 用于从项目入口跳转到创作界面时传递项目上下文
 */
export interface AgentPageParams {
  projectId?: string;
  contentId?: string;
  /** 首屏主题（用于左侧导航直达创作主题） */
  theme?: string;
  /** 是否锁定主题（锁定后不在首屏显示主题切换） */
  lockTheme?: boolean;
  /** 首页点击触发的新会话标记（时间戳） */
  newChatAt?: number;
  /** 工作台视图模式（仅主题工作台使用） */
  workspaceViewMode?: WorkspaceViewMode;
}

/**
 * 项目详情页参数
 */
export interface ProjectDetailPageParams {
  projectId: string;
  workspaceTheme?: WorkspaceTheme;
}

/**
 * 设置页面参数
 */
export interface SettingsPageParams {
  tab?: SettingsTabs;
}

/**
 * 页面参数联合类型
 */
export type PageParams =
  | AgentPageParams
  | ProjectDetailPageParams
  | SettingsPageParams
  | Record<string, unknown>;
