# ProxyCast Connect - 中转商生态合作方案

> 版本: 1.0.0
> 日期: 2026-01-05
> 状态: Draft

---

## 一、背景与目标

### 1.1 背景

AI API 中转市场蓬勃发展，涌现出大量中转服务商：
- 基于 new-api、one-api 搭建的中转站
- ccr、claude-relay-service 等专用中转
- 各类 Token 分销平台

这些中转商面临的痛点：
1. **用户配置复杂** - 用户需要手动配置 base_url、协议等
2. **接入门槛高** - 不同客户端（Cursor、Claude Code）配置方式不同
3. **缺乏差异化** - 各家中转体验雷同

### 1.2 目标

**ProxyCast Connect** 是一套中转商生态合作方案：

1. **一键配置** - 用户点击链接即可完成 ProxyCast + Key 配置
2. **品牌展示** - 中转商在 ProxyCast 内有专属展示位
3. **双向引流** - 中转商推广 ProxyCast，ProxyCast 为中转商导流
4. **生态共赢** - 降低用户门槛，提升转化率

### 1.3 核心价值

| 角色 | 价值 |
|------|------|
| **中转商** | 用户转化率提升、品牌曝光、差异化竞争 |
| **用户** | 一键配置、开箱即用、统一管理多个中转 |
| **ProxyCast** | 用户增长、生态繁荣、市场占有率 |

---

## 二、产品方案

### 2.1 一键配置流程

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     ProxyCast Connect 流程                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    中转商用户后台                                 │    │
│  │                                                                   │    │
│  │  我的 API Key: sk-xxxxxxxxxxxxxxxx              [复制]           │    │
│  │                                                                   │    │
│  │  ┌─────────────────────────────────────────────────────────┐     │    │
│  │  │  🚀 快速接入                                             │     │    │
│  │  │                                                          │     │    │
│  │  │  ┌────────────┐ ┌────────────┐ ┌────────────┐           │     │    │
│  │  │  │ ProxyCast  │ │  Cursor    │ │Claude Code │           │     │    │
│  │  │  │ [一键配置] │ │ [查看教程] │ │ [查看教程] │           │     │    │
│  │  │  └────────────┘ └────────────┘ └────────────┘           │     │    │
│  │  └─────────────────────────────────────────────────────────┘     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│       │                                                                  │
│       │ 用户点击 [一键配置]                                              │
│       ▼                                                                  │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  浏览器打开 proxycast:// 协议                                    │    │
│  │                                                                   │    │
│  │  proxycast://connect?                                            │    │
│  │    relay=xxx-relay&                                              │    │
│  │    key=sk-xxxxxxxx&                                              │    │
│  │    name=我的Key                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│       │                                                                  │
│       ├─── 已安装 ProxyCast ───────────────────────────────────────┐    │
│       │                                                             │    │
│       │    ProxyCast 打开，显示确认弹窗                             │    │
│       │    ┌─────────────────────────────────────────────────┐     │    │
│       │    │                                                  │     │    │
│       │    │  🔗 添加 API Key                                 │     │    │
│       │    │                                                  │     │    │
│       │    │  来源: XXX中转站                                 │     │    │
│       │    │  Key:  sk-xxxx...xxxx                           │     │    │
│       │    │  名称: 我的Key                                   │     │    │
│       │    │                                                  │     │    │
│       │    │  [取消]                    [确认添加]            │     │    │
│       │    │                                                  │     │    │
│       │    └─────────────────────────────────────────────────┘     │    │
│       │         │                                                   │    │
│       │         ▼                                                   │    │
│       │    配置完成，可以使用 ✓                                     │    │
│       │                                                             │    │
│       └─── 未安装 ProxyCast ───────────────────────────────────────┐    │
│                                                                     │    │
│            跳转 proxycast.dev/download?connect=...                  │    │
│                 │                                                   │    │
│                 ▼                                                   │    │
│            下载并安装 ProxyCast                                     │    │
│                 │                                                   │    │
│                 ▼                                                   │    │
│            首次启动，自动读取参数并配置                              │    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Deep Link 协议设计

#### 2.2.1 协议格式

