/**
 * @file GeneralSettings.tsx
 * @description 通用设置页面 - 主题、代理、启动行为配置
 */
import { useState, useEffect, useCallback } from "react";
import {
  Moon,
  Sun,
  Monitor,
  RefreshCw,
  Info,
  RotateCcw,
  Volume2,
} from "lucide-react";
import { cn, validateProxyUrl } from "@/lib/utils";
import { getConfig, saveConfig, Config } from "@/hooks/useTauri";
import { useOnboardingState } from "@/components/onboarding";
import { LanguageSelector, Language } from "./LanguageSelector";
import { useI18nPatch } from "@/i18n/I18nPatchProvider";
import { useSoundContext } from "@/contexts/useSoundContext";

type Theme = "light" | "dark" | "system";

export function GeneralSettings() {
  const [theme, setTheme] = useState<Theme>("system");
  const [launchOnStartup, setLaunchOnStartup] = useState(false);
  const [minimizeToTray, setMinimizeToTray] = useState(true);
  const [language, setLanguageState] = useState<Language>("zh");
  const { resetOnboarding } = useOnboardingState();
  const { setLanguage: setI18nLanguage } = useI18nPatch();
  const { soundEnabled, setSoundEnabled, playToolcallSound } =
    useSoundContext();

  // 重新运行引导
  const handleResetOnboarding = useCallback(() => {
    resetOnboarding();
    window.location.reload();
  }, [resetOnboarding]);

  // 网络代理状态
  const [config, setConfig] = useState<Config | null>(null);
  const [proxyUrl, setProxyUrl] = useState<string>("");
  const [proxyError, setProxyError] = useState<string | null>(null);
  const [proxySaving, setProxySaving] = useState(false);
  const [proxyMessage, setProxyMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as Theme | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setConfigLoading(true);
    try {
      const c = await getConfig();
      setConfig(c);
      setProxyUrl(c.proxy_url || "");
      setMinimizeToTray(c.minimize_to_tray ?? true);
      setLanguageState((c.language || "zh") as Language);
    } catch (e) {
      console.error("加载配置失败:", e);
    } finally {
      setConfigLoading(false);
    }
  };

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    const root = document.documentElement;
    if (newTheme === "system") {
      const systemDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      root.classList.toggle("dark", systemDark);
    } else {
      root.classList.toggle("dark", newTheme === "dark");
    }
  };

  const handleProxyUrlChange = (value: string) => {
    setProxyUrl(value);
    if (value && !validateProxyUrl(value)) {
      setProxyError("格式无效，请使用 http://、https:// 或 socks5:// 开头");
    } else {
      setProxyError(null);
    }
  };

  const handleSaveProxy = async () => {
    if (!config) return;
    if (proxyUrl && !validateProxyUrl(proxyUrl)) {
      setProxyError("格式无效，请使用 http://、https:// 或 socks5:// 开头");
      return;
    }
    setProxySaving(true);
    setProxyMessage(null);
    try {
      const newConfig = { ...config, proxy_url: proxyUrl.trim() || null };
      await saveConfig(newConfig);
      setConfig(newConfig);
      setProxyMessage({ type: "success", text: "已保存" });
      setTimeout(() => setProxyMessage(null), 2000);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setProxyMessage({ type: "error", text: `保存失败: ${errorMessage}` });
    } finally {
      setProxySaving(false);
    }
  };

  const handleLanguageChange = async (newLanguage: Language) => {
    if (!config) return;
    try {
      const newConfig = { ...config, language: newLanguage };
      await saveConfig(newConfig);
      setConfig(newConfig);
      setLanguageState(newLanguage);
      // Update i18n context to trigger DOM replacement
      setI18nLanguage(newLanguage);
    } catch (err) {
      console.error("保存语言设置失败:", err);
    }
  };

  const themeOptions = [
    { id: "light" as Theme, label: "浅色", icon: Sun },
    { id: "dark" as Theme, label: "深色", icon: Moon },
    { id: "system" as Theme, label: "系统", icon: Monitor },
  ];

  return (
    <div className="space-y-4 max-w-2xl">
      {/* 网络代理 */}
      <div className="rounded-lg border p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">全局代理</h3>
          {proxyMessage && (
            <span
              className={cn(
                "text-xs px-2 py-0.5 rounded",
                proxyMessage.type === "error"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
              )}
            >
              {proxyMessage.text}
            </span>
          )}
        </div>

        {configLoading ? (
          <div className="flex items-center justify-center py-2">
            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={proxyUrl}
                onChange={(e) => handleProxyUrlChange(e.target.value)}
                placeholder="http://127.0.0.1:7890 或 socks5://127.0.0.1:1080"
                className={cn(
                  "flex-1 px-3 py-1.5 rounded border bg-background text-sm focus:ring-1 focus:ring-primary/20 focus:border-primary outline-none",
                  proxyError && "border-destructive",
                )}
              />
              <button
                onClick={handleSaveProxy}
                disabled={proxySaving || !!proxyError}
                className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
              >
                {proxySaving ? "..." : "保存"}
              </button>
            </div>
            {proxyError ? (
              <p className="text-xs text-destructive">{proxyError}</p>
            ) : (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />
                凭证级代理优先于全局代理，留空表示直连
              </p>
            )}
          </div>
        )}
      </div>

      {/* 主题 */}
      <div className="rounded-lg border p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">主题</h3>
          <div className="flex gap-1">
            {themeOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => handleThemeChange(option.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded text-sm transition-colors",
                  theme === option.id
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted",
                )}
              >
                <option.icon className="h-3.5 w-3.5" />
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 语言 */}
      <div className="rounded-lg border p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">语言</h3>
          <LanguageSelector
            currentLanguage={language}
            onLanguageChange={handleLanguageChange}
          />
        </div>
      </div>

      {/* 音效 */}
      <div className="rounded-lg border p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <div>
              <h3 className="text-sm font-medium">音效</h3>
              <p className="text-xs text-muted-foreground">
                工具调用和打字时播放提示音
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={soundEnabled}
            onChange={(e) => {
              setSoundEnabled(e.target.checked);
              if (e.target.checked) {
                playToolcallSound();
              }
            }}
            className="w-4 h-4 rounded border-gray-300"
          />
        </div>
      </div>

      {/* 启动行为 */}
      <div className="rounded-lg border p-3 space-y-2">
        <h3 className="text-sm font-medium">启动行为</h3>

        <label className="flex items-center justify-between py-1.5 cursor-pointer">
          <span className="text-sm">开机自启动</span>
          <input
            type="checkbox"
            checked={launchOnStartup}
            onChange={(e) => setLaunchOnStartup(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300"
          />
        </label>

        <label className="flex items-center justify-between py-1.5 cursor-pointer border-t pt-2">
          <span className="text-sm">关闭时最小化到托盘</span>
          <input
            type="checkbox"
            checked={minimizeToTray}
            onChange={async (e) => {
              const newValue = e.target.checked;
              setMinimizeToTray(newValue);
              if (config) {
                try {
                  await saveConfig({ ...config, minimize_to_tray: newValue });
                  setConfig({ ...config, minimize_to_tray: newValue });
                } catch (err) {
                  console.error("保存最小化到托盘设置失败:", err);
                  setMinimizeToTray(!newValue);
                }
              }
            }}
            className="w-4 h-4 rounded border-gray-300"
          />
        </label>
      </div>

      {/* 重新运行引导 */}
      <div className="rounded-lg border p-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">初次设置向导</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              重新运行初次安装向导，重新选择用户群体和安装插件
            </p>
          </div>
          <button
            onClick={handleResetOnboarding}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-sm hover:bg-muted transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            重新引导
          </button>
        </div>
      </div>
    </div>
  );
}
