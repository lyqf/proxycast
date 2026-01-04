/**
 * 应用主入口组件
 *
 * 管理页面路由和全局状态
 * 支持静态页面和动态插件页面路由
 * 包含启动画面和全局图标侧边栏
 *
 * _需求: 2.2, 3.2_
 */

import { useState, useEffect, useCallback } from "react";
import styled from "styled-components";
import { SplashScreen } from "./components/SplashScreen";
import { AppSidebar } from "./components/AppSidebar";
import { SettingsPage } from "./components/settings";
import { ApiServerPage } from "./components/api-server/ApiServerPage";
import { ProviderPoolPage } from "./components/provider-pool";
import { ToolsPage } from "./components/tools/ToolsPage";
import { AgentChatPage } from "./components/agent";
import { PluginUIRenderer } from "./components/plugins/PluginUIRenderer";
import { PluginsPage } from "./components/plugins/PluginsPage";
import { Toaster } from "./components/ui/sonner";
import { flowEventManager } from "./lib/flowEventManager";
import { OnboardingWizard, useOnboardingState } from "./components/onboarding";

/**
 * 页面类型定义
 *
 * 支持静态页面和动态插件页面
 * - 静态页面: 预定义的页面标识符
 * - 动态插件页面: `plugin:${string}` 格式，如 "plugin:machine-id-tool"
 *
 * _需求: 2.2, 3.2_
 */
type Page =
  | "provider-pool"
  | "api-server"
  | "agent"
  | "tools"
  | "plugins"
  | "settings"
  | `plugin:${string}`;

const AppContainer = styled.div`
  display: flex;
  height: 100vh;
  width: 100vw;
  background-color: hsl(var(--background));
  overflow: hidden;
`;

const MainContent = styled.main`
  flex: 1;
  overflow: auto;
  display: flex;
  flex-direction: column;
`;

const PageWrapper = styled.div`
  flex: 1;
  padding: 24px;
  overflow: auto;
`;

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [currentPage, setCurrentPage] = useState<Page>("agent");
  const { needsOnboarding, completeOnboarding } = useOnboardingState();

  // 在应用启动时初始化 Flow 事件订阅
  useEffect(() => {
    flowEventManager.subscribe();
  }, []);

  // 页面切换时重置滚动位置
  useEffect(() => {
    const mainElement = document.querySelector("main");
    if (mainElement) {
      mainElement.scrollTop = 0;
    }
  }, [currentPage]);

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);

  /**
   * 渲染当前页面
   *
   * 根据 currentPage 状态渲染对应的页面组件
   * - 静态页面: 直接渲染对应组件
   * - 动态插件页面: 使用 PluginUIRenderer 渲染
   *
   * _需求: 2.2, 3.2_
   */
  const renderPage = () => {
    // 检查是否为动态插件页面 (plugin:xxx 格式)
    if (currentPage.startsWith("plugin:")) {
      const pluginId = currentPage.slice(7); // 移除 "plugin:" 前缀
      return (
        <PageWrapper>
          <PluginUIRenderer pluginId={pluginId} onNavigate={setCurrentPage} />
        </PageWrapper>
      );
    }

    // 静态页面路由
    switch (currentPage) {
      case "provider-pool":
        return (
          <PageWrapper>
            <ProviderPoolPage />
          </PageWrapper>
        );
      case "api-server":
        return (
          <PageWrapper>
            <ApiServerPage />
          </PageWrapper>
        );
      case "agent":
        // Agent 页面有自己的布局，不需要 PageWrapper
        return (
          <AgentChatPage onNavigate={(page) => setCurrentPage(page as Page)} />
        );
      case "tools":
        return (
          <PageWrapper>
            <ToolsPage onNavigate={setCurrentPage} />
          </PageWrapper>
        );
      case "plugins":
        return (
          <PageWrapper>
            <PluginsPage />
          </PageWrapper>
        );
      case "settings":
        return (
          <PageWrapper>
            <SettingsPage />
          </PageWrapper>
        );
      default:
        return (
          <PageWrapper>
            <ApiServerPage />
          </PageWrapper>
        );
    }
  };

  // 引导完成回调
  const handleOnboardingComplete = useCallback(() => {
    completeOnboarding();
  }, [completeOnboarding]);

  // 1. 显示启动画面
  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  // 2. 检测中，显示空白
  if (needsOnboarding === null) {
    return null;
  }

  // 3. 需要引导时显示引导向导
  if (needsOnboarding) {
    return (
      <>
        <OnboardingWizard onComplete={handleOnboardingComplete} />
        <Toaster />
      </>
    );
  }

  // 4. 正常主界面
  return (
    <AppContainer>
      <AppSidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <MainContent>{renderPage()}</MainContent>
      <Toaster />
    </AppContainer>
  );
}

export default App;
