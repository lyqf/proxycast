import { useState } from "react";
import { cn } from "@/lib/utils";
import { GeneralSettings } from "./GeneralSettings";
import { AboutSection } from "./AboutSection";
import { ExtensionsSettings } from "./ExtensionsSettings";
import { DeveloperSettings } from "./DeveloperSettings";
import { ConnectionsSettings } from "./ConnectionsSettings";
import { ExperimentalSettings } from "./ExperimentalSettings";
import { ExternalToolsSettings } from "./ExternalToolsSettings";

type SettingsTab =
  | "general"
  | "connections"
  | "tools"
  | "extensions"
  | "experimental"
  | "developer"
  | "about";

const tabs: { id: SettingsTab; label: string; experimental?: boolean }[] = [
  { id: "general", label: "通用" },
  { id: "connections", label: "连接" },
  { id: "tools", label: "外部工具" },
  { id: "extensions", label: "扩展", experimental: true },
  { id: "experimental", label: "实验室", experimental: true },
  { id: "developer", label: "开发者" },
  { id: "about", label: "关于" },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">设置</h2>
        <p className="text-muted-foreground">配置应用参数和偏好</p>
      </div>

      {/* 标签页 */}
      <div className="flex gap-1 border-b mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors relative",
              activeTab === tab.id
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.experimental && (
              <span className="text-[8px] text-red-500 ml-1">(实验)</span>
            )}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto">
        {activeTab === "general" && <GeneralSettings />}
        {activeTab === "connections" && <ConnectionsSettings />}
        {activeTab === "tools" && <ExternalToolsSettings />}
        {activeTab === "extensions" && <ExtensionsSettings />}
        {activeTab === "experimental" && <ExperimentalSettings />}
        {activeTab === "developer" && <DeveloperSettings />}
        {activeTab === "about" && <AboutSection />}
      </div>
    </div>
  );
}
