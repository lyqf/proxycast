/**
 * 绘画服务集成设置组件
 *
 * 参考成熟产品的图像能力实现
 * 功能包括：图像生成服务商选择、默认参数配置等
 */

import { useState, useEffect } from "react";
import {
  Image as ImageIcon,
  Palette,
  Settings2,
  Info,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getConfig, saveConfig, Config } from "@/hooks/useTauri";

type ImageService = "dall_e" | "midjourney" | "stable_diffusion" | "flux";

interface ImageGenConfig {
  /** 默认图像生成服务 */
  default_service?: ImageService;
  /** 默认图像数量 */
  default_count?: number;
  /** 默认图像尺寸 */
  default_size?:
    | "256x256"
    | "512x512"
    | "1024x1024"
    | "1792x1024"
    | "1024x1792";
  /** 默认图像质量 */
  default_quality?: "standard" | "hd";
  /** 默认图像风格 */
  default_style?: "vivid" | "natural";
  /** 启用图像增强 */
  enable_enhancement?: boolean;
  /** 自动下载生成的图像 */
  auto_download?: boolean;
}

const DEFAULT_IMAGE_GEN_CONFIG: ImageGenConfig = {
  default_service: "dall_e",
  default_count: 1,
  default_size: "1024x1024",
  default_quality: "standard",
  default_style: "vivid",
  enable_enhancement: false,
  auto_download: false,
};

const IMAGE_SERVICES = [
  {
    value: "dall_e" as ImageService,
    label: "DALL·E",
    desc: "OpenAI 的图像生成模型",
  },
  {
    value: "midjourney" as ImageService,
    label: "Midjourney",
    desc: "高质量艺术图像生成",
  },
  {
    value: "stable_diffusion" as ImageService,
    label: "Stable Diffusion",
    desc: "开源图像生成模型",
  },
  { value: "flux" as ImageService, label: "Flux", desc: "新一代图像生成模型" },
];

const IMAGE_SIZES = [
  { value: "256x256", label: "256×256", desc: "小尺寸" },
  { value: "512x512", label: "512×512", desc: "中等尺寸" },
  { value: "1024x1024", label: "1024×1024", desc: "标准尺寸" },
  { value: "1792x1024", label: "1792×1024", desc: "横向宽屏" },
  { value: "1024x1792", label: "1024×1792", desc: "纵向竖屏" },
];

const IMAGE_QUALITIES = [
  { value: "standard", label: "标准", desc: "标准质量，生成速度快" },
  { value: "hd", label: "高清", desc: "高清质量，细节更丰富" },
];

const IMAGE_STYLES = [
  { value: "vivid", label: "生动", desc: "更鲜艳、更富有表现力" },
  { value: "natural", label: "自然", desc: "更自然、更真实" },
];

