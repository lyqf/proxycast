import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MessageList } from "./MessageList";
import type { Message } from "../types";

vi.mock("./MarkdownRenderer", () => ({
  MarkdownRenderer: ({ content }: { content: string }) => (
    <div data-testid="markdown-renderer">{content || "<empty>"}</div>
  ),
}));

vi.mock("./StreamingRenderer", () => ({
  StreamingRenderer: ({ content }: { content: string }) => (
    <div data-testid="streaming-renderer">{content || "<empty-assistant>"}</div>
  ),
}));

vi.mock("./TokenUsageDisplay", () => ({
  TokenUsageDisplay: () => <div data-testid="token-usage-display" />,
}));

interface MountedHarness {
  container: HTMLDivElement;
  root: Root;
}

const mountedRoots: MountedHarness[] = [];

beforeEach(() => {
  (
    globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = () => {};
  }
});

afterEach(() => {
  while (mountedRoots.length > 0) {
    const mounted = mountedRoots.pop();
    if (!mounted) break;
    act(() => {
      mounted.root.unmount();
    });
    mounted.container.remove();
  }
  vi.clearAllMocks();
});

function render(messages: Message[]): HTMLDivElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<MessageList messages={messages} />);
  });

  mountedRoots.push({ container, root });
  return container;
}

describe("MessageList", () => {
  it("应过滤空白 user 消息，避免渲染空白气泡", () => {
    const now = new Date();
    const messages: Message[] = [
      {
        id: "msg-user-empty",
        role: "user",
        content: "",
        timestamp: now,
      },
      {
        id: "msg-user-text",
        role: "user",
        content: "请继续生成",
        timestamp: now,
      },
      {
        id: "msg-assistant",
        role: "assistant",
        content: "好的，我继续处理。",
        timestamp: now,
      },
    ];

    const container = render(messages);

    const markdownTexts = Array.from(
      container.querySelectorAll('[data-testid="markdown-renderer"]'),
    ).map((node) => node.textContent);
    expect(markdownTexts).toEqual(["请继续生成"]);

    const streamingTexts = Array.from(
      container.querySelectorAll('[data-testid="streaming-renderer"]'),
    ).map((node) => node.textContent);
    expect(streamingTexts).toEqual(["好的，我继续处理。"]);
  });
});
