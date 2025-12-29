import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  Play,
  Square,
  Send,
  Loader2,
  MessageSquare,
  Bot,
  User,
  ChevronDown,
  ChevronUp,
  Settings2,
  Monitor,
  Maximize,
  Trash2,
  X,
  Plus,
  History,
  Download,
} from "lucide-react";
import {
  startAgentProcess,
  stopAgentProcess,
  getAgentProcessStatus,
  createAgentSession,
  sendAgentMessage,
  type AgentProcessStatus,
  type CreateSessionResponse,
} from "@/lib/api/agent";
import {
  isAsterInstalled,
  installAster,
  type DownloadProgress,
} from "@/lib/api/binary";
import { listen } from "@tauri-apps/api/event";
import { windowApi, type WindowSizeOption } from "@/lib/api/window";
import { cn } from "@/lib/utils";

interface MessageImage {
  data: string; // base64 encoded image
  mediaType: string; // e.g., "image/png"
}

interface Message {
  role: "user" | "assistant";
  content: string;
  images?: MessageImage[];
  timestamp: Date;
}

// Provider 配置，包含推荐模型
const PROVIDER_CONFIG: Record<string, { label: string; models: string[] }> = {
  claude: {
    label: "Claude",
    models: [
      "claude-opus-4-5-20251101",
      "claude-sonnet-4-5-20250929",
      "claude-sonnet-4-20250514",
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
    ],
  },
  kiro: {
    label: "Kiro",
    models: [
      "claude-sonnet-4-5-20250929",
      "claude-sonnet-4-20250514",
      "claude-3-5-sonnet-20241022",
    ],
  },
  openai: {
    label: "OpenAI",
    models: [
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4-turbo",
      "o1",
      "o1-mini",
      "o3",
      "o3-mini",
    ],
  },
  gemini: {
    label: "Gemini",
    models: ["gemini-2.0-flash-exp", "gemini-1.5-pro", "gemini-1.5-flash"],
  },
  qwen: {
    label: "通义千问",
    models: ["qwen-max", "qwen-plus", "qwen-turbo"],
  },
  codex: {
    label: "Codex",
    models: ["codex-mini-latest"],
  },
  claude_oauth: {
    label: "Claude OAuth",
    models: ["claude-sonnet-4-5-20250929", "claude-3-5-sonnet-20241022"],
  },
  iflow: {
    label: "iFlow",
    models: [],
  },
  antigravity: {
    label: "Antigravity",
    models: [
      "gemini-claude-sonnet-4-5",
      "gemini-claude-sonnet-4-5-thinking",
      "gemini-claude-opus-4-5-thinking",
    ],
  },
};

// 历史会话类型
interface ChatSession {
  id: string;
  title: string;
  providerType: string;
  model: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

// 从 sessionStorage 恢复状态的辅助函数
const loadFromStorage = <T,>(key: string, defaultValue: T): T => {
  try {
    const stored = sessionStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      // 特殊处理 messages，恢复 Date 对象
      if (key === "agent_messages" && Array.isArray(parsed)) {
        return parsed.map((msg: Message & { timestamp: string }) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        })) as T;
      }
      return parsed;
    }
  } catch (e) {
    console.error(`Failed to load ${key} from storage:`, e);
  }
  return defaultValue;
};

