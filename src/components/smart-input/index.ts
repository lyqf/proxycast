/**
 * @file index.ts
 * @description 截图对话模块导出入口
 * @module components/smart-input
 */

// 类型导出
export type {
  SmartInputConfig,
  MessageImage,
  ChatMessage,
  SmartInputState,
  UseSmartInputReturn,
  SmartInputPreviewProps,
  ChatInputProps,
  ChatMessagesProps,
  SmartInputWindowProps,
} from "./types";

export type { ShortcutSettingsProps } from "./ShortcutSettings";

// 组件导出
export { SmartInputPreview } from "./SmartInputPreview";
export { ChatInput } from "./ChatInput";
export { ChatMessages } from "./ChatMessages";
export { SmartInputWindow } from "./SmartInputWindow";
export { ShortcutSettings } from "./ShortcutSettings";

// Hook 导出
export { useSmartInput, readImageAsBase64 } from "./useSmartInput";

// 默认导出主组件
export { SmartInputWindow as default } from "./SmartInputWindow";
