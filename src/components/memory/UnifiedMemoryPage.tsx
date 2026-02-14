/**
 * 统一记忆页面
 *
 * 使用新的 unified memory API 替代旧的 API
 */

import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { UnifiedMemory } from "@/lib/api/unifiedMemory";

export default function UnifiedMemoryPage() {
  const [memories, setMemories] = useState<UnifiedMemory[]>([]);
  const [loading, setLoading] = useState(false);

  const loadMemories = async () => {
    setLoading(true);
    try {
      const result = await invoke<UnifiedMemory[]>("unified_memory_list", {
        filters: { limit: 50 },
      });
      setMemories(result);
      console.log("加载记忆成功:", result);
    } catch (error) {
      console.error("加载失败:", error);
      alert(`加载失败: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const createMemory = async () => {
    const title = prompt("记忆标题:");
    const content = prompt("记忆内容:");
    const summary = prompt("记忆摘要:");

    if (!title || !content || !summary) {
      alert("请填写完整信息");
      return;
    }

    try {
      const result = await invoke<UnifiedMemory>("unified_memory_create", {
        request: {
          session_id: `session-${Date.now()}`,
          title,
          content,
          summary,
        },
      });

      console.log("创建成功:", result);
      alert(`创建成功！ID: ${result.id}`);

      // 刷新列表
      await loadMemories();
    } catch (error) {
      console.error("创建失败:", error);
      alert(`创建失败: ${error}`);
    }
  };

  const deleteMemory = async (id: string) => {
    if (!confirm(`确定要删除记忆 ${id}？`)) {
      return;
    }

    try {
      const result = await invoke<boolean>("unified_memory_delete", { id });
      console.log("删除成功:", result);

      if (result) {
        alert("删除成功");
        await loadMemories(); // 刷新列表
      } else {
        alert("删除失败或记忆不存在");
      }
    } catch (error) {
      console.error("删除失败:", error);
      alert(`删除失败: ${error}`);
    }
  };

  // 初始加载
  useState(() => {
    loadMemories();
  });

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <h2>🧠 统一记忆系统</h2>

      <div style={{ marginBottom: "20px" }}>
        <button onClick={loadMemories} disabled={loading}>
          {loading ? "加载中..." : "🔄 刷新记忆列表"}
        </button>

        <button
          onClick={createMemory}
          style={{ background: "#10b981", color: "white" }}
        >
          ➕ 创建新记忆
        </button>
      </div>

      {loading && (
        <div
          style={{
            padding: "20px",
            textAlign: "center",
            color: "#666",
          }}
        >
          加载中...
        </div>
      )}

      {!loading && memories.length === 0 && (
        <div
          style={{
            padding: "40px",
            textAlign: "center",
            color: "#666",
            background: "#f5f5f5",
            borderRadius: "8px",
          }}
        >
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>📭</div>
          <div>暂无记忆数据</div>
          <div style={{ fontSize: "14px", color: "#999" }}>
            点击"创建新记忆"开始使用统一记忆系统
          </div>
        </div>
      )}

      {!loading && memories.length > 0 && (
        <div style={{ maxHeight: "600px", overflowY: "auto" }}>
          {memories.map((memory) => (
            <div
              key={memory.id}
              style={{
                padding: "15px",
                marginBottom: "15px",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                background: "#fafafa",
                transition: "background 0.2s",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: "600",
                      fontSize: "16px",
                      color: "#333",
                      marginBottom: "4px",
                    }}
                  >
                    {memory.title}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#666",
                    }}
                  >
                    {memory.category}
                  </div>
                </div>

                <button
                  onClick={() => deleteMemory(memory.id)}
                  style={{
                    padding: "4px 8px",
                    fontSize: "12px",
                    background: "#dc3545",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  🗑️ 删除
                </button>
              </div>

              <div style={{ fontSize: "13px", color: "#666" }}>
                {memory.summary || "暂无摘要"}
              </div>

              <div
                style={{
                  fontSize: "12px",
                  color: "#999",
                  marginTop: "8px",
                }}
              >
                📅 {new Date(memory.created_at).toLocaleString()}
              </div>

              <div style={{ fontSize: "11px", color: "#999" }}>
                💬 {memory.session_id}
              </div>
              </div>
            ))}
          </div>
      )}

      <div
        style={{
          marginTop: "30px",
          padding: "15px",
          background: "#e7f3ff",
          border: "1px solid #d1d5db",
          borderRadius: "8px",
        }}
      >
        <h4>💡 使用说明</h4>
        <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "14px", color: "#333" }}>
          <li>点击"刷新记忆列表"加载所有记忆</li>
          <li>点击"创建新记忆"添加测试数据</li>
          <li>点击"删除"按钮软删除记忆（数据不会真正删除）</li>
          <li>所有操作会在控制台输出详细日志</li>
        </ul>
      </div>
    </div>
  );
}
