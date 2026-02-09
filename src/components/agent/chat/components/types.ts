/**
 * 创作模式类型
 * 不同模式下 AI 的角色和用户参与度不同
 */
export type CreationMode = "guided" | "fast" | "hybrid" | "framework";

/**
 * 入口任务类型（文章创作）
 */
export type EntryTaskType =
  | "direct"
  | "multi_angle"
  | "rewrite"
  | "imitate"
  | "geo";

/**
 * 入口任务槽位定义
 */
export interface EntryTaskSlotDefinition {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
  defaultValue?: string;
}

/**
 * 入口任务模板
 */
export interface EntryTaskTemplate {
  type: EntryTaskType;
  label: string;
  description: string;
  pattern: string;
  slots: EntryTaskSlotDefinition[];
}

/**
 * 槽位键值对
 */
export type EntryTaskSlotValues = Record<string, string>;