```
proxycast://connect?relay={relay_id}&key={api_key}&name={key_name}
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `relay` | ✅ | 中转商 ID（需在 ProxyCast 注册） |
| `key` | ✅ | API Key |
| `name` | ❌ | Key 名称（默认使用中转商名称） |
| `ref` | ❌ | 推广码（用于统计） |

#### 2.2.2 示例

```
# 基础用法
proxycast://connect?relay=openrouter&key=sk-or-v1-xxxx

# 带名称
proxycast://connect?relay=siliconflow&key=sk-xxxx&name=硅基流动-主账号

# 带推广码
proxycast://connect?relay=myrelay&key=sk-xxxx&ref=promo2024
```

#### 2.2.3 Web 中转页面

对于不支持自定义协议的场景，提供 Web 中转：

```
https://proxycast.dev/connect?relay=xxx&key=sk-xxxx
```

页面逻辑：
1. 尝试唤起 `proxycast://` 协议
2. 如果 3 秒内未成功，显示下载引导
3. 下载链接带上 connect 参数，安装后首次启动自动配置

### 2.3 中转商注册（开源方式）

ProxyCast 是开源软件，中转商通过 **GitHub PR** 方式注册，无需网站注册。

#### 2.3.1 注册仓库

中转商注册信息统一管理在独立仓库：

```
https://github.com/AiClientProxy/transit-service-provider
```

#### 2.3.2 注册流程

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     中转商注册流程（GitHub PR）                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Step 1: Fork 仓库                                                       │
│  ─────────────────                                                       │
│  Fork https://github.com/AiClientProxy/transit-service-provider         │
│       │                                                                  │
│       ▼                                                                  │
│  Step 2: 创建配置文件                                                    │
│  ─────────────────                                                       │
│  在 providers/ 目录下创建 {your-id}.json                                │
│  参考 providers/_example.json 模板                                       │
│       │                                                                  │
│       ▼                                                                  │
│  Step 3: 提交 PR                                                         │
│  ─────────────────                                                       │
│  提交 Pull Request 到主仓库                                              │
│       │                                                                  │
│       ▼                                                                  │
│  Step 4: 自动化检查                                                      │
│  ─────────────────                                                       │
│  GitHub Actions 自动验证：                                               │
│  ├── JSON Schema 验证                                                   │
│  ├── Logo 图片可访问性                                                  │
│  └── API 地址可访问性                                                   │
│       │                                                                  │
│       ▼                                                                  │
│  Step 5: 社区审核                                                        │
│  ─────────────────                                                       │
│  维护者审核并合并 PR                                                     │
│       │                                                                  │
│       ▼                                                                  │
│  Step 6: 自动发布                                                        │
│  ─────────────────                                                       │
│  合并后自动构建 registry.json                                            │
│  ProxyCast 客户端定期同步更新                                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 2.3.3 配置文件格式

在 `providers/` 目录下创建 `{your-id}.json`：

```json
{
  "id": "myrelay",
  "name": "我的中转站",
  "description": "稳定、便宜、快速的 AI API 中转服务",
  
  "branding": {
    "logo": "https://myrelay.com/logo.png",
    "color": "#6366f1"
  },
  
  "links": {
    "homepage": "https://myrelay.com",
    "register": "https://myrelay.com/register",
    "recharge": "https://myrelay.com/recharge",
    "docs": "https://docs.myrelay.com",
    "status": "https://status.myrelay.com"
  },
  
  "api": {
    "base_url": "https://api.myrelay.com/v1",
    "protocol": "openai",
    "auth_header": "Authorization",
    "auth_prefix": "Bearer "
  },
  
  "contact": {
    "email": "support@myrelay.com",
    "telegram": "@myrelay"
  },
  
  "features": {
    "streaming": true,
    "models_endpoint": true
  }
}
```

#### 2.3.4 字段说明

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | ✅ | 唯一标识，小写字母、数字、连字符 |
| `name` | ✅ | 显示名称 |
| `description` | ✅ | 简短描述，≤100 字 |
| `branding.logo` | ✅ | Logo URL，256x256 PNG |
| `branding.color` | ❌ | 主题色，默认 `#6366f1` |
| `links.homepage` | ✅ | 官网地址 |
| `links.register` | ❌ | 注册页面 |
| `links.recharge` | ❌ | 充值页面 |
| `links.docs` | ❌ | 文档地址 |
| `links.status` | ❌ | 状态页面 |
| `api.base_url` | ✅ | API 地址（必须 HTTPS） |
| `api.protocol` | ✅ | 协议：`openai` 或 `anthropic` |
| `contact.email` | ✅ | 联系邮箱 |

