import React, { useState, useEffect, useRef } from "react";
import { type Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
} from "lucide-react";

interface BubbleToolbarProps {
  editor: Editor;
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  children: React.ReactNode;
  title: string;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  onClick,
  isActive,
  children,
  title,
}) => (
  <button
    type="button"
    onMouseDown={(e) => {
      e.preventDefault();
      onClick();
    }}
    title={title}
    className={`p-1.5 rounded transition-colors ${
      isActive
        ? "bg-accent text-accent-foreground"
        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
    }`}
  >
    {children}
  </button>
);

export const BubbleToolbar: React.FC<BubbleToolbarProps> = ({ editor }) => {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateToolbar = () => {
      const { from, to, empty } = editor.state.selection;
      if (empty || from === to) {
        setVisible(false);
        return;
      }

      setVisible(true);

      const { view } = editor;
      const start = view.coordsAtPos(from);
      const end = view.coordsAtPos(to);
      const wrapper = view.dom.closest(".notion-editor-wrapper");
      if (!wrapper) return;

      const wrapperRect = wrapper.getBoundingClientRect();
      const toolbarWidth = toolbarRef.current?.offsetWidth ?? 300;

      setPosition({
        top: start.top - wrapperRect.top - 44,
        left: (start.left + end.left) / 2 - wrapperRect.left - toolbarWidth / 2,
      });
    };

    editor.on("selectionUpdate", updateToolbar);
    editor.on("blur", () => {
      // 延迟隐藏，允许点击工具栏按钮
      setTimeout(() => setVisible(false), 200);
    });

    return () => {
      editor.off("selectionUpdate", updateToolbar);
    };
  }, [editor]);

  if (!visible) return null;

  return (
    <div
      ref={toolbarRef}
      className="absolute z-50 flex items-center gap-0.5 rounded-lg border border-border px-1 py-0.5 shadow-lg"
      style={{
        top: position.top,
        left: position.left,
        background: "hsl(var(--background))",
      }}
    >
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        title="粗体"
      >
        <Bold className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        title="斜体"
      >
        <Italic className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
        title="删除线"
      >
        <Strikethrough className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive("code")}
        title="行内代码"
      >
        <Code className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        isActive={editor.isActive("highlight")}
        title="高亮"
      >
        <Highlighter className="w-4 h-4" />
      </ToolbarButton>

      <div className="w-px h-5 bg-border mx-0.5" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive("heading", { level: 1 })}
        title="标题 1"
      >
        <Heading1 className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive("heading", { level: 2 })}
        title="标题 2"
      >
        <Heading2 className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive("heading", { level: 3 })}
        title="标题 3"
      >
        <Heading3 className="w-4 h-4" />
      </ToolbarButton>
    </div>
  );
};
