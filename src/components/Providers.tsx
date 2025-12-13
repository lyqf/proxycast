import { useState, useEffect } from "react";
import { Check, X, RefreshCw, FolderOpen, AlertCircle, CheckCircle2 } from "lucide-react";
import { 
  reloadCredentials, 
  refreshKiroToken, 
  getKiroCredentials,
  KiroCredentialStatus 
} from "@/hooks/useTauri";

interface Provider {
  id: string;
  name: string;
  enabled: boolean;
  status: "connected" | "disconnected" | "error" | "loading";
  description: string;
}

const defaultProviders: Provider[] = [
  {
    id: "kiro",
    name: "Kiro Claude",
    enabled: true,
    status: "disconnected",
    description: "通过 Kiro OAuth 访问 Claude Sonnet 4.5",
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    enabled: false,
    status: "disconnected",
    description: "通过 Gemini CLI OAuth 访问 Gemini 模型",
  },
  {
    id: "qwen",
    name: "Qwen Code",
    enabled: false,
    status: "disconnected",
    description: "通过 Qwen OAuth 访问通义千问",
  },
  {
    id: "openai",
    name: "OpenAI Custom",
    enabled: false,
    status: "disconnected",
    description: "自定义 OpenAI 兼容 API",
  },
  {
    id: "claude",
    name: "Claude Custom",
    enabled: false,
    status: "disconnected",
    description: "自定义 Claude API",
  },
];

export function Providers() {
  const [providers, setProviders] = useState<Provider[]>(defaultProviders);
  const [kiroStatus, setKiroStatus] = useState<KiroCredentialStatus | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadKiroStatus();
  }, []);

  const loadKiroStatus = async () => {
    try {
      const status = await getKiroCredentials();
      setKiroStatus(status);
      
      // 更新 Kiro provider 状态
      setProviders(prev => prev.map(p => {
        if (p.id === "kiro") {
          return {
            ...p,
            status: status.loaded ? "connected" : "disconnected"
          };
        }
        return p;
      }));
    } catch (e) {
      console.error("Failed to load Kiro status:", e);
    }
  };

  const handleLoadCredentials = async () => {
    setLoading("load");
    setMessage(null);
    try {
      await reloadCredentials();
      await loadKiroStatus();
      setMessage({ type: "success", text: "凭证加载成功！" });
    } catch (e: any) {
      setMessage({ type: "error", text: `加载失败: ${e.toString()}` });
    }
    setLoading(null);
  };

  const handleRefreshToken = async () => {
    setLoading("refresh");
    setMessage(null);
    try {
      await refreshKiroToken();
      await loadKiroStatus();
      setMessage({ type: "success", text: "Token 刷新成功！" });
    } catch (e: any) {
      setMessage({ type: "error", text: `刷新失败: ${e.toString()}` });
    }
    setLoading(null);
  };

  const toggleProvider = (id: string) => {
    setProviders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const getStatusColor = (status: Provider["status"]) => {
    switch (status) {
      case "connected":
        return "bg-green-500";
      case "error":
        return "bg-red-500";
      case "loading":
        return "bg-yellow-500 animate-pulse";
      default:
        return "bg-gray-400";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Provider 管理</h2>
        <p className="text-muted-foreground">配置和管理 AI 模型提供商</p>
      </div>

      {message && (
        <div className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
          message.type === "success" 
            ? "border-green-500 bg-green-50 text-green-700" 
            : "border-red-500 bg-red-50 text-red-700"
        }`}>
          {message.type === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {message.text}
        </div>
      )}

      {/* Kiro 凭证详情 */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 font-semibold">Kiro 凭证状态</h3>
        
        <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">凭证路径:</span>
            <code className="ml-2 rounded bg-muted px-2 py-0.5 text-xs">
              {kiroStatus?.creds_path || "~/.aws/sso/cache/kiro-auth-token.json"}
            </code>
          </div>
          <div>
            <span className="text-muted-foreground">区域:</span>
            <span className="ml-2">{kiroStatus?.region || "未设置"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Access Token:</span>
            <span className={`ml-2 ${kiroStatus?.has_access_token ? "text-green-600" : "text-red-500"}`}>
              {kiroStatus?.has_access_token ? "✓ 已加载" : "✗ 未加载"}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Refresh Token:</span>
            <span className={`ml-2 ${kiroStatus?.has_refresh_token ? "text-green-600" : "text-red-500"}`}>
              {kiroStatus?.has_refresh_token ? "✓ 已加载" : "✗ 未加载"}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">认证方式:</span>
            <span className="ml-2">{kiroStatus?.auth_method || "social"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">过期时间:</span>
            <span className="ml-2">{kiroStatus?.expires_at || "未知"}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleLoadCredentials}
            disabled={loading !== null}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <FolderOpen className="h-4 w-4" />
            {loading === "load" ? "加载中..." : "一键读取凭证"}
          </button>
          <button
            onClick={handleRefreshToken}
            disabled={loading !== null || !kiroStatus?.has_refresh_token}
            className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading === "refresh" ? "animate-spin" : ""}`} />
            {loading === "refresh" ? "刷新中..." : "刷新 Token"}
          </button>
        </div>
      </div>

      {/* Provider 列表 */}
      <div className="space-y-4">
        {providers.map((provider) => (
          <div
            key={provider.id}
            className="flex items-center justify-between rounded-lg border bg-card p-4"
          >
            <div className="flex items-center gap-4">
              <div
                className={`h-3 w-3 rounded-full ${getStatusColor(provider.status)}`}
              />
              <div>
                <h3 className="font-medium">{provider.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {provider.description}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {provider.id === "kiro" && (
                <button
                  onClick={handleRefreshToken}
                  disabled={loading !== null}
                  className="rounded p-2 hover:bg-muted"
                  title="刷新 Token"
                >
                  <RefreshCw className={`h-4 w-4 ${loading === "refresh" ? "animate-spin" : ""}`} />
                </button>
              )}
              <button
                onClick={() => toggleProvider(provider.id)}
                className={`rounded-full p-1 ${
                  provider.enabled
                    ? "bg-green-100 text-green-600"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {provider.enabled ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