export function ImageGenSettings() {
  const [config, setConfig] = useState<Config | null>(null);
  const [imageConfig, setImageConfig] = useState<ImageGenConfig>(
    DEFAULT_IMAGE_GEN_CONFIG,
  );
  const [loading, setLoading] = useState(true);
  const [_saving, setSaving] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // 加载配置
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const c = await getConfig();
      setConfig(c);
      setImageConfig(c.image_gen || DEFAULT_IMAGE_GEN_CONFIG);
    } catch (e) {
      console.error("加载绘画服务配置失败:", e);
    } finally {
      setLoading(false);
    }
  };

  // 保存配置
  const saveImageConfig = async (key: keyof ImageGenConfig, value: any) => {
    if (!config) return;
    setSaving((prev) => ({ ...prev, [key]: true }));

    try {
      const newConfig = {
        ...imageConfig,
        [key]: value,
      };
      const updatedFullConfig = {
        ...config,
        image_gen: newConfig,
      };
      await saveConfig(updatedFullConfig);
      setConfig(updatedFullConfig);
      setImageConfig(newConfig);

      showMessage("success", "设置已保存");
    } catch (e) {
      console.error("保存绘画服务配置失败:", e);
      showMessage("error", "保存失败");
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }));
    }
  };

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {/* 服务商选择 */}
      <div className="rounded-lg border p-3">
        <div className="flex items-center gap-2 mb-3">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <div>
            <h3 className="text-sm font-medium">默认图像生成服务</h3>
            <p className="text-xs text-muted-foreground">
              选择默认使用的图像生成服务商
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {IMAGE_SERVICES.map((service) => (
            <button
              key={service.value}
              onClick={() => saveImageConfig("default_service", service.value)}
              className={cn(
                "px-3 py-2 rounded-lg text-sm font-medium transition-colors border text-left",
                imageConfig.default_service === service.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted",
              )}
            >
              <div className="font-medium">{service.label}</div>
              <div className="text-xs opacity-80">{service.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 默认图像数量 */}
      <div className="rounded-lg border p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
            <div>
              <h3 className="text-sm font-medium">默认图像数量</h3>
              <p className="text-xs text-muted-foreground">
                每次生成的图像数量
              </p>
            </div>
          </div>
          <span className="text-sm font-medium text-primary">
            {imageConfig.default_count || 1}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((count) => (
            <button
              key={count}
              onClick={() => saveImageConfig("default_count", count)}
              className={cn(
                "px-3 py-2 rounded-lg text-sm font-medium transition-colors border",
                imageConfig.default_count === count
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted",
              )}
            >
              {count}
            </button>
          ))}
        </div>
      </div>

      {/* 默认图像尺寸 */}
      <div className="rounded-lg border p-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-medium">默认图像尺寸</h3>
            <p className="text-xs text-muted-foreground">
              选择生成图像的默认尺寸
            </p>
          </div>
          <span className="text-sm font-medium text-primary">
            {imageConfig.default_size || "1024x1024"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {IMAGE_SIZES.map((size) => (
            <button
              key={size.value}
              onClick={() => saveImageConfig("default_size", size.value)}
              className={cn(
                "px-3 py-2 rounded-lg text-sm transition-colors border text-left",
                imageConfig.default_size === size.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted",
              )}
            >
              <div className="font-medium">{size.label}</div>
              <div className="text-xs opacity-80">{size.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 图像质量 */}
      <div className="rounded-lg border p-3">
        <div className="flex items-center gap-2 mb-3">
          <Palette className="h-4 w-4 text-muted-foreground" />
          <div>
            <h3 className="text-sm font-medium">图像质量</h3>
            <p className="text-xs text-muted-foreground">
              选择生成图像的质量级别
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {IMAGE_QUALITIES.map((quality) => (
            <button
              key={quality.value}
              onClick={() => saveImageConfig("default_quality", quality.value)}
              className={cn(
                "px-3 py-2 rounded-lg text-sm transition-colors border text-left",
                imageConfig.default_quality === quality.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted",
              )}
            >
              <div className="font-medium">{quality.label}</div>
              <div className="text-xs opacity-80">{quality.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 图像风格 */}
      <div className="rounded-lg border p-3">
        <div className="flex items-center gap-2 mb-3">
          <Palette className="h-4 w-4 text-muted-foreground" />
          <div>
            <h3 className="text-sm font-medium">图像风格</h3>
            <p className="text-xs text-muted-foreground">
              选择生成图像的默认风格
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {IMAGE_STYLES.map((style) => (
            <button
              key={style.value}
              onClick={() => saveImageConfig("default_style", style.value)}
              className={cn(
                "px-3 py-2 rounded-lg text-sm transition-colors border text-left",
                imageConfig.default_style === style.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted",
              )}
            >
              <div className="font-medium">{style.label}</div>
              <div className="text-xs opacity-80">{style.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 其他选项 */}
      <div className="rounded-lg border p-3">
        <div className="flex items-center gap-2 mb-3">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <div>
            <h3 className="text-sm font-medium">其他选项</h3>
            <p className="text-xs text-muted-foreground">
              配置图像生成的其他行为
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center justify-between py-1.5 cursor-pointer">
            <div>
              <span className="text-sm">启用图像增强</span>
              <p className="text-xs text-muted-foreground">
                自动对生成的图像进行增强处理
              </p>
            </div>
            <input
              type="checkbox"
              checked={imageConfig.enable_enhancement ?? false}
              onChange={(e) =>
                saveImageConfig("enable_enhancement", e.target.checked)
              }
              disabled={loading}
              className="w-4 h-4 rounded border-gray-300"
            />
          </label>

          <label className="flex items-center justify-between py-1.5 cursor-pointer border-t">
            <div>
              <span className="text-sm">自动下载图像</span>
              <p className="text-xs text-muted-foreground">
                生成完成后自动下载到本地
              </p>
            </div>
            <input
              type="checkbox"
              checked={imageConfig.auto_download ?? false}
              onChange={(e) =>
                saveImageConfig("auto_download", e.target.checked)
              }
              disabled={loading}
              className="w-4 h-4 rounded border-gray-300"
            />
          </label>
        </div>
      </div>

      {/* 提示信息 */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg">
        <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <p>
          不同的图像生成服务商支持的功能和参数可能不同。某些服务商可能不支持特定的尺寸或质量选项。
          实际生成的效果取决于所选服务商的能力。
        </p>
      </div>

      {/* 消息提示 */}
      {message && (
        <div
          className={cn(
            "flex items-center gap-2 p-3 rounded-lg",
            message.type === "success"
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
          )}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <span className="text-sm">{message.text}</span>
        </div>
      )}
    </div>
  );
}

export default ImageGenSettings;
