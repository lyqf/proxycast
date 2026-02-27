## ProxyCast v0.73.0

发布日期：2026-02-27

### ✨ 新功能

#### 记忆管理系统
- 新增多层记忆架构：支持组织策略、项目记忆、用户记忆、项目本地记忆四层配置
- 新增记忆画像（MemoryProfile）：可配置学习状态、擅长领域、解释风格、难题偏好
- 新增记忆设置页面（settings-v2/general/memory），支持记忆来源、自动记忆、画像等配置
- 新增记忆层级指标统计（memoryLayerMetrics），量化各层记忆贡献
- 新增 memory profile prompt 服务，将记忆画像自动合并到系统提示词

#### Agent 增强
- Agent 支持上下文准备轨迹（ContextTrace）事件，前端可展示上下文注入过程
- 新增 instruction discovery 模块，自动发现项目级指令文件
- 新增 shell security 和 tool permissions 模块
- 新增 hooks 模块，支持 Agent 生命周期钩子
- SessionConfigBuilder 支持 include_context_trace 配置

#### 技能与处理器
- 新增 skill matcher 模块，优化技能匹配逻辑
- 新增 processor steps registry，统一步骤注册管理

#### 渠道管理
- 新增 ChannelsConfig 配置类型与渠道管理 UI 组件

### 🐛 修复
- 修复 workspace_mismatch 错误：会话切换 workspace 时自动更新 working_dir，不再阻断用户操作
- 修复前端 lint 错误：清理未使用的导入和不必要的 try/catch 包装
- 修复 Config 测试中缺少 channels 字段导致编译失败的问题

### 🔧 优化与重构
- 优化 unified memory API 和前端调用
- 移除废弃的 external-tools 设置页面

### 📦 技术细节
- 54 个文件变更，+2279 行，-410 行
- 新增 10 个文件，涵盖记忆管理、Agent 安全、技能匹配等模块