// 保存到 sessionStorage 的辅助函数
const saveToStorage = (key: string, value: unknown) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Failed to save ${key} to storage:`, e);
  }
};

// 从 localStorage 加载历史会话
const loadChatHistory = (): ChatSession[] => {
  try {
    const stored = localStorage.getItem("agent_chat_history");
    if (stored) {
      const sessions = JSON.parse(stored);
      return sessions.map(
        (
          s: ChatSession & {
            createdAt: string;
            updatedAt: string;
            messages: (Message & { timestamp: string })[];
          },
        ) => ({
          ...s,
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt),
          messages: s.messages.map((m) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          })),
        }),
      );
    }
  } catch (e) {
    console.error("Failed to load chat history:", e);
  }
  return [];
};

// 保存历史会话到 localStorage
const saveChatHistory = (sessions: ChatSession[]) => {
  try {
    localStorage.setItem("agent_chat_history", JSON.stringify(sessions));
  } catch (e) {
    console.error("Failed to save chat history:", e);
  }
};

export function AgentChatPage() {
  const [processStatus, setProcessStatus] = useState<AgentProcessStatus>({
    running: false,
  });
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  // 从 sessionStorage 恢复会话状态
  const [sessionId, setSessionId] = useState<string | null>(() =>
    loadFromStorage("agent_sessionId", null),
  );
  const [sessionInfo, setSessionInfo] = useState<CreateSessionResponse | null>(
    () => loadFromStorage("agent_sessionInfo", null),
  );
  const [providerType, setProviderType] = useState(() =>
    loadFromStorage("agent_providerType", "claude"),
  );
  const [model, setModel] = useState(() => loadFromStorage("agent_model", ""));
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  // 从 sessionStorage 恢复消息
  const [messages, setMessages] = useState<Message[]>(() =>
    loadFromStorage("agent_messages", []),
  );
  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  // 待发送的图片
  const [pendingImages, setPendingImages] = useState<MessageImage[]>([]);

  // 历史会话
  const [chatHistory, setChatHistory] = useState<ChatSession[]>(() =>
    loadChatHistory(),
  );
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() =>
    loadFromStorage("agent_currentSessionId", null),
  );
  const [showHistory, setShowHistory] = useState(false);

  // 控制面板折叠状态 - 如果有会话则默认折叠
  const [isControlOpen, setIsControlOpen] = useState(
    () => !loadFromStorage("agent_sessionId", null),
  );

  // 窗口大小状态
  const [windowSizeOptions, setWindowSizeOptions] = useState<
    WindowSizeOption[]
  >([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showWindowMenu, setShowWindowMenu] = useState(false);

  // aster-server 安装状态
  const [asterInstalled, setAsterInstalled] = useState<boolean | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installProgress, setInstallProgress] =
    useState<DownloadProgress | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 获取当前 Provider 的推荐模型
  const currentProviderModels = PROVIDER_CONFIG[providerType]?.models || [];

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 保存状态到 sessionStorage
  useEffect(() => {
    saveToStorage("agent_sessionId", sessionId);
  }, [sessionId]);

  useEffect(() => {
    saveToStorage("agent_sessionInfo", sessionInfo);
  }, [sessionInfo]);

  useEffect(() => {
    saveToStorage("agent_providerType", providerType);
  }, [providerType]);

  useEffect(() => {
    saveToStorage("agent_model", model);
  }, [model]);

  useEffect(() => {
    saveToStorage("agent_messages", messages);
  }, [messages]);

  // 加载进程状态和检查安装状态
  useEffect(() => {
    loadProcessStatus();
    // 检查 aster-server 是否已安装
    isAsterInstalled()
      .then(setAsterInstalled)
      .catch(() => setAsterInstalled(false));

    // 监听下载进度事件
    const unlisten = listen<DownloadProgress>(
      "binary-download-progress",
      (event) => {
        setInstallProgress(event.payload);
      },
    );

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // 快速安装 aster-server
  const handleQuickInstall = async () => {
    setIsInstalling(true);
    setInstallProgress(null);
    try {
      await installAster();
      toast.success("aster-server 安装成功");
      setAsterInstalled(true);
    } catch (error) {
      toast.error(`安装失败: ${error}`);
    } finally {
      setIsInstalling(false);
      setInstallProgress(null);
    }
  };

  // 当 Provider 改变时，重置模型选择（但不在初始加载时触发）
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setModel("");
  }, [providerType]);

  // 初始化窗口大小选项
  useEffect(() => {
    const loadWindowOptions = async () => {
      try {
        const options = await windowApi.getWindowSizeOptions();
        setWindowSizeOptions(options);
        const fullscreen = await windowApi.isFullscreen();
        setIsFullscreen(fullscreen);
      } catch (error) {
        console.error("加载窗口选项失败:", error);
      }
    };
    loadWindowOptions();
  }, []);

  // 点击外部关闭窗口菜单和历史会话菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showWindowMenu && !target.closest(".window-menu-container")) {
        setShowWindowMenu(false);
      }
      if (showHistory && !target.closest(".history-menu-container")) {
        setShowHistory(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showWindowMenu, showHistory]);

  // 当会话创建成功后，自动折叠控制面板
  useEffect(() => {
    if (sessionId) {
      setIsControlOpen(false);
    }
  }, [sessionId]);

  const loadProcessStatus = async () => {
    try {
      const status = await getAgentProcessStatus();
      setProcessStatus(status);
    } catch (error) {
      console.error("获取进程状态失败:", error);
    }
  };

  const handleStartProcess = async () => {
    setIsStarting(true);
    try {
      const status = await startAgentProcess();
      setProcessStatus(status);
      toast.success("aster 进程启动成功");
    } catch (error) {
      toast.error(`启动失败: ${error}`);
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopProcess = async () => {
    setIsStopping(true);
    try {
      await stopAgentProcess();
      setProcessStatus({ running: false });
      setSessionId(null);
      setSessionInfo(null);
      setMessages([]);
      toast.success("aster 进程已停止");
    } catch (error) {
      toast.error(`停止失败: ${error}`);
    } finally {
      setIsStopping(false);
    }
  };

  const handleCreateSession = async () => {
    if (!processStatus.running) {
      toast.error("请先启动 aster 进程");
      return;
    }

    setIsCreatingSession(true);
    try {
      const response = await createAgentSession(
        providerType,
        model || undefined,
      );
      setSessionId(response.session_id);
      setSessionInfo(response);
      setMessages([]);
      toast.success(`会话创建成功，使用凭证: ${response.credential_name}`);
    } catch (error) {
      toast.error(`创建会话失败: ${error}`);
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleSendMessage = async () => {
    if (!sessionId || (!inputMessage.trim() && pendingImages.length === 0))
      return;

    // 检查是否有图片
    const hasImages = pendingImages.length > 0;

    const userMessage: Message = {
      role: "user",
      content: inputMessage,
      images: hasImages ? [...pendingImages] : undefined,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setPendingImages([]);
    setIsSending(true);

    try {
      // 准备图片数据（转换为 API 格式）
      const imagesToSend = hasImages
        ? userMessage.images?.map((img) => ({
            data: img.data,
            media_type: img.mediaType,
          }))
        : undefined;

      const response = await sendAgentMessage(
        inputMessage || "",
        model || undefined,
        imagesToSend,
      );
      const assistantMessage: Message = {
        role: "assistant",
        content: response || "(无响应)",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      toast.error(`发送消息失败: ${error}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 处理粘贴事件（支持图片）
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            // 移除 data:image/xxx;base64, 前缀
            const base64Data = base64.split(",")[1];
            const mediaType = item.type;
            setPendingImages((prev) => [
              ...prev,
              { data: base64Data, mediaType },
            ]);
            toast.success("图片已添加");
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  };

  // 移除待发送的图片
  const handleRemoveImage = (index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearMessages = () => {
    setMessages([]);
    toast.success("对话已清空");
  };

  // 保存当前会话到历史
  const saveCurrentSession = useCallback(() => {
    if (messages.length === 0) return;

    const now = new Date();
    const title = messages[0]?.content?.slice(0, 30) || "新会话";

    if (currentSessionId) {
      // 更新现有会话
      setChatHistory((prev) => {
        const updated = prev.map((s) =>
          s.id === currentSessionId
            ? { ...s, messages, updatedAt: now, title }
            : s,
        );
        saveChatHistory(updated);
        return updated;
      });
    } else {
      // 创建新会话
      const newSession: ChatSession = {
        id: crypto.randomUUID(),
        title,
        providerType,
        model,
        messages,
        createdAt: now,
        updatedAt: now,
      };
      setCurrentSessionId(newSession.id);
      saveToStorage("agent_currentSessionId", newSession.id);
      setChatHistory((prev) => {
        const updated = [newSession, ...prev];
        saveChatHistory(updated);
        return updated;
      });
    }
  }, [messages, currentSessionId, providerType, model]);

  // 当消息变化时自动保存
  useEffect(() => {
    if (messages.length > 0) {
      saveCurrentSession();
    }
  }, [messages, saveCurrentSession]);

  // 加载历史会话
  const handleLoadSession = (session: ChatSession) => {
    setMessages(session.messages);
    setProviderType(session.providerType);
    setModel(session.model);
    setCurrentSessionId(session.id);
    saveToStorage("agent_currentSessionId", session.id);
    setShowHistory(false);
    toast.success("已加载会话");
  };

  // 删除历史会话
  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChatHistory((prev) => {
      const updated = prev.filter((s) => s.id !== sessionId);
      saveChatHistory(updated);
      return updated;
    });
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
      setMessages([]);
      saveToStorage("agent_currentSessionId", null);
    }
    toast.success("会话已删除");
  };

  // 创建新会话
  const handleNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    saveToStorage("agent_currentSessionId", null);
    setShowHistory(false);
  };

  const handleSetWindowSize = async (optionId: string) => {
    try {
      await windowApi.setWindowSizeByOption(optionId);
      setShowWindowMenu(false);
    } catch (error) {
      console.error("设置窗口大小失败:", error);
    }
  };

  const handleToggleFullscreen = async () => {
    try {
      const newFullscreenState = await windowApi.toggleFullscreen();
      setIsFullscreen(newFullscreenState);
      setShowWindowMenu(false);
    } catch (error) {
      console.error("切换全屏模式失败:", error);
    }
  };

  // 如果 aster-server 未安装，显示提示
  if (asterInstalled === false) {
    return (
      <div className="flex flex-col h-[calc(100vh-3rem)]">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Bot className="h-6 w-6" />
              AI Agent
            </h2>
            <p className="text-muted-foreground text-sm">
              基于 aster 框架的 AI Agent 对话
            </p>
          </div>
        </div>
        <Card className="flex-1 flex items-center justify-center">
          <CardContent className="text-center py-12 max-w-md">
            <Bot className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">aster-server 未安装</h3>
            <p className="text-muted-foreground mb-6">
              AI Agent 功能需要安装 aster-server 组件才能使用
            </p>

            {/* 下载进度 */}
            {installProgress && (
              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-sm">
                  <span>下载中...</span>
                  <span>{installProgress.percentage.toFixed(1)}%</span>
                </div>
                <Progress value={installProgress.percentage} />
                <p className="text-xs text-muted-foreground">
                  {(installProgress.downloaded / 1024 / 1024).toFixed(1)} MB /{" "}
                  {(installProgress.total / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
            )}

            {/* 安装按钮 */}
            <Button
              size="lg"
              onClick={handleQuickInstall}
              disabled={isInstalling}
              className="mb-4"
            >
              {isInstalling ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {isInstalling ? "安装中..." : "立即安装"}
            </Button>

            <p className="text-xs text-muted-foreground">
              或前往 <span className="font-medium">扩展 → 插件</span>{" "}
              页面管理组件
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      {/* 页面头部 */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6" />
            AI Agent
          </h2>
          <p className="text-muted-foreground text-sm">
            基于 aster 框架的 AI Agent 对话
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* 状态指示 */}
          <Badge variant={processStatus.running ? "default" : "secondary"}>
            {processStatus.running ? "运行中" : "已停止"}
          </Badge>
          {sessionInfo && (
            <Badge variant="outline" className="hidden sm:flex">
              {sessionInfo.credential_name}
            </Badge>
          )}

          {/* 新建对话 */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleNewChat}
            title="新建对话"
          >
            <Plus className="h-4 w-4" />
          </Button>

          {/* 历史会话 */}
          <div className="relative history-menu-container">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
              title="历史会话"
            >
              <History className="h-4 w-4" />
              {chatHistory.length > 0 && (
                <span className="ml-1 text-xs">{chatHistory.length}</span>
              )}
            </Button>

            {showHistory && (
              <div className="absolute right-0 top-full mt-1 z-[100] w-72 max-h-96 overflow-auto rounded-lg border bg-background shadow-xl">
                <div className="sticky top-0 bg-background px-3 py-2 border-b">
                  <div className="font-medium text-sm">历史会话</div>
                </div>
                {chatHistory.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    暂无历史会话
                  </div>
                ) : (
                  <div className="p-1">
                    {chatHistory.map((session) => (
                      <div
                        key={session.id}
                        onClick={() => handleLoadSession(session)}
                        className={cn(
                          "flex items-center justify-between p-2 rounded cursor-pointer hover:bg-accent group",
                          currentSessionId === session.id && "bg-accent",
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {session.title || "新会话"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {session.messages.length} 条消息 ·{" "}
                            {session.updatedAt.toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleDeleteSession(session.id, e)}
                          className="p-1 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 窗口大小调整 */}
          <div className="relative window-menu-container">
            <button
              onClick={() => setShowWindowMenu(!showWindowMenu)}
              className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm hover:bg-muted"
              title="调整窗口大小"
            >
              <Monitor className="h-4 w-4" />
              <ChevronDown className="h-3 w-3" />
            </button>

            {showWindowMenu && (
              <div className="absolute right-0 top-full mt-1 z-[100] min-w-[200px] rounded-lg border bg-background p-1 shadow-xl">
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                  窗口大小
                </div>
                {windowSizeOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleSetWindowSize(option.id)}
                    className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent hover:text-accent-foreground"
                  >
                    <div className="font-medium">{option.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {option.description}
                    </div>
                  </button>
                ))}
                <div className="my-1 h-px bg-border" />
                <button
                  onClick={handleToggleFullscreen}
                  className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                >
                  <Maximize className="h-4 w-4" />
                  <div>
                    <div className="font-medium">
                      {isFullscreen ? "退出全屏" : "全屏模式"}
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 可折叠的控制面板 */}
      <Collapsible
        open={isControlOpen}
        onOpenChange={setIsControlOpen}
        className="shrink-0 mb-4"
      >
        <Card>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                <span className="font-medium">控制面板</span>
                {!isControlOpen && sessionInfo && (
                  <span className="text-sm text-muted-foreground">
                    ·{" "}
                    {PROVIDER_CONFIG[sessionInfo.provider_type]?.label ||
                      sessionInfo.provider_type}
                    {sessionInfo.model && ` · ${sessionInfo.model}`}
                  </span>
                )}
              </div>
              {isControlOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-4 space-y-4">
              {/* 进程控制 */}
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium w-16">进程</Label>
                <Button
                  size="sm"
                  onClick={handleStartProcess}
                  disabled={processStatus.running || isStarting}
                >
                  {isStarting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleStopProcess}
                  disabled={!processStatus.running || isStopping}
                >
                  {isStopping ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </Button>
                {processStatus.running && processStatus.base_url && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {processStatus.base_url}
                  </span>
                )}
              </div>

              {/* 会话配置 */}
              <div className="flex items-center gap-2 flex-wrap">
                <Label className="text-sm font-medium w-16">会话</Label>
                <Select value={providerType} onValueChange={setProviderType}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROVIDER_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {currentProviderModels.length > 0 ? (
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="选择模型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">默认模型</SelectItem>
                      {currentProviderModels.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="模型名称"
                    className="w-48"
                  />
                )}

                <Button
                  size="sm"
                  onClick={handleCreateSession}
                  disabled={!processStatus.running || isCreatingSession}
                >
                  {isCreatingSession ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <MessageSquare className="mr-2 h-4 w-4" />
                  )}
                  创建新会话
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* 对话区域 - 占据剩余空间 */}
      <Card className="flex-1 flex flex-col min-h-0">
        {/* 对话区域头部 */}
        {messages.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
            <span className="text-sm text-muted-foreground">
              {messages.length} 条消息
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearMessages}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              清空对话
            </Button>
          </div>
        )}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{sessionId ? "开始对话吧" : "创建会话后开始对话"}</p>
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex gap-3",
                    message.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  {message.role === "assistant" && (
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                        <Bot className="h-4 w-4 text-primary-foreground" />
                      </div>
                    </div>
                  )}

                  <div
                    className={cn(
                      "max-w-[70%] rounded-lg px-4 py-2",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted",
                    )}
                  >
                    {/* 显示图片 */}
                    {message.images && message.images.length > 0 && (
                      <div className="flex gap-2 flex-wrap mb-2">
                        {message.images.map((img, imgIndex) => (
                          <img
                            key={imgIndex}
                            src={`data:${img.mediaType};base64,${img.data}`}
                            alt={`图片 ${imgIndex + 1}`}
                            className="max-h-48 max-w-full rounded cursor-pointer hover:opacity-90"
                            onClick={() => {
                              // 点击放大查看
                              window.open(
                                `data:${img.mediaType};base64,${img.data}`,
                                "_blank",
                              );
                            }}
                          />
                        ))}
                      </div>
                    )}
                    {message.content && (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                    <p className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>

                  {message.role === "user" && (
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                        <User className="h-4 w-4" />
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* 输入区域 */}
        <div className="border-t p-4 shrink-0 space-y-2">
          {/* 待发送图片预览 */}
          {pendingImages.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {pendingImages.map((img, index) => (
                <div key={index} className="relative group">
                  <img
                    src={`data:${img.mediaType};base64,${img.data}`}
                    alt={`待发送图片 ${index + 1}`}
                    className="h-16 w-16 object-cover rounded border"
                  />
                  <button
                    onClick={() => handleRemoveImage(index)}
                    className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              onPaste={handlePaste}
              placeholder={sessionId ? "输入消息或粘贴图片..." : "请先创建会话"}
              disabled={!sessionId || isSending}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={
                !sessionId ||
                isSending ||
                (!inputMessage.trim() && pendingImages.length === 0)
              }
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
