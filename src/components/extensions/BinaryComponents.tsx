/**
 * 二进制组件管理 UI
 *
 * 显示和管理 aster-server 等二进制组件
 */

import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  Download,
  Trash2,
  RefreshCw,
  CheckCircle,
  Loader2,
  Bot,
  HardDrive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  BinaryComponentStatus,
  DownloadProgress,
  getAsterStatus,
  installAster,
  uninstallAster,
  updateAster,
} from "@/lib/api/binary";

export function BinaryComponents() {
  const [asterStatus, setAsterStatus] = useState<BinaryComponentStatus | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [uninstalling, setUninstalling] = useState(false);
  const [downloadProgress, setDownloadProgress] =
    useState<DownloadProgress | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const status = await getAsterStatus();
      setAsterStatus(status);
    } catch (error) {
      console.error("获取状态失败:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // 监听下载进度事件
    const unlisten = listen<DownloadProgress>(
      "binary-download-progress",
      (event) => {
        setDownloadProgress(event.payload);
      },
    );

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleInstall = async () => {
    setInstalling(true);
    setDownloadProgress(null);
    try {
      const result = await installAster();
      toast.success(result);
      await fetchStatus();
    } catch (error) {
      toast.error(`安装失败: ${error}`);
    } finally {
      setInstalling(false);
      setDownloadProgress(null);
    }
  };

  const handleUninstall = async () => {
    if (!confirm("确定要卸载 aster-server 吗？这将停止所有 Agent 功能。")) {
      return;
    }
    setUninstalling(true);
    try {
      const result = await uninstallAster();
      toast.success(result);
      await fetchStatus();
    } catch (error) {
      toast.error(`卸载失败: ${error}`);
    } finally {
      setUninstalling(false);
    }
  };

  const handleUpdate = async () => {
    setInstalling(true);
    setDownloadProgress(null);
    try {
      const result = await updateAster();
      toast.success(result);
      await fetchStatus();
    } catch (error) {
      toast.error(`更新失败: ${error}`);
    } finally {
      setInstalling(false);
      setDownloadProgress(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          二进制组件
        </h3>
        <Button variant="ghost" size="sm" onClick={fetchStatus}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bot className="h-8 w-8 text-primary" />
              <div>
                <CardTitle className="text-base">aster-server</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {asterStatus?.description ||
                    "AI Agent 框架 - 提供 Agent 对话能力"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {asterStatus?.installed ? (
                <Badge variant="default" className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  已安装
                </Badge>
              ) : (
                <Badge variant="secondary">未安装</Badge>
              )}
              {asterStatus?.has_update && (
                <Badge variant="destructive">有更新</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 版本信息 */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">已安装版本：</span>
              <span className="ml-2 font-mono">
                {asterStatus?.installed_version || "-"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">最新版本：</span>
              <span className="ml-2 font-mono">
                {asterStatus?.latest_version || "-"}
              </span>
            </div>
          </div>

          {/* 下载进度 */}
          {downloadProgress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>下载中...</span>
                <span>{downloadProgress.percentage.toFixed(1)}%</span>
              </div>
              <Progress value={downloadProgress.percentage} />
              <p className="text-xs text-muted-foreground">
                {(downloadProgress.downloaded / 1024 / 1024).toFixed(1)} MB /{" "}
                {(downloadProgress.total / 1024 / 1024).toFixed(1)} MB
              </p>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-2">
            {!asterStatus?.installed ? (
              <Button onClick={handleInstall} disabled={installing}>
                {installing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                安装
              </Button>
            ) : (
              <>
                {asterStatus?.has_update && (
                  <Button onClick={handleUpdate} disabled={installing}>
                    {installing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    更新
                  </Button>
                )}
                <Button
                  variant="destructive"
                  onClick={handleUninstall}
                  disabled={uninstalling}
                >
                  {uninstalling ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  卸载
                </Button>
              </>
            )}
          </div>

          {/* 安装时间 */}
          {asterStatus?.installed_at && (
            <p className="text-xs text-muted-foreground">
              安装时间：{new Date(asterStatus.installed_at).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
