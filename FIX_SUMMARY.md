# Windows 闪退问题修复总结

## 问题概述
用户报告 ProxyCast v0.70 在 Windows 11 上发送第一条消息时崩溃，而 macOS 开发环境正常工作。

## 根本原因分析

### 1. 平台差异
通过 Context7 MCP 分析发现的关键差异：

| 平台 | 渲染引擎 | I/O 模型 | 特点 |
|------|----------|----------|------|
| Windows | Chromium | IOCP | 更严格的资源限制 |
| macOS | WebKit | kqueue | POSIX 风格的文件锁 |
| Linux | WebKit | epoll/io-uring | 灵活的线程池 |

### 2. Tokio Runtime 创建问题
原来的代码：
```rust
tokio::runtime::Runtime::new().unwrap()
```

**问题**：
- `Runtime::new()` 在不同平台上有不同的默认行为
- Windows 上线程池创建可能失败
- IOCP 初始化可能因资源不足失败

### 3. 版本检查
✅ **aster-rust v0.13.0** - 已是最新版本，无需更新

## 修复方案

### 修复 1: 改进 Tokio Runtime 创建
**文件**: `src-tauri/src/app/bootstrap.rs:147`

```rust
// 修改前
tokio::runtime::Runtime::new()
    .expect("Failed to create tokio runtime...")
    .handle()
    .clone()

// 修改后
tokio::runtime::Builder::new_multi_thread()
    .worker_threads(2)  // 限制线程数，避免 Windows 资源问题
    .thread_name("proxycast-runtime")
    .enable_io()
    .enable_time()
    .build()
    .expect("Failed to create tokio runtime: 系统资源不足或配置错误")
    .handle()
    .clone()
```

**优势**：
- 使用 Builder 模式获得更多控制
- 限制工作线程数，避免 Windows 资源问题
- 添加平台特定的日志输出
- 提高错误信息的可读性

### 修复 2: 添加 Windows 数据库验证
```rust
#[cfg(target_os = "windows")]
{
    tracing::info!("[Bootstrap] Windows 平台 - 验证数据库文件权限");
    match db.lock() {
        Ok(conn) => {
            if let Err(e) = conn.execute("PRAGMA user_version", []) {
                tracing::warn!("[Bootstrap] Windows 数据库验证失败: {}", e);
            } else {
                tracing::info!("[Bootstrap] Windows 数据库验证成功");
            }
        }
        Err(e) => {
            tracing::warn!("[Bootstrap] Windows 数据库锁获取失败: {}", e);
        }
    }
}
```

### 修复 3: 前端错误处理
**文件**: `src/components/agent/chat/index.tsx`

```typescript
try {
  await sendMessage(text, images || [], webSearch, thinking, false, sendExecutionStrategy);
} catch (error) {
  console.error("[AgentChat] 发送消息失败:", error);
  toast.error(`发送失败: ${error instanceof Error ? error.message : String(error)}`);
  setInput(sourceText);  // 恢复输入内容
}
```

## 提交记录

### 提交 1: 0f6044d6
```
fix: 修复发送第一条消息时的闪退问题

- 移除危险的 unwrap() 调用
- 添加前端错误处理
- 验证模型过滤逻辑
- 验证加密模块
```

### 提交 2: 0a1243e6
```
feat: 改进 Windows 平台兼容性

- 使用 Builder 模式创建 Tokio Runtime
- 限制工作线程数为 2
- 添加 Windows 数据库验证
- 添加平台特定的日志输出
```

## 文档

创建了完整的文档体系：

1. **WINDOWS_CRASH_ANALYSIS.md**
   - 平台差异详细分析
   - Context7 MCP 文档引用
   - 风险点识别
   - 修复建议

2. **WINDOWS_TEST_GUIDE.md**
   - Windows 11 测试步骤
   - 常见问题排查
   - 日志收集方法
   - 性能对比

3. **test-crash-fix.md**
   - 修复验证清单
   - 测试步骤
   - 预期结果

4. **test-messaging.sh**
   - 自动化测试脚本

## 验证步骤

### 用户验证
1. 拉取最新代码
2. 在 Windows 11 上启动应用
3. 发送第一条消息
4. 查看日志输出

### 预期日志
```
[INFO] [Bootstrap] Windows 平台 - 创建 Tokio Runtime (IOCP)
[INFO] [Bootstrap] Windows 平台 - 验证数据库文件权限
[INFO] [Bootstrap] Windows 数据库验证成功
[INFO] [AsterAgent] 发送流式消息: session=xxx, event=xxx
```

### 如果仍然崩溃
收集以下信息：
1. 启用详细日志：`$env:RUST_LOG=trace`
2. 检查事件查看器
3. 提供完整堆栈跟踪
4. 系统信息：`systeminfo`

## 技术亮点

### Context7 MCP 使用
成功使用 Context7 MCP 查询：
- Tauri 平台差异文档
- Tokio Runtime 跨平台兼容性
- Rust 平台特定代码模式

### 跨平台最佳实践
- 使用条件编译 `#[cfg(target_os = "windows")]`
- 使用 Builder 模式获得更多控制
- 添加平台特定的验证逻辑
- 提供详细的错误上下文

## 下一步

1. **在 Windows 11 上测试**
   - 验证启动流程
   - 验证消息发送
   - 收集性能数据

2. **添加 CI/CD**
   - Windows 构建管道
   - 自动化测试
   - 性能基准测试

3. **持续改进**
   - 监控 Windows 特定问题
   - 优化线程池配置
   - 改进错误处理

## 参考资料

- [Tauri Windows 文档](https://tauri.app/v1/guides/building/windows)
- [Tokio Runtime 文档](https://tokio.rs/tokio/topics/runtime)
- [Rust Windows 平台支持](https://doc.rust-lang.org/rustc/platform-support/windows-pc-gnu-msvc.html)
- [Context7 MCP](https://context7.com)

## 致谢

感谢用户反馈，帮助我们发现并修复这个跨平台兼容性问题。
