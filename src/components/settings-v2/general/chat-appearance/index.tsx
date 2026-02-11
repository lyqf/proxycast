/**
 * 聊天外观设置组件
 *
 * 参考成熟产品的聊天外观实现
 * 功能包括：聊天气泡样式、字体大小、过渡模式等
 */

import { useState, useEffect } from "react";
import { Type, Sparkles, MessageSquare, Monitor, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { getConfig, saveConfig, Config } from "@/hooks/useTauri";

type TransitionMode = "none" | "fadeIn" | "smooth";
type BubbleStyle = "default" | "minimal" | "colorful";

interface ChatAppearanceConfig {
  fontSize?: number; // 12-18
  transitionMode?: TransitionMode;
  bubbleStyle?: BubbleStyle;
  showAvatar?: boolean;
  showTimestamp?: boolean;
}

const DEFAULT_CHAT_APPEARANCE: ChatAppearanceConfig = {
  fontSize: 14,
  transitionMode: "smooth",
  bubbleStyle: "default",
  showAvatar: true,
  showTimestamp: true,
};

/**
 * 字体大小预览组件
 */
function FontSizePreview({ fontSize }: { fontSize: number }) {
  const sampleText = `这是示例文本

## 标题示例
这是一段普通文本，展示当前的字体大小效果。

- 列表项 1
- 列表项 2

**粗体文本** 和 *斜体文本*
`;

  return (
    <div
      className="p-4 rounded-lg border bg-muted/30 min-h-[120px] prose dark:prose-invert max-w-none"
      style={{ fontSize: `${fontSize}px` }}
    >
      <div className="whitespace-pre-wrap">{sampleText}</div>
    </div>
  );
}

/**
 * 过渡模式预览组件
 */
function TransitionPreview({ mode }: { mode: TransitionMode }) {
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    setMessages([]);
    const timer = setTimeout(() => {
      setMessages(["你好！"]);
    }, 300);
    return () => clearTimeout(timer);
  }, [mode]);

  return (
    <div className="space-y-2 p-4 rounded-lg border bg-muted/30 min-h-[120px]">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={cn(
            "inline-block px-3 py-2 rounded-lg bg-primary text-primary-foreground",
            mode === "fadeIn" && "animate-in fade-in duration-300",
            mode === "smooth" && "transition-all duration-300",
          )}
        >
          {msg}
        </div>
      ))}
    </div>
  );
}

/**
 * 气泡样式预览组件
 */
function BubbleStylePreview({ style }: { style: BubbleStyle }) {
  const bubbles = [
    { text: "你好，有什么可以帮助你的吗？", align: "left" },
    { text: "帮我写一段代码", align: "right" },
  ];

  const getBubbleClass = (align: string) => {
    const baseClass = "max-w-[70%] px-3 py-2 rounded-lg";
    if (style === "minimal") {
      return cn(
        baseClass,
        align === "left"
          ? "bg-muted text-foreground"
          : "bg-primary/20 text-foreground",
      );
    } else if (style === "colorful") {
      return cn(
        baseClass,
        align === "left"
          ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white"
          : "bg-gradient-to-br from-purple-500 to-purple-600 text-white",
      );
    }
    // default
    return cn(
      baseClass,
      align === "left"
        ? "bg-muted text-foreground"
        : "bg-primary text-primary-foreground",
    );
  };

  return (
    <div className="space-y-3 p-4 rounded-lg border bg-muted/30 min-h-[120px]">
      {bubbles.map((bubble, i) => (
        <div
          key={i}
          className={cn(
            "flex",
            bubble.align === "left" ? "justify-start" : "justify-end",
          )}
        >
          <div className={getBubbleClass(bubble.align)}>{bubble.text}</div>
        </div>
      ))}
    </div>
  );
}

