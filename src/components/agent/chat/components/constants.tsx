import React from "react";
import { GraduationCap, Zap, RefreshCw, LayoutTemplate } from "lucide-react";
import type { CreationMode } from "./types";

/**
 * 模式配置
 */
export const CREATION_MODE_CONFIG: Record<
  CreationMode,
  {
    name: string;
    icon: React.ReactNode;
    aiRole: string;
    userInvolvement: "high" | "medium" | "low";
    description: string;
  }
> = {
  guided: {
    name: "引导模式",
    icon: <GraduationCap className="w-4 h-4" />,
    aiRole: "教练（提问引导）",
    userInvolvement: "high",
    description: "追求真实性、个人经历类内容",
  },
  fast: {
    name: "快速模式",
    icon: <Zap className="w-4 h-4" />,
    aiRole: "助手（生成初稿）",
    userInvolvement: "low",
    description: "信息整理、快速产出",
  },
  hybrid: {
    name: "混合模式",
    icon: <RefreshCw className="w-4 h-4" />,
    aiRole: "协作者（写框架）",
    userInvolvement: "medium",
    description: "平衡质量和效率",
  },
  framework: {
    name: "框架模式",
    icon: <LayoutTemplate className="w-4 h-4" />,
    aiRole: "填充者（按框架生成）",
    userInvolvement: "medium",
    description: "固定格式文档（报告、标书）",
  },
};
