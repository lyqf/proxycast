/**
 * 记忆管理系统设置组件
 *
 * 参考 LobeHub 的 memory 实现，扩展更多功能
 * 功能包括：记忆启用/禁用、容量管理、清理功能等
 */

import { useState, useEffect } from "react";
import {
  BrainCircuit,
  Trash2,
  Database,
  AlertCircle,
  Info,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getConfig, saveConfig, Config } from "@/hooks/useTauri";

interface MemoryConfig {
  /** 是否启用记忆功能 */
  enabled: boolean;
  /** 最大记忆条数 */
  max_entries?: number;
  /** 记忆保留天数 */
  retention_days?: number;
  /** 自动清理过期记忆 */
  auto_cleanup?: boolean;
}

interface MemoryStats {
  /** 总记忆条数 */
  total_entries: number;
  /** 已使用的存储空间（字节） */
  storage_used: number;
  /** 记忆库数量 */
  memory_count: number;
}

const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  enabled: true,
  max_entries: 1000,
  retention_days: 30,
  auto_cleanup: true,
};

/**
 * 格式化存储大小
 */
function formatStorageSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function MemorySettings() {
  const [config, setConfig] = useState<Config | null>(null);
  const [memoryConfig, setMemoryConfig] = useState<MemoryConfig>(
    DEFAULT_MEMORY_CONFIG,
  );
  const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // 加载配置
  useEffect(() => {
    loadConfig();
    loadMemoryStats();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const c = await getConfig();
      setConfig(c);
      setMemoryConfig(c.memory || DEFAULT_MEMORY_CONFIG);
    } catch (e) {
      console.error("加载记忆配置失败:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadMemoryStats = async () => {
    try {
      // TODO: 实现获取记忆统计的 API
      // const stats = await getMemoryStats();
      // setMemoryStats(stats);

      // 模拟数据
      setMemoryStats({
        total_entries: 156,
        storage_used: 256000, // 256 KB
        memory_count: 12,
      });
    } catch (e) {
      console.error("加载记忆统计失败:", e);
    }
  };

  // 保存配置
  const saveMemoryConfig = async (key: keyof MemoryConfig, value: any) => {
    if (!config) return;
    setSaving(true);

    try {
      const newConfig = {
        ...memoryConfig,
        [key]: value,
      };
      const updatedFullConfig = {
        ...config,
        memory: newConfig,
      };
      await saveConfig(updatedFullConfig);
      setConfig(updatedFullConfig);
      setMemoryConfig(newConfig);

      showMessage("success", "设置已保存");
    } catch (e) {
      console.error("保存记忆配置失败:", e);
      showMessage("error", "保存失败");
    } finally {
      setSaving(false);
    }
  };

  // 清理记忆
  const handleCleanup = async () => {
    setCleaning(true);
    try {
      // TODO: 实现清理记忆的 API
      // await cleanupMemory();

      // 模拟清理
      await new Promise((resolve) => setTimeout(resolve, 1000));

      showMessage("success", "已清理过期记忆");
      loadMemoryStats(); // 重新加载统计
    } catch (e) {
      console.error("清理记忆失败:", e);
      showMessage("error", "清理失败");
    } finally {
      setCleaning(false);
    }
  };

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const maxEntriesOptions = [100, 500, 1000, 2000, 5000];
  const retentionDaysOptions = [7, 14, 30, 60, 90];

  return (
    <div className="space-y-4 max-w-2xl">
      {/* 记忆统计卡片 */}
      {memoryStats && (
        <div className="rounded-lg border p-4 bg-gradient-to-br from-primary/5 to-primary/10">
          <div className="flex items-center gap-2 mb-3">
            <Database className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-medium">记忆统计</h3>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {memoryStats.total_entries}
              </div>
              <div className="text-xs text-muted-foreground">记忆条数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {formatStorageSize(memoryStats.storage_used)}
              </div>
              <div className="text-xs text-muted-foreground">存储空间</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {memoryStats.memory_count}
              </div>
              <div className="text-xs text-muted-foreground">记忆库数</div>
            </div>
          </div>
        </div>
      )}

      {/* 启用记忆功能 */}
      <div className="rounded-lg border p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-muted-foreground" />
            <div>
              <h3 className="text-sm font-medium">启用记忆功能</h3>
              <p className="text-xs text-muted-foreground">
                让 AI 记住之前的对话内容
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={memoryConfig.enabled}
            onChange={(e) => saveMemoryConfig("enabled", e.target.checked)}
            disabled={loading || saving}
            className="w-4 h-4 rounded border-gray-300"
          />
        </div>
      </div>

      {/* 最大记忆条数 */}
      <div className="rounded-lg border p-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-medium">最大记忆条数</h3>
            <p className="text-xs text-muted-foreground">
              限制保存的记忆条目数量
            </p>
          </div>
          <span className="text-sm font-medium text-primary">
            {memoryConfig.max_entries || 1000}
          </span>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {maxEntriesOptions.map((option) => (
            <button
              key={option}
              onClick={() => saveMemoryConfig("max_entries", option)}
              className={cn(
                "px-2 py-1.5 rounded text-xs font-medium transition-colors border",
                memoryConfig.max_entries === option
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted",
              )}
            >
              {option >= 1000 ? `${option / 1000}k` : option}
            </button>
          ))}
        </div>
      </div>

      {/* 记忆保留天数 */}
      <div className="rounded-lg border p-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-medium">记忆保留天数</h3>
            <p className="text-xs text-muted-foreground">
              自动删除超过指定天数的记忆
            </p>
          </div>
          <span className="text-sm font-medium text-primary">
            {memoryConfig.retention_days || 30} 天
          </span>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {retentionDaysOptions.map((option) => (
            <button
              key={option}
              onClick={() => saveMemoryConfig("retention_days", option)}
              className={cn(
                "px-2 py-1.5 rounded text-xs font-medium transition-colors border",
                memoryConfig.retention_days === option
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted",
              )}
            >
              {option} 天
            </button>
          ))}
        </div>
      </div>

      {/* 自动清理 */}
      <div className="rounded-lg border p-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">自动清理过期记忆</h3>
            <p className="text-xs text-muted-foreground">
              定期自动删除过期的记忆条目
            </p>
          </div>
          <input
            type="checkbox"
            checked={memoryConfig.auto_cleanup ?? true}
            onChange={(e) => saveMemoryConfig("auto_cleanup", e.target.checked)}
            disabled={loading || saving}
            className="w-4 h-4 rounded border-gray-300"
          />
        </div>
      </div>

      {/* 清理按钮 */}
      <div className="rounded-lg border p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-muted-foreground" />
            <div>
              <h3 className="text-sm font-medium">清理记忆</h3>
              <p className="text-xs text-muted-foreground">
                手动清理所有过期和无效的记忆
              </p>
            </div>
          </div>
          <button
            onClick={handleCleanup}
            disabled={loading || cleaning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-sm hover:bg-muted transition-colors disabled:opacity-50"
          >
            {cleaning ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                清理中...
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                立即清理
              </>
            )}
          </button>
        </div>
      </div>

      {/* 提示信息 */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg">
        <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <p>
          记忆功能会让 AI 在对话中记住之前的上下文信息。禁用后，AI
          将无法跨对话记住信息。清理记忆是不可逆操作，请谨慎操作。
        </p>
      </div>

      {/* 消息提示 */}
      {message && (
        <div
          className={cn(
            "flex items-center gap-2 p-3 rounded-lg",
            message.type === "success"
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
          )}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <span className="text-sm">{message.text}</span>
        </div>
      )}
    </div>
  );
}

export default MemorySettings;
