# settings

<!-- 一旦我所属的文件夹有所变化，请更新我 -->

## 架构说明

设置页面组件集合，提供应用配置界面。采用分组设计，每个设置类别独立为一个组件。

## 文件索引

| 文件 | 说明 |
|------|------|
| `index.ts` | 模块导出入口 |
| `SettingsPage.tsx` | 设置页面主容器，管理标签页切换 |
| `GeneralSettings.tsx` | 通用设置（主题、语言等） |
| `ProxySettings.tsx` | 代理服务器设置 |
| `ConnectionsSettings.tsx` | 连接管理设置 |
| `DeveloperSettings.tsx` | 开发者选项设置 |
| `ExperimentalSettings.tsx` | 实验室功能设置（截图对话、自动更新检查等） |
| `ExtensionsSettings.tsx` | 扩展管理设置 |
| `AboutSection.tsx` | 关于页面（版本信息、更新检查） |
| `LanguageSelector.tsx` | 语言选择器组件 |
| `UpdateNotification.tsx` | 更新提醒弹窗和更新检查设置组件 |
| `GeneralSettings.test.ts` | 通用设置测试文件 |

## 更新提醒

任何文件变更后，请更新此文档和相关的上级文档。
