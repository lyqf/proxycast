# 图片生成模块

AI 图片生成功能，支持多个提供商和模型。

## 功能特性

- 支持多个图片生成提供商（智谱、AiHubMix、硅基流动等）
- 支持多种图片尺寸选择
- 历史记录管理
- 提供商配置管理

## 文件结构

| 文件 | 说明 |
|------|------|
| `ImageGenPage.tsx` | 主页面组件 |
| `ProviderConfigModal.tsx` | 提供商配置弹窗 |
| `useImageGen.ts` | 状态管理 Hook |
| `types.ts` | 类型定义 |
| `index.ts` | 模块导出 |

## 支持的提供商

- 智谱开放平台 (CogView-3-Flash, CogView-4)
- AiHubMix (DALL-E 3)
- 硅基流动 (FLUX.1-schnell)
- DMXAPI (DALL-E 3)
- TokenFlux (DALL-E 3)
- New API (DALL-E 3)
- CherryIN (DALL-E 3)

## 使用方式

1. 点击左侧导航栏的"图片生成"图标
2. 点击设置按钮添加提供商
3. 选择提供商、模型和尺寸
4. 输入描述文字，点击发送生成图片

## API 接口

使用 OpenAI 兼容的 `/v1/images/generations` 接口。
