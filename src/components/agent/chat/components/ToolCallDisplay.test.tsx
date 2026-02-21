import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ToolCallState } from "@/lib/api/agent";
import { ToolCallDisplay } from "./ToolCallDisplay";

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
});

function render(toolCall: ToolCallState): HTMLDivElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<ToolCallDisplay toolCall={toolCall} />);
  });

  mountedRoots.push({ container, root });
  return container;
}

describe("ToolCallDisplay", () => {
  it("工具结果包含图片时应渲染缩略图预览", () => {
    const toolCall: ToolCallState = {
      id: "tool-image-1",
      name: "Read",
      status: "completed",
      startTime: new Date(),
      endTime: new Date(),
      result: {
        success: true,
        output: "图片已生成",
        images: [{ src: "data:image/png;base64,aGVsbG8=", mimeType: "image/png" }],
      },
    };

    const container = render(toolCall);
    const previewImage = container.querySelector(
      'img[alt="工具结果图片预览"]',
    ) as HTMLImageElement | null;
    expect(previewImage).not.toBeNull();
    expect(previewImage?.src).toContain("data:image/png;base64,aGVsbG8=");
  });

  it("点击缩略图后应显示大图预览层", () => {
    const toolCall: ToolCallState = {
      id: "tool-image-2",
      name: "Read",
      status: "completed",
      startTime: new Date(),
      endTime: new Date(),
      result: {
        success: true,
        output: "图片已生成",
        images: [{ src: "data:image/png;base64,aGVsbG8=", mimeType: "image/png" }],
      },
    };

    const container = render(toolCall);
    const thumbnail = container.querySelector(
      'img[alt="工具结果图片预览"]',
    ) as HTMLImageElement | null;
    expect(thumbnail).not.toBeNull();

    act(() => {
      thumbnail?.click();
    });

    const enlargedImage = document.querySelector(
      'img[alt="工具结果图片大图"]',
    ) as HTMLImageElement | null;
    expect(enlargedImage).not.toBeNull();
  });
});
