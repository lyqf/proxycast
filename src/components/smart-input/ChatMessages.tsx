/**
 * @file ChatMessages.tsx
 * @description 消息列表组件，显示用户和 AI 的对话消息
 * @module components/smart-input/ChatMessages
 */

import React, { useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessagesProps, ChatMessage } from "./types";
import "./smart-input.css";

/**
 * 单条消息组件
 */
const MessageItem: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.role === "user";

  return (
    <div
      className={`smart-input-message ${isUser ? "smart-input-message-user" : "smart-input-message-assistant"}`}
    >
      {/* 用户消息显示图片 */}
      {isUser && message.image && (
        <div className="smart-input-message-image">
          <img
            src={`data:${message.image.mediaType};base64,${message.image.data}`}
            alt="截图"
            className="smart-input-message-thumbnail"
          />
        </div>
      )}

      {/* 消息内容 */}
      <div className="smart-input-message-content">
        {message.isThinking ? (
          <div className="smart-input-thinking">
            <span className="smart-input-loading-spinner" />
            <span>{message.thinkingContent || "思考中..."}</span>
          </div>
        ) : isUser ? (
          <p>{message.content}</p>
        ) : (
          <div className="smart-input-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* 时间戳 */}
      <div className="smart-input-message-time">
        {new Date(message.timestamp).toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>
    </div>
  );
};

/**
 * 消息列表组件
 *
 * 显示用户消息和 AI 回复，支持 Markdown 渲染和自动滚动
 *
 * 需求:
 * - 4.5: 悬浮窗口应在可滚动区域显示 AI 回复
 * - 5.4: 当 AI 回复时，悬浮窗口应以 Markdown 格式渲染回复内容
 */
export const ChatMessages: React.FC<ChatMessagesProps> = ({
  messages,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className={`smart-input-messages ${className}`}>
        <div className="smart-input-placeholder">
          输入问题，开始与 AI 讨论截图内容
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`smart-input-messages ${className}`}>
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
    </div>
  );
};

export default ChatMessages;