export function ChatAppearanceSettings() {
  const [config, setConfig] = useState<Config | null>(null);
  const [chatConfig, setChatConfig] = useState<ChatAppearanceConfig>(
    DEFAULT_CHAT_APPEARANCE,
  );
  const [_loading, setLoading] = useState(true);
  const [_saving, setSaving] = useState<Record<string, boolean>>({});

  // 加载配置
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const c = await getConfig();
      setConfig(c);
      setChatConfig(c.chat_appearance || DEFAULT_CHAT_APPEARANCE);
    } catch (e) {
      console.error("加载聊天外观配置失败:", e);
    } finally {
      setLoading(false);
    }
  };

  // 保存配置
  const saveChatConfig = async (
    key: keyof ChatAppearanceConfig,
    value: any,
  ) => {
    if (!config) return;
    setSaving((prev) => ({ ...prev, [key]: true }));

    try {
      const newConfig = {
        ...chatConfig,
        [key]: value,
      };
      const updatedFullConfig = {
        ...config,
        chat_appearance: newConfig,
      };
      await saveConfig(updatedFullConfig);
      setConfig(updatedFullConfig);
      setChatConfig(newConfig);
    } catch (e) {
      console.error("保存聊天外观配置失败:", e);
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }));
    }
  };

  const transitionModeOptions: {
    value: TransitionMode;
    label: string;
    desc: string;
  }[] = [
    {
      value: "none",
      label: "无动画",
      desc: "消息立即显示",
    },
    {
      value: "fadeIn",
      label: "淡入",
      desc: "消息淡入显示",
    },
    {
      value: "smooth",
      label: "平滑",
      desc: "平滑过渡效果",
    },
  ];

  const bubbleStyleOptions: {
    value: BubbleStyle;
    label: string;
    desc: string;
  }[] = [
    {
      value: "default",
      label: "默认",
      desc: "经典聊天气泡样式",
    },
    {
      value: "minimal",
      label: "简约",
      desc: "简约气泡风格",
    },
    {
      value: "colorful",
      label: "彩色",
      desc: "渐变彩色气泡",
    },
  ];

  return (
    <div className="space-y-4 max-w-2xl">
      {/* 字体大小 */}
      <div className="rounded-lg border p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4 text-muted-foreground" />
            <div>
              <h3 className="text-sm font-medium">字体大小</h3>
              <p className="text-xs text-muted-foreground">
                调整聊天消息的字体大小
              </p>
            </div>
          </div>
          <span className="text-sm font-medium text-primary">
            {chatConfig.fontSize}px
          </span>
        </div>

        <div className="mb-3">
          <input
            type="range"
            min={12}
            max={18}
            step={1}
            value={chatConfig.fontSize || 14}
            onChange={(e) => {
              const value = parseInt(e.target.value);
              setChatConfig((prev) => ({ ...prev, fontSize: value }));
            }}
            onChangeCapture={(e) => {
              saveChatConfig(
                "fontSize",
                parseInt((e.target as HTMLInputElement).value),
              );
            }}
            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <div className="flex justify-between mt-1 text-xs text-muted-foreground">
            <span>小 (12px)</span>
            <span>中 (14px)</span>
            <span>大 (18px)</span>
          </div>
        </div>

        <FontSizePreview fontSize={chatConfig.fontSize || 14} />
      </div>

      {/* 过渡模式 */}
      <div className="rounded-lg border p-3">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <div>
            <h3 className="text-sm font-medium">消息过渡效果</h3>
            <p className="text-xs text-muted-foreground">
              选择消息显示的动画效果
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {transitionModeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => saveChatConfig("transitionMode", option.value)}
              className={cn(
                "px-3 py-2 rounded-lg text-xs font-medium transition-colors border",
                chatConfig.transitionMode === option.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <TransitionPreview mode={chatConfig.transitionMode || "smooth"} />
      </div>

      {/* 气泡样式 */}
      <div className="rounded-lg border p-3">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <div>
            <h3 className="text-sm font-medium">聊天气泡样式</h3>
            <p className="text-xs text-muted-foreground">
              自定义聊天气泡的视觉风格
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {bubbleStyleOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => saveChatConfig("bubbleStyle", option.value)}
              className={cn(
                "px-3 py-2 rounded-lg text-xs font-medium transition-colors border",
                chatConfig.bubbleStyle === option.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <BubbleStylePreview style={chatConfig.bubbleStyle || "default"} />
      </div>

      {/* 显示选项 */}
      <div className="rounded-lg border p-3">
        <div className="flex items-center gap-2 mb-3">
          <Monitor className="h-4 w-4 text-muted-foreground" />
          <div>
            <h3 className="text-sm font-medium">显示选项</h3>
            <p className="text-xs text-muted-foreground">
              控制聊天界面的元素显示
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center justify-between py-1.5 cursor-pointer">
            <span className="text-sm">显示头像</span>
            <input
              type="checkbox"
              checked={chatConfig.showAvatar ?? true}
              onChange={(e) => saveChatConfig("showAvatar", e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
          </label>

          <label className="flex items-center justify-between py-1.5 cursor-pointer border-t">
            <span className="text-sm">显示时间戳</span>
            <input
              type="checkbox"
              checked={chatConfig.showTimestamp ?? true}
              onChange={(e) =>
                saveChatConfig("showTimestamp", e.target.checked)
              }
              className="w-4 h-4 rounded border-gray-300"
            />
          </label>
        </div>
      </div>

      {/* 提示信息 */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg">
        <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <p>
          这些设置会应用到所有聊天对话。部分效果可能需要刷新对话窗口后才能看到。
        </p>
      </div>
    </div>
  );
}

export default ChatAppearanceSettings;
