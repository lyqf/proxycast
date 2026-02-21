import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getRateLimitConfig,
  updateRateLimitConfig,
  getConversationConfig,
  updateConversationConfig,
  getHintRoutes,
  updateHintRoutes,
  getPairingConfig,
  updatePairingConfig,
  RateLimitConfig,
  ConversationConfig,
  HintRouteEntry,
  PairingConfig,
} from "@/lib/api/securityPerformance";

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  enabled: false,
  requests_per_minute: 60,
  window_secs: 60,
};

const DEFAULT_CONVERSATION: ConversationConfig = {
  trim_enabled: false,
  max_messages: 50,
  summary_enabled: false,
};

const DEFAULT_PAIRING: PairingConfig = { enabled: false };

export function SecurityPerformanceSettings() {
  const [rateLimit, setRateLimit] = useState<RateLimitConfig>(DEFAULT_RATE_LIMIT);
  const [conversation, setConversation] = useState<ConversationConfig>(DEFAULT_CONVERSATION);
  const [hintRoutes, setHintRoutes] = useState<HintRouteEntry[]>([]);
  const [pairing, setPairing] = useState<PairingConfig>(DEFAULT_PAIRING);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rl, conv, routes, pair] = await Promise.all([
        getRateLimitConfig().catch(() => DEFAULT_RATE_LIMIT),
        getConversationConfig().catch(() => DEFAULT_CONVERSATION),
        getHintRoutes().catch(() => []),
        getPairingConfig().catch(() => DEFAULT_PAIRING),
      ]);
      setRateLimit(rl);
      setConversation(conv);
      setHintRoutes(routes);
      setPairing(pair);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const saveRateLimit = async (config: RateLimitConfig) => {
    setRateLimit(config);
    try {
      await updateRateLimitConfig(config);
      toast.success("速率限制已更新");
    } catch (e) {
      toast.error(`保存失败: ${e instanceof Error ? e.message : e}`);
    }
  };

  const saveConversation = async (config: ConversationConfig) => {
    setConversation(config);
    try {
      await updateConversationConfig(config);
      toast.success("对话管理已更新");
    } catch (e) {
      toast.error(`保存失败: ${e instanceof Error ? e.message : e}`);
    }
  };

  const saveHintRoutes = async (routes: HintRouteEntry[]) => {
    setHintRoutes(routes);
    try {
      await updateHintRoutes(routes);
      toast.success("提示路由已更新");
    } catch (e) {
      toast.error(`保存失败: ${e instanceof Error ? e.message : e}`);
    }
  };

  const savePairing = async (config: PairingConfig) => {
    setPairing(config);
    try {
      await updatePairingConfig(config);
      toast.success("配对认证已更新");
    } catch (e) {
      toast.error(`保存失败: ${e instanceof Error ? e.message : e}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <div>
          <h3 className="text-sm font-medium">安全与性能配置</h3>
          <p className="text-xs text-muted-foreground">管理速率限制、对话管理、提示路由和配对认证</p>
        </div>
      </div>

      {/* 速率限制 */}
      <div className="rounded-lg border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium">速率限制</h4>
            <p className="text-xs text-muted-foreground">限制 API 请求频率，防止滥用</p>
          </div>
          <Switch
            checked={rateLimit.enabled}
            onCheckedChange={(checked) => saveRateLimit({ ...rateLimit, enabled: checked })}
          />
        </div>
        {rateLimit.enabled && (
          <div className="space-y-4 pt-2 border-t">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">每分钟请求数</span>
                <span className="text-sm text-muted-foreground">{rateLimit.requests_per_minute}</span>
              </div>
              <Slider
                value={[rateLimit.requests_per_minute]}
                min={10}
                max={200}
                step={10}
                onValueChange={([v]) => setRateLimit({ ...rateLimit, requests_per_minute: v })}
                onValueCommit={([v]) => saveRateLimit({ ...rateLimit, requests_per_minute: v })}
              />
            </div>
            <div>
              <span className="text-sm mb-2 block">窗口大小</span>
              <Select
                value={String(rateLimit.window_secs)}
                onValueChange={(v) => saveRateLimit({ ...rateLimit, window_secs: Number(v) })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 秒</SelectItem>
                  <SelectItem value="60">60 秒</SelectItem>
                  <SelectItem value="120">120 秒</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* 对话管理 */}
      <div className="rounded-lg border p-4 space-y-4">
        <h4 className="text-sm font-medium">对话管理</h4>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm">消息修剪</span>
            <p className="text-xs text-muted-foreground">自动修剪超出限制的历史消息</p>
          </div>
          <Switch
            checked={conversation.trim_enabled}
            onCheckedChange={(checked) => saveConversation({ ...conversation, trim_enabled: checked })}
          />
        </div>
        {conversation.trim_enabled && (
          <div className="flex items-center gap-2 pl-1">
            <span className="text-sm whitespace-nowrap">最大消息数</span>
            <Input
              type="number"
              className="w-24 h-8"
              value={conversation.max_messages}
              min={10}
              max={500}
              onChange={(e) => setConversation({ ...conversation, max_messages: Number(e.target.value) || 50 })}
              onBlur={() => saveConversation(conversation)}
            />
          </div>
        )}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm">摘要生成</span>
            <p className="text-xs text-muted-foreground">修剪时自动生成对话摘要</p>
          </div>
          <Switch
            checked={conversation.summary_enabled}
            onCheckedChange={(checked) => saveConversation({ ...conversation, summary_enabled: checked })}
          />
        </div>
      </div>

      {/* 提示路由 */}
      <div className="rounded-lg border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium">提示路由</h4>
            <p className="text-xs text-muted-foreground">根据提示关键词自动路由到指定模型</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setHintRoutes([...hintRoutes, { hint: "", provider: "", model: "" }]);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            添加
          </Button>
        </div>
        {hintRoutes.length > 0 && (
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_1fr_1fr_32px] gap-2 text-xs text-muted-foreground px-1">
              <span>关键词</span>
              <span>Provider</span>
              <span>模型</span>
              <span />
            </div>
            {hintRoutes.map((route, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_32px] gap-2">
                <Input
                  className="h-8 text-sm"
                  placeholder="hint"
                  value={route.hint}
                  onChange={(e) => {
                    const next = [...hintRoutes];
                    next[i] = { ...route, hint: e.target.value };
                    setHintRoutes(next);
                  }}
                  onBlur={() => saveHintRoutes(hintRoutes)}
                />
                <Input
                  className="h-8 text-sm"
                  placeholder="provider"
                  value={route.provider}
                  onChange={(e) => {
                    const next = [...hintRoutes];
                    next[i] = { ...route, provider: e.target.value };
                    setHintRoutes(next);
                  }}
                  onBlur={() => saveHintRoutes(hintRoutes)}
                />
                <Input
                  className="h-8 text-sm"
                  placeholder="model"
                  value={route.model}
                  onChange={(e) => {
                    const next = [...hintRoutes];
                    next[i] = { ...route, model: e.target.value };
                    setHintRoutes(next);
                  }}
                  onBlur={() => saveHintRoutes(hintRoutes)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    const next = hintRoutes.filter((_, idx) => idx !== i);
                    saveHintRoutes(next);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}
        {hintRoutes.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">暂无路由规则，点击添加按钮创建</p>
        )}
      </div>

      {/* 配对认证 */}
      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium">配对认证</h4>
            <p className="text-xs text-muted-foreground">启用客户端配对认证，增强安全性</p>
          </div>
          <Switch
            checked={pairing.enabled}
            onCheckedChange={(checked) => savePairing({ enabled: checked })}
          />
        </div>
      </div>
    </div>
  );
}
