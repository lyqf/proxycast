/**
 * 向后兼容层
 *
 * @deprecated 请迁移到新的统一记忆 API (`unifiedMemory.ts`)
 *
 * 本文件提供旧版记忆 API 的兼容实现，内部调用新的统一记忆 API。
 * 这样可以确保现有代码无需修改即可工作。
 *
 * 迁移指南：
 * - getMemoryOverview() -> listUnifiedMemories()
 * - requestMemoryAnalysis() -> (待实现）
 * - cleanupMemory() -> deleteUnifiedMemory() 或 (待实现的批量清理）
 */

import {
  listUnifiedMemories,
  type UnifiedMemory,
} from "./unifiedMemory";

// ==================== 类型映射 ====================

/**
 * @deprecated 使用 UnifiedMemory 替代
 */
export interface MemoryEntryPreview {
  id: string;
  session_id: string;
  file_type: string;
  category: string;
  title: string;
  summary: string;
  updated_at: number;
  tags: string[];
}

/**
 * @deprecated 使用 MemoryListFilters 替代
 */
export interface MemoryStatsResponse {
  total_entries: number;
  storage_used: number;
  memory_count: number;
}

/**
 * @deprecated 使用相关类型替代
 */
export interface MemoryCategoryStat {
  category: string;
  count: number;
}

/**
 * @deprecated 使用相关类型替代
 */
export interface MemoryOverviewResponse {
  stats: MemoryStatsResponse;
  categories: MemoryCategoryStat[];
  entries: MemoryEntryPreview[];
}

/**
 * @deprecated 使用相关类型替代
 */
export interface MemoryAnalysisResult {
  analyzed_sessions: number;
  analyzed_messages: number;
  generated_entries: number;
  deduplicated_entries: number;
}

/**
 * @deprecated 使用相关类型替代
 */
export interface CleanupMemoryResult {
  cleaned_entries: number;
  freed_space: number;
}

// ==================== 辅助函数 ====================

/**
 * 将 UnifiedMemory 转换为 MemoryEntryPreview
 */
function toMemoryEntryPreview(memory: UnifiedMemory): MemoryEntryPreview {
  return {
    id: memory.id,
    session_id: memory.session_id,
    file_type: memory.memory_type,
    category: memory.category,
    title: memory.title,
    summary: memory.summary,
    updated_at: memory.updated_at,
    tags: memory.tags,
  };
}

/**
 * 按分类分组统计
 */
function groupByCategory(memories: UnifiedMemory[]): MemoryCategoryStat[] {
  const categoryMap = new Map<string, number>();

  for (const memory of memories) {
    const count = categoryMap.get(memory.category) || 0;
    categoryMap.set(memory.category, count + 1);
  }

  const CATEGORY_ORDER = ["identity", "context", "preference", "experience", "activity"];

  return CATEGORY_ORDER.map((category) => ({
    category,
    count: categoryMap.get(category) || 0,
  }));
}

// ==================== 兼容 API ====================

/**
 * @deprecated 请使用 listUnifiedMemories() 替代
 *
 * 获取记忆总览（分类 + 条目）
 *
 * @param limit - 结果数量限制
 * @returns 记忆总览
 */
export async function getMemoryOverview(
  limit: number = 120,
): Promise<MemoryOverviewResponse> {
  // 调用新的统一 API
  const entries = await listUnifiedMemories({ limit, sort_by: "updated_at", order: "desc" });

  // 构建 stats
  const sessionIds = new Set(entries.map((e) => e.session_id));
  const stats: MemoryStatsResponse = {
    total_entries: entries.length,
    storage_used: 0, // 暂时估算，后续可从数据库统计
    memory_count: sessionIds.size,
  };

  // 构建分类统计
  const categories = groupByCategory(entries);

  // 转换为旧格式
  const legacyEntries = entries.map(toMemoryEntryPreview);

  return {
    stats,
    categories,
    entries: legacyEntries,
  };
}

/**
 * @deprecated 新的记忆系统不再使用自动分析，请使用 createUnifiedMemory() 手动创建记忆
 *
 * 从历史对话中抽取记忆条目
 *
 * @param fromTimestamp - 开始时间戳（可选）
 * @param toTimestamp - 结束时间戳（可选）
 * @returns 分析结果
 */
export async function requestMemoryAnalysis(
  _fromTimestamp?: number,
  _toTimestamp?: number,
): Promise<MemoryAnalysisResult> {
  console.warn(
    "[Deprecated] requestMemoryAnalysis 已弃用，新系统请使用 createUnifiedMemory() 手动创建记忆",
  );

  // 返回空结果（已弃用）
  return {
    analyzed_sessions: 0,
    analyzed_messages: 0,
    generated_entries: 0,
    deduplicated_entries: 0,
  };
}

/**
 * @deprecated 请使用 deleteUnifiedMemory() 或手动管理记忆归档
 *
 * 清理过期对话记忆
 *
 * @returns 清理结果
 */
export async function cleanupMemory(): Promise<CleanupMemoryResult> {
  console.warn(
    "[Deprecated] cleanupMemory 已弃用，新系统请使用 deleteUnifiedMemory() 或 updateUnifiedMemory() 归档记忆",
  );

  // 返回空结果（已弃用）
  return {
    cleaned_entries: 0,
    freed_space: 0,
  };
}

/**
 * @deprecated 使用 UnifiedMemory 类型替代
 */
export type TauriMemoryConfig = Record<string, unknown>;

/**
 * @deprecated 请使用 create/update/delete 系列 API
 */
export interface Config {
  memory?: TauriMemoryConfig;
}

/**
 * @deprecated 相关功能已整合到统一记忆系统
 */
export async function getCharacter(_id: string): Promise<unknown> {
  console.warn("[Deprecated] getCharacter 已弃用，请使用统一记忆 API");
  return null;
}

/**
 * @deprecated 相关功能已整合到统一记忆系统
 */
export async function listCharacters(_projectId: string): Promise<unknown[]> {
  console.warn("[Deprecated] listCharacters 已弃用，请使用统一记忆 API");
  return [];
}

/**
 * @deprecated 相关功能已整合到统一记忆系统
 */
export async function createCharacter(_request: unknown): Promise<unknown> {
  console.warn("[Deprecated] createCharacter 已弃用，请使用 createUnifiedMemory()");
  return null;
}

/**
 * @deprecated 相关功能已整合到统一记忆系统
 */
export async function updateCharacter(_id: string, _request: unknown): Promise<unknown> {
  console.warn("[Deprecated] updateCharacter 已弃用，请使用 updateUnifiedMemory()");
  return null;
}

/**
 * @deprecated 相关功能已整合到统一记忆系统
 */
export async function deleteCharacter(_id: string): Promise<boolean> {
  console.warn("[Deprecated] deleteCharacter 已弃用，请使用 deleteUnifiedMemory()");
  return false;
}

// ==================== 导出所有类型（保持向后兼容）====================