#### 2.3.5 审核标准

PR 合并前需满足：

- [ ] JSON Schema 验证通过
- [ ] 文件名与 `id` 字段一致
- [ ] Logo 图片可访问（256x256 PNG）
- [ ] API 地址使用 HTTPS
- [ ] 官网可访问
- [ ] 联系方式有效

#### 2.3.6 仓库结构

```
transit-service-provider/
├── README.md                    # 注册指南
├── providers/                   # 中转商配置目录
│   ├── _example.json           # 示例配置（不会被加载）
│   ├── openrouter.json         # OpenRouter
│   ├── siliconflow.json        # 硅基流动
│   └── ...                     # 其他中转商
├── schema/
│   └── provider.schema.json    # JSON Schema
├── scripts/
│   ├── validate.js             # 验证脚本
│   ├── check-api.js            # API 检查脚本
│   └── build-registry.js       # 构建注册表
├── dist/
│   └── registry.json           # 构建产物（自动生成）
└── .github/
    ├── workflows/
    │   └── validate.yml        # PR 自动验证
    └── PULL_REQUEST_TEMPLATE.md
```

#### 2.3.7 注册表同步

ProxyCast 客户端通过以下方式获取中转商列表：

```
https://raw.githubusercontent.com/AiClientProxy/transit-service-provider/main/dist/registry.json
```

客户端定期（每 24 小时）同步更新，也可手动刷新

### 2.4 中转商品牌展示

#### 2.4.1 扩展市场展示

```
┌─────────────────────────────────────────────────────────────────────────┐
│  扩展市场 > 中转服务                                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │   [Logo]     │ │   [Logo]     │ │   [Logo]     │ │   [Logo]     │   │
│  │  OpenRouter  │ │   硅基流动   │ │   XXX中转    │ │   YYY中转    │   │
│  │  ✓ 官方认证  │ │  ✓ 官方认证  │ │              │ │              │   │
│  │  ⭐ 4.9      │ │  ⭐ 4.8      │ │  ⭐ 4.5      │ │  ⭐ 4.3      │   │
│  │  [安装]      │ │  [安装]      │ │  [安装]      │ │  [安装]      │   │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 2.4.2 已安装中转商页面

```
┌─────────────────────────────────────────────────────────────────────────┐
│  XXX中转站                                                    [设置] [×]│
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  [Logo]  XXX中转站                                              │    │
│  │          稳定、便宜、快速的 AI API 中转服务                      │    │
│  │                                                                   │    │
│  │  [官网]  [充值]  [文档]  [状态]                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  我的 API Keys                                                   │    │
│  ├─────────────────────────────────────────────────────────────────┤    │
│  │                                                                   │    │
│  │  ┌─────────────────────────────────────────────────────────┐     │    │
│  │  │ 主账号                              sk-xxxx...xxxx       │     │    │
│  │  │ ● 正常                              [设为默认] [删除]    │     │    │
│  │  └─────────────────────────────────────────────────────────┘     │    │
│  │                                                                   │    │
│  │  ┌─────────────────────────────────────────────────────────┐     │    │
│  │  │ 备用账号                            sk-yyyy...yyyy       │     │    │
│  │  │ ● 正常                              [设为默认] [删除]    │     │    │
│  │  └─────────────────────────────────────────────────────────┘     │    │
│  │                                                                   │    │
│  │  [+ 添加 Key]                                                    │    │
│  │                                                                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  📢 公告                                                         │    │
│  ├─────────────────────────────────────────────────────────────────┤    │
│  │                                                                   │    │
│  │  🎉 新用户注册送 $5 额度！                                       │    │
│  │  📅 2026-01-01 ~ 2026-01-31                                      │    │
│  │  [立即注册]                                                      │    │
│  │                                                                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 三、技术实现

### 3.1 Deep Link 注册 (Tauri)

