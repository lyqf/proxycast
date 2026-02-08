//! 终端模块错误类型
//!
//! 定义终端核心能力相关的错误类型。
//!
//! ## 功能
//! - 会话管理错误
//! - PTY 操作错误
//! - 块文件存储错误
//! - 数据库错误
//! - 序列化支持

use thiserror::Error;

/// 终端错误类型
#[derive(Debug, Error)]
pub enum TerminalError {
    /// 会话不存在
    #[error("会话不存在: {0}")]
    SessionNotFound(String),

    /// PTY 创建失败
    #[error("PTY 创建失败: {0}")]
    PtyCreationFailed(String),

    /// 写入失败
    #[error("写入失败: {0}")]
    WriteFailed(String),

    /// 调整大小失败
    #[error("调整大小失败: {0}")]
    ResizeFailed(String),

    /// 会话已关闭
    #[error("会话已关闭")]
    SessionClosed,

    /// Base64 解码失败
    #[error("Base64 解码失败: {0}")]
    Base64DecodeFailed(String),

    /// 块文件错误
    #[error("块文件错误: {0}")]
    BlockFileError(String),

    /// 数据库错误
    #[error("数据库错误: {0}")]
    DatabaseError(String),

    /// 控制器未找到
    #[error("控制器未找到: {0}")]
    ControllerNotFound(String),

    /// SSH 连接失败
    #[error("SSH 连接失败: {0}")]
    SSHConnectionFailed(String),

    /// SSH 认证失败
    #[error("SSH 认证失败: {0}")]
    SSHAuthFailed(String),

    /// WSL 连接失败
    #[error("WSL 连接失败: {0}")]
    WSLConnectionFailed(String),

    /// 无效的 OSC 序列
    #[error("无效的 OSC 序列: {0}")]
    InvalidOSCSequence(String),

    /// 连接超时
    #[error("连接超时")]
    ConnectionTimeout,

    /// 用户取消
    #[error("用户取消")]
    UserCancelled,

    /// 主机密钥验证失败
    #[error("主机密钥验证失败: {0}")]
    HostKeyVerificationFailed(String),

    /// 内部错误
    #[error("内部错误: {0}")]
    Internal(String),

    /// 无效的连接类型
    #[error("无效的连接类型: {0}")]
    InvalidConnectionType(String),
}

impl From<TerminalError> for String {
    fn from(err: TerminalError) -> Self {
        err.to_string()
    }
}

impl serde::Serialize for TerminalError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
