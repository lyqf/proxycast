/**
 * AI 代码验证工具配置类型
 */

export interface Config {
  /**
   * 验证等级（0-2）
   * - Level 0: 基本验证 + 一致性检查
   * - Level 1: Level 0 + 安全审查 + 自我批评
   * - Level 2: Level 1 + 深度反思
   */
  level: number

  /**
   * 是否启用验证
   */
  enabled: boolean

  /**
   * 忽略的文件/目录模式
   */
  ignorePatterns: string[]

  /**
   * 白名单：仅验证这些文件（glob 模式）
   */
  includePatterns?: string[]

  /**
   * 是否生成 AI Prompt（而非调 API）
   * true: 输出 Prompt 供用户复制到 AI 对话框
   * false: 仅运行静态检查
   */
  generatePrompt?: boolean

  /**
   * 最低通过分数
   */
  minScore?: number
}