```rust
// src-tauri/src/main.rs

fn main() {
    tauri::Builder::default()
        // 注册自定义协议
        .register_uri_scheme_protocol("proxycast", |app, request| {
            handle_deep_link(app, request)
        })
        // ...
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn handle_deep_link(app: &AppHandle, request: &HttpRequest) -> Result<Response> {
    let url = request.uri();
    
    // 解析 proxycast://connect?relay=xxx&key=xxx
    if url.path() == "connect" {
        let params = parse_query_params(url.query());
        
        // 发送事件到前端
        app.emit_all("deep-link-connect", ConnectPayload {
            relay: params.get("relay"),
            key: params.get("key"),
            name: params.get("name"),
            ref_code: params.get("ref"),
        })?;
    }
    
    Ok(Response::default())
}
```

### 3.2 前端处理

```typescript
// src/hooks/useDeepLink.ts

import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';

interface ConnectPayload {
  relay: string;
  key: string;
  name?: string;
  ref?: string;
}

export function useDeepLink() {
  useEffect(() => {
    const unlisten = listen<ConnectPayload>('deep-link-connect', (event) => {
      const { relay, key, name, ref } = event.payload;
      
      // 显示确认弹窗
      showConnectConfirmDialog({
        relay,
        key,
        name,
        ref,
        onConfirm: () => addApiKey(relay, key, name),
        onCancel: () => {},
      });
    });
    
    return () => { unlisten.then(fn => fn()); };
  }, []);
}
```

### 3.3 确认弹窗组件

```tsx
// src/components/ConnectConfirmDialog.tsx

interface Props {
  relay: RelayInfo;
  key: string;
  name?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConnectConfirmDialog({ relay, key, name, onConfirm, onCancel }: Props) {
  const maskedKey = maskApiKey(key); // sk-xxxx...xxxx
  
  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5" />
            添加 API Key
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <img src={relay.logo} className="w-10 h-10 rounded" />
            <div>
              <div className="font-medium">{relay.name}</div>
              <div className="text-sm text-muted-foreground">
                {relay.description}
              </div>
            </div>
          </div>
          
          <div className="bg-muted p-3 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Key</span>
              <span className="font-mono">{maskedKey}</span>
            </div>
            {name && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">名称</span>
                <span>{name}</span>
              </div>
            )}
          </div>
          
          <p className="text-sm text-muted-foreground">
            确认后，此 Key 将被添加到 ProxyCast，您可以立即开始使用。
          </p>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>取消</Button>
          <Button onClick={onConfirm}>确认添加</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 3.4 中转商注册表（从 GitHub 加载）

```rust
// src-tauri/src/relay/registry.rs

use std::collections::HashMap;
use serde::{Deserialize, Serialize};

