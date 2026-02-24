#!/bin/bash

echo "🔧 ProxyCast 本地安装脚本"
echo "================================"

# 1. 更新 Rust
echo "📦 检查 Rust 版本..."
CURRENT_VERSION=$(rustc --version | awk '{print $2}')
echo "当前版本: $CURRENT_VERSION"

if ! rustc --version | grep -q "1.9"; then
    echo "⚠️  Rust 版本过低，正在更新..."
    rustup update stable
    source "$HOME/.cargo/env"
fi

echo "✅ Rust 版本: $(rustc --version | awk '{print $1,$2}')"

# 2. 清理之前的构建
echo ""
echo "🧹 清理之前的构建..."
cargo clean 2>/dev/null || true

# 3. 编译
echo ""
echo "🔨 开始编译 (dev 模式)..."
cargo build 2>&1 | tee /tmp/proxycast_build.log

BUILD_STATUS=${PIPESTATUS[0]}
if [ $BUILD_STATUS -ne 0 ]; then
    echo "❌ 编译失败！查看日志: /tmp/proxycast_build.log"
    tail -50 /tmp/proxycast_build.log
    exit 1
fi

echo "✅ 编译成功"

# 4. 本地安装
echo ""
echo "📦 正在本地安装..."
cargo install --path . --force 2>&1 | tee /tmp/proxycast_install.log

INSTALL_STATUS=${PIPESTATUS[0]}
if [ $INSTALL_STATUS -ne 0 ]; then
    echo "❌ 安装失败！查看日志: /tmp/proxycast_install.log"
    tail -50 /tmp/proxycast_install.log
    exit 1
fi

echo "✅ 安装成功"

# 5. 验证安装
echo ""
echo "🔍 验证安装..."
if command -v proxycast &> /dev/null; then
    echo "✅ ProxyCast 已安装到: $(which proxycast)"
else
    echo "⚠️  ProxyCast 命令行工具未在 PATH 中"
    echo "安装位置: ~/.cargo/bin/proxycast"
    echo ""
    echo "请将以下内容添加到 ~/.zshrc 或 ~/.bash_profile:"
    echo 'export PATH="$HOME/.cargo/bin:$PATH"'
fi

echo ""
echo "🎉 安装完成！"
echo ""
echo "运行应用:"
echo "  开发模式: cd .. && npm run tauri dev"
echo "  构建应用: npm run tauri build"