/// 注册表数据结构（对应 registry.json）
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RelayRegistry {
    pub version: String,
    pub updated_at: String,
    pub providers: Vec<RelayInfo>,
    
    #[serde(skip)]
    index: HashMap<String, usize>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RelayInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub branding: RelayBranding,
    pub links: RelayLinks,
    pub api: RelayApi,
    pub contact: RelayContact,
    #[serde(default)]
    pub features: RelayFeatures,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RelayBranding {
    pub logo: String,
    #[serde(default = "default_color")]
    pub color: String,
}

fn default_color() -> String { "#6366f1".to_string() }

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RelayLinks {
    pub homepage: String,
    pub register: Option<String>,
    pub recharge: Option<String>,
    pub docs: Option<String>,
    pub status: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RelayApi {
    pub base_url: String,
    pub protocol: String,
    #[serde(default = "default_auth_header")]
    pub auth_header: String,
    #[serde(default = "default_auth_prefix")]
    pub auth_prefix: String,
}

fn default_auth_header() -> String { "Authorization".to_string() }
fn default_auth_prefix() -> String { "Bearer ".to_string() }

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RelayContact {
    pub email: String,
    pub telegram: Option<String>,
    pub discord: Option<String>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct RelayFeatures {
    #[serde(default = "default_true")]
    pub streaming: bool,
    #[serde(default)]
    pub models_endpoint: bool,
}

fn default_true() -> bool { true }

impl RelayRegistry {
    /// 注册表 URL（从 GitHub 加载）
    const REGISTRY_URL: &'static str = 
        "https://raw.githubusercontent.com/AiClientProxy/transit-service-provider/main/dist/registry.json";
    
    /// 从 GitHub 加载中转商列表
    pub async fn load_from_github(&mut self) -> Result<()> {
        let response = reqwest::get(Self::REGISTRY_URL).await?;
        let mut registry: RelayRegistry = response.json().await?;
        
        // 构建索引
        for (i, provider) in registry.providers.iter().enumerate() {
            registry.index.insert(provider.id.clone(), i);
        }
        
        *self = registry;
        Ok(())
    }
    
    /// 获取中转商信息
    pub fn get(&self, id: &str) -> Option<&RelayInfo> {
        self.index.get(id).map(|&i| &self.providers[i])
    }
    
    /// 验证 relay_id 是否有效
    pub fn is_valid(&self, id: &str) -> bool {
        self.index.contains_key(id)
    }
    
    /// 获取所有中转商
    pub fn list(&self) -> &[RelayInfo] {
        &self.providers
    }
}
```

---

## 四、中转商接入指南

### 4.1 接入流程

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     中转商接入流程（GitHub PR）                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Step 1: Fork 仓库                                                       │
│  ─────────────────                                                       │
│  Fork https://github.com/AiClientProxy/transit-service-provider         │
│       │                                                                  │
│       ▼                                                                  │
│  Step 2: 创建配置文件                                                    │
│  ─────────────────                                                       │
│  在 providers/ 目录下创建 {your-id}.json                                │
│  参考 providers/_example.json 模板                                       │
│       │                                                                  │
│       ▼                                                                  │
│  Step 3: 提交 PR                                                         │
│  ─────────────────                                                       │
│  提交 Pull Request，填写 PR 模板                                         │
│       │                                                                  │
│       ▼                                                                  │
│  Step 4: 等待审核                                                        │
│  ─────────────────                                                       │
│  GitHub Actions 自动验证 + 维护者审核                                    │
│  通常 1-3 个工作日                                                       │
│       │                                                                  │
│       ▼                                                                  │
│  Step 5: 合并上线                                                        │
│  ─────────────────                                                       │
│  PR 合并后自动构建 registry.json                                         │
│  ProxyCast 客户端自动同步                                                │
│       │                                                                  │
│       ▼                                                                  │
│  Step 6: 集成使用                                                        │
│  ─────────────────                                                       │
│  在用户后台添加"一键配置"按钮                                            │
│  用户可以一键配置 ProxyCast                                              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 集成方式

#### 方式一：直接链接

最简单的方式，直接在页面放置链接：

```html
<a href="proxycast://connect?relay=myrelay&key=USER_API_KEY">
  一键配置 ProxyCast
</a>
```

#### 方式二：JavaScript SDK

提供更好的用户体验：

```html
<script src="https://proxycast.dev/sdk/connect.js"></script>

<button onclick="ProxyCast.connect({ relay: 'myrelay', key: userApiKey })">
  一键配置 ProxyCast
</button>
```

SDK 功能：
- 自动检测 ProxyCast 是否安装
- 未安装时显示下载引导
- 支持回调函数

```javascript
ProxyCast.connect({
  relay: 'myrelay',
  key: userApiKey,
  name: '我的Key',
  onSuccess: () => {
    showToast('配置成功！');
  },
  onNotInstalled: () => {
    // 显示自定义的下载引导
    showDownloadModal();
  }
});
```

#### 方式三：配置文件下载

生成 `.proxycast` 配置文件供用户下载：

```javascript
function downloadConfig(apiKey) {
  const config = {
    relay: 'myrelay',
    key: apiKey,
    name: '我的Key'
  };
  
  const blob = new Blob([JSON.stringify(config)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = 'myrelay.proxycast';
  a.click();
}
```

用户双击 `.proxycast` 文件，ProxyCast 自动打开并导入配置。

### 4.3 品牌素材要求

| 素材 | 规格 | 说明 |
|------|------|------|
| Logo | 256x256 PNG | 透明背景，正方形 |
| 主题色 | HEX 色值 | 用于 UI 强调色 |
| 简介 | ≤50 字 | 一句话描述 |
| 详细描述 | ≤200 字 | 详细介绍 |

### 4.4 API 要求

中转商的 API 需要满足：

| 要求 | 说明 |
|------|------|
| 协议兼容 | OpenAI 或 Anthropic 协议 |
| HTTPS | 必须使用 HTTPS |
| 模型列表 | 提供 `/models` 端点（可选） |
| 稳定性 | 99% 以上可用性 |

---

## 五、安全设计

### 5.1 Deep Link 安全

| 风险 | 防护措施 |
|------|---------|
| 恶意链接 | relay_id 必须在注册表中存在 |
| Key 泄露 | 确认弹窗显示脱敏 Key，用户确认后才添加 |
| 钓鱼攻击 | 显示中转商完整信息，用户可核实 |

### 5.2 确认弹窗

所有通过 Deep Link 添加的 Key 必须经过用户确认：

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  ⚠️ 安全提示                                                             │
│                                                                          │
│  您正在添加来自 [XXX中转站] 的 API Key                                   │
│                                                                          │
│  请确认：                                                                │
│  1. 您确实在 XXX中转站 申请了此 Key                                      │
│  2. 您信任 XXX中转站 的服务                                              │
│                                                                          │
│  Key: sk-xxxx...xxxx                                                    │
│                                                                          │
│  [取消]                                        [我确认，添加此 Key]      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.3 中转商审核

| 审核项 | 说明 |
|--------|------|
| 身份核实 | 验证中转商运营者身份 |
| API 测试 | 测试 API 可用性和兼容性 |
| 安全检查 | 检查是否有恶意行为历史 |
| 持续监控 | 定期检查服务状态 |

---

## 七、商业模式

### 7.1 免费服务

基础功能对中转商免费：
- 注册和审核
- Deep Link 功能
- 扩展市场展示
- 基础统计

### 7.2 增值服务（可选）

| 服务 | 说明 | 定价 |
|------|------|------|
| 官方认证 | 显示认证徽章，优先展示 | 待定 |
| 推荐位 | 扩展市场首页推荐 | 待定 |
| 高级统计 | 详细用户行为分析 | 待定 |
| 定制 UI | 自定义品牌页面 | 待定 |

### 7.3 合作模式

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     合作共赢                                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  中转商                          ProxyCast                               │
│  ──────                          ─────────                               │
│                                                                          │
│  推广 ProxyCast    ──────────▶   用户增长                               │
│                                                                          │
│  用户转化率提升    ◀──────────   一键配置功能                           │
│                                                                          │
│  品牌曝光          ◀──────────   扩展市场展示                           │
│                                                                          │
│  用户粘性          ◀──────────   统一管理体验                           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 六、实施计划

### 6.1 Phase 1: MVP (2 周)

| 任务 | 说明 |
|------|------|
| Deep Link 协议 | 实现 `proxycast://connect` |
| 确认弹窗 | 安全确认 UI |
| 注册表加载 | 从 GitHub 加载 registry.json |
| transit-service-provider 仓库 | 初始化仓库结构和 CI |

### 6.2 Phase 2: 完善 (2 周)

| 任务 | 说明 |
|------|------|
| Web 中转页 | proxycast.dev/connect |
| JS SDK | 前端集成 SDK |
| 扩展市场展示 | 中转商品牌页 |
| .proxycast 文件支持 | 配置文件导入 |

### 6.3 Phase 3: 生态 (持续)

| 任务 | 说明 |
|------|------|
| 中转商招募 | 邀请主流中转商提交 PR |
| 文档完善 | 接入指南、最佳实践 |
| 社区运营 | GitHub Discussions |

---

## 七、总结

### 7.1 核心价值

**ProxyCast Connect** 通过一键配置功能，实现：

1. **用户** - 零配置接入，开箱即用
2. **中转商** - 用户转化率提升，品牌曝光
3. **ProxyCast** - 用户增长，生态繁荣

### 7.2 开源优势

| 优势 | 说明 |
|------|------|
| 透明 | 所有中转商信息公开可查 |
| 去中心化 | 无需依赖 ProxyCast 官方服务器 |
| 社区驱动 | 任何人都可以贡献和审核 |
| 低成本 | 无需维护注册后台 |

### 7.3 关键指标

| 指标 | 目标 |
|------|------|
| 接入中转商数量 | 20+ |
| GitHub Stars | 1,000+ |
| 一键配置转化率 | 80%+ |

### 7.4 相关仓库

| 仓库 | 说明 |
|------|------|
| [proxycast](https://github.com/AiClientProxy/proxycast) | ProxyCast 主项目 |
| [transit-service-provider](https://github.com/AiClientProxy/transit-service-provider) | 中转商注册仓库 |
