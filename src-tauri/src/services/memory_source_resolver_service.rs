//! 记忆来源解析服务
//!
//! 将配置中的记忆来源（AGENTS、规则、自动记忆等）统一解析为可观察结果与可注入提示词片段。

use crate::services::auto_memory_service::{get_auto_memory_index, resolve_auto_memory_root};
use crate::services::memory_import_parser_service::{parse_memory_file, MemoryImportParseOptions};
use crate::services::memory_rules_loader_service::load_rules;
use proxycast_core::config::{Config, MemoryConfig};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Path, PathBuf};

/// 单个来源解析结果
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EffectiveMemorySource {
    /// 来源类型：managed_policy/project/user/local/rule/auto_memory/additional
    pub kind: String,
    /// 来源路径
    pub path: String,
    /// 文件或目录是否存在
    pub exists: bool,
    /// 是否被实际加载
    pub loaded: bool,
    /// 内容行数（目录类来源为 0）
    pub line_count: u32,
    /// 导入展开后额外包含的文件数
    pub import_count: u32,
    /// 告警信息
    pub warnings: Vec<String>,
    /// 预览（最多 300 字）
    pub preview: Option<String>,
}

/// 来源解析总览
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EffectiveMemorySourcesResponse {
    pub working_dir: String,
    pub total_sources: u32,
    pub loaded_sources: u32,
    pub follow_imports: bool,
    pub import_max_depth: u8,
    pub sources: Vec<EffectiveMemorySource>,
}

/// 内部解析结果（包含可注入片段）
#[derive(Debug, Clone)]
pub struct MemorySourceResolution {
    pub response: EffectiveMemorySourcesResponse,
    pub prompt_segments: Vec<String>,
}

/// 解析有效记忆来源
pub fn resolve_effective_sources(
    config: &Config,
    working_dir: &Path,
    active_relative_path: Option<&str>,
) -> MemorySourceResolution {
    let memory = &config.memory;
    let options = MemoryImportParseOptions {
        follow_imports: memory.resolve.follow_imports,
        max_depth: memory.resolve.import_max_depth as usize,
    };

    let mut sources = Vec::new();
    let mut prompt_segments = Vec::new();
    let mut seen = HashSet::new();

    // 1. managed policy
    let managed_policy_path = memory
        .sources
        .managed_policy_path
        .as_deref()
        .map(|v| expand_path(v, Some(working_dir)))
        .unwrap_or_else(default_managed_policy_path);
    resolve_file_source(
        "managed_policy",
        &managed_policy_path,
        true,
        &options,
        &mut seen,
        &mut sources,
        &mut prompt_segments,
    );

    // 2. user memory
    let user_memory_path = memory
        .sources
        .user_memory_path
        .as_deref()
        .map(|v| expand_path(v, Some(working_dir)))
        .unwrap_or_else(default_user_memory_path);
    resolve_file_source(
        "user_memory",
        &user_memory_path,
        true,
        &options,
        &mut seen,
        &mut sources,
        &mut prompt_segments,
    );

    // 3. project hierarchy memory + rules
    let ancestors = collect_ancestor_dirs(working_dir);
    for ancestor in &ancestors {
        for rel in &memory.sources.project_memory_paths {
            if rel.trim().is_empty() {
                continue;
            }
            let candidate = ancestor.join(rel);
            resolve_file_source(
                "project_memory",
                &candidate,
                false,
                &options,
                &mut seen,
                &mut sources,
                &mut prompt_segments,
            );
        }

        if let Some(project_local_rel) = memory
            .sources
            .project_local_memory_path
            .as_deref()
            .map(str::trim)
            .filter(|v| !v.is_empty())
        {
            let candidate = ancestor.join(project_local_rel);
            resolve_file_source(
                "project_local",
                &candidate,
                false,
                &options,
                &mut seen,
                &mut sources,
                &mut prompt_segments,
            );
        }

        for rel in &memory.sources.project_rule_dirs {
            if rel.trim().is_empty() {
                continue;
            }
            let rule_dir = ancestor.join(rel);
            resolve_rule_sources(
                &rule_dir,
                active_relative_path,
                false,
                &mut seen,
                &mut sources,
                &mut prompt_segments,
            );
        }
    }

    // 4. additional directories
    if memory.resolve.load_additional_dirs_memory {
        for additional in &memory.resolve.additional_dirs {
            let additional_dir = expand_path(additional, Some(working_dir));
            for rel in &memory.sources.project_memory_paths {
                if rel.trim().is_empty() {
                    continue;
                }
                let candidate = additional_dir.join(rel);
                resolve_file_source(
                    "additional_memory",
                    &candidate,
                    false,
                    &options,
                    &mut seen,
                    &mut sources,
                    &mut prompt_segments,
                );
            }
            for rel in &memory.sources.project_rule_dirs {
                if rel.trim().is_empty() {
                    continue;
                }
                let rule_dir = additional_dir.join(rel);
                resolve_rule_sources(
                    &rule_dir,
                    active_relative_path,
                    false,
                    &mut seen,
                    &mut sources,
                    &mut prompt_segments,
                );
            }
        }
    }

    // 5. auto memory
    resolve_auto_memory_source(
        memory,
        working_dir,
        &mut sources,
        &mut prompt_segments,
        &mut seen,
    );

    let loaded_sources = sources.iter().filter(|s| s.loaded).count() as u32;
    let response = EffectiveMemorySourcesResponse {
        working_dir: working_dir.to_string_lossy().to_string(),
        total_sources: sources.len() as u32,
        loaded_sources,
        follow_imports: options.follow_imports,
        import_max_depth: options.max_depth as u8,
        sources,
    };

    MemorySourceResolution {
        response,
        prompt_segments,
    }
}

/// 构建可注入到 system prompt 的记忆来源片段
pub fn build_memory_sources_prompt(
    config: &Config,
    working_dir: &Path,
    active_relative_path: Option<&str>,
    max_chars: usize,
) -> Option<String> {
    let resolution = resolve_effective_sources(config, working_dir, active_relative_path);
    if resolution.prompt_segments.is_empty() {
        return None;
    }

    let mut output = String::from("【记忆来源补充指令】\n");
    output.push_str("以下内容来自配置化记忆来源，请优先遵循：\n");

    let mut used = 0usize;
    for segment in resolution.prompt_segments {
        if segment.trim().is_empty() {
            continue;
        }
        if used >= max_chars {
            break;
        }
        let remaining = max_chars.saturating_sub(used);
        let clipped = clip_text(&segment, remaining);
        if clipped.trim().is_empty() {
            continue;
        }
        output.push('\n');
        output.push_str(&clipped);
        output.push('\n');
        used += clipped.chars().count();
    }

    if used == 0 {
        None
    } else {
        Some(output.trim().to_string())
    }
}

fn resolve_file_source(
    kind: &str,
    file_path: &Path,
    include_missing: bool,
    options: &MemoryImportParseOptions,
    seen: &mut HashSet<PathBuf>,
    output: &mut Vec<EffectiveMemorySource>,
    prompt_segments: &mut Vec<String>,
) {
    let normalized = normalize_path(file_path);
    if !seen.insert(normalized.clone()) {
        return;
    }

    if !normalized.exists() || !normalized.is_file() {
        if !include_missing {
            return;
        }
        output.push(EffectiveMemorySource {
            kind: kind.to_string(),
            path: normalized.to_string_lossy().to_string(),
            exists: false,
            loaded: false,
            line_count: 0,
            import_count: 0,
            warnings: Vec::new(),
            preview: None,
        });
        return;
    }

    match parse_memory_file(&normalized, options) {
        Ok(parsed) => {
            let content = parsed.content.trim().to_string();
            let preview = if content.is_empty() {
                None
            } else {
                Some(clip_text(&content, 300))
            };

            let loaded = !content.is_empty();
            let line_count = if loaded {
                content.lines().count() as u32
            } else {
                0
            };

            output.push(EffectiveMemorySource {
                kind: kind.to_string(),
                path: normalized.to_string_lossy().to_string(),
                exists: true,
                loaded,
                line_count,
                import_count: parsed.imported_files.len() as u32,
                warnings: parsed.warnings.clone(),
                preview,
            });

            if loaded {
                prompt_segments.push(format!(
                    "### {} ({})\n{}",
                    kind,
                    normalized.display(),
                    content
                ));
            }
        }
        Err(err) => {
            output.push(EffectiveMemorySource {
                kind: kind.to_string(),
                path: normalized.to_string_lossy().to_string(),
                exists: true,
                loaded: false,
                line_count: 0,
                import_count: 0,
                warnings: vec![err],
                preview: None,
            });
        }
    }
}

fn resolve_rule_sources(
    rule_dir: &Path,
    active_relative_path: Option<&str>,
    include_missing: bool,
    seen: &mut HashSet<PathBuf>,
    output: &mut Vec<EffectiveMemorySource>,
    prompt_segments: &mut Vec<String>,
) {
    let normalized = normalize_path(rule_dir);
    let dir_key = normalized.join("__rules_dir__");
    if !seen.insert(dir_key) {
        return;
    }

    if !normalized.exists() || !normalized.is_dir() {
        if !include_missing {
            return;
        }
        output.push(EffectiveMemorySource {
            kind: "project_rules".to_string(),
            path: normalized.to_string_lossy().to_string(),
            exists: false,
            loaded: false,
            line_count: 0,
            import_count: 0,
            warnings: Vec::new(),
            preview: None,
        });
        return;
    }

    let rules = load_rules(&normalized, active_relative_path);
    if rules.is_empty() {
        if !include_missing {
            return;
        }
        output.push(EffectiveMemorySource {
            kind: "project_rules".to_string(),
            path: normalized.to_string_lossy().to_string(),
            exists: true,
            loaded: false,
            line_count: 0,
            import_count: 0,
            warnings: vec!["规则目录存在，但未发现可用规则".to_string()],
            preview: None,
        });
        return;
    }

    for rule in rules {
        let normalized_rule = normalize_path(&rule.path);
        if !seen.insert(normalized_rule.clone()) {
            continue;
        }

        let loaded = rule.matched && !rule.content.trim().is_empty();
        let mut warnings = Vec::new();
        if !rule.matched && !rule.path_patterns.is_empty() {
            warnings.push(format!(
                "规则 paths 未命中: {}",
                rule.path_patterns.join(", ")
            ));
        }
        output.push(EffectiveMemorySource {
            kind: "project_rule".to_string(),
            path: normalized_rule.to_string_lossy().to_string(),
            exists: true,
            loaded,
            line_count: if loaded {
                rule.content.lines().count() as u32
            } else {
                0
            },
            import_count: 0,
            warnings,
            preview: if loaded {
                Some(clip_text(&rule.content, 300))
            } else {
                None
            },
        });

        if loaded {
            prompt_segments.push(format!(
                "### 规则: {} ({})\n{}",
                rule.title,
                normalized_rule.display(),
                rule.content
            ));
        }
    }
}

fn resolve_auto_memory_source(
    memory_config: &MemoryConfig,
    working_dir: &Path,
    output: &mut Vec<EffectiveMemorySource>,
    prompt_segments: &mut Vec<String>,
    seen: &mut HashSet<PathBuf>,
) {
    let auto_root = resolve_auto_memory_root(working_dir, &memory_config.auto);
    let entry_name = memory_config.auto.entrypoint.trim();
    let entry_name = if entry_name.is_empty() {
        "MEMORY.md"
    } else {
        entry_name
    };
    let entry_path = normalize_path(&auto_root.join(entry_name));
    if !seen.insert(entry_path.clone()) {
        return;
    }

    let index = get_auto_memory_index(memory_config, working_dir);
    match index {
        Ok(idx) => {
            let loaded = idx.entry_exists && !idx.preview_lines.is_empty();
            output.push(EffectiveMemorySource {
                kind: "auto_memory".to_string(),
                path: entry_path.to_string_lossy().to_string(),
                exists: idx.entry_exists,
                loaded,
                line_count: idx.total_lines,
                import_count: idx.items.len() as u32,
                warnings: if !memory_config.auto.enabled {
                    vec!["自动记忆已关闭".to_string()]
                } else {
                    Vec::new()
                },
                preview: if loaded {
                    Some(clip_text(&idx.preview_lines.join("\n"), 300))
                } else {
                    None
                },
            });

            if loaded {
                prompt_segments.push(format!(
                    "### auto_memory ({})\n{}",
                    entry_path.display(),
                    idx.preview_lines.join("\n")
                ));
            }
        }
        Err(err) => {
            output.push(EffectiveMemorySource {
                kind: "auto_memory".to_string(),
                path: entry_path.to_string_lossy().to_string(),
                exists: entry_path.exists(),
                loaded: false,
                line_count: 0,
                import_count: 0,
                warnings: vec![err],
                preview: None,
            });
        }
    }
}

fn collect_ancestor_dirs(start: &Path) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    let mut current = if start.is_file() {
        start
            .parent()
            .unwrap_or_else(|| Path::new("."))
            .to_path_buf()
    } else {
        start.to_path_buf()
    };
    let project_root = find_git_root(&current);
    let home_dir = dirs::home_dir();
    let mut depth = 0usize;

    loop {
        dirs.push(current.clone());
        if let Some(root) = project_root.as_ref() {
            if &current == root {
                break;
            }
        }
        if let Some(home) = home_dir.as_ref() {
            if &current == home {
                break;
            }
        }
        // 兜底保护，避免跨层级扫描过深导致来源列表爆炸
        if depth >= 12 {
            break;
        }
        if !current.pop() {
            break;
        }
        depth += 1;
    }

    dirs
}

fn expand_path(path: &str, working_dir: Option<&Path>) -> PathBuf {
    let trimmed = path.trim();
    if trimmed.starts_with("~/") {
        if let Some(home) = dirs::home_dir() {
            return home.join(trimmed.trim_start_matches("~/"));
        }
    }

    let p = PathBuf::from(trimmed);
    if p.is_absolute() {
        return p;
    }

    if let Some(base) = working_dir {
        return base.join(p);
    }
    p
}

fn default_user_memory_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".proxycast")
        .join("AGENTS.md")
}

fn default_managed_policy_path() -> PathBuf {
    #[cfg(target_os = "macos")]
    {
        return PathBuf::from("/Library/Application Support/ProxyCast/AGENTS.md");
    }
    #[cfg(target_os = "linux")]
    {
        return PathBuf::from("/etc/proxycast/AGENTS.md");
    }
    #[cfg(target_os = "windows")]
    {
        return PathBuf::from("C:/Program Files/ProxyCast/AGENTS.md");
    }
    #[allow(unreachable_code)]
    PathBuf::from("/etc/proxycast/AGENTS.md")
}

fn normalize_path(path: &Path) -> PathBuf {
    path.canonicalize().unwrap_or_else(|_| path.to_path_buf())
}

fn find_git_root(start: &Path) -> Option<PathBuf> {
    let mut current = if start.is_file() {
        start.parent()?.to_path_buf()
    } else {
        start.to_path_buf()
    };

    loop {
        if current.join(".git").exists() {
            return Some(current);
        }
        if !current.pop() {
            return None;
        }
    }
}

fn clip_text(text: &str, max_chars: usize) -> String {
    if max_chars == 0 {
        return String::new();
    }
    let mut chars = text.chars();
    let clipped: String = chars.by_ref().take(max_chars).collect();
    if chars.next().is_some() {
        format!("{clipped}...")
    } else {
        clipped
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn should_resolve_project_memory_and_rules() {
        let tmp = TempDir::new().expect("create temp dir");
        let root = tmp.path();
        fs::create_dir_all(root.join(".agents/rules")).expect("create rules");
        fs::write(root.join("AGENTS.md"), "# 项目记忆\n- use rust").expect("write agents");
        fs::write(root.join(".agents/rules/general.md"), "# 规则\n- KISS").expect("write rule");

        let mut cfg = Config::default();
        cfg.memory.enabled = true;
        cfg.memory.sources.project_memory_paths = vec!["AGENTS.md".to_string()];
        cfg.memory.sources.project_rule_dirs = vec![".agents/rules".to_string()];
        cfg.memory.resolve.follow_imports = true;
        cfg.memory.resolve.import_max_depth = 3;

        let resolved = resolve_effective_sources(&cfg, root, Some("src/main.rs"));
        assert!(resolved.response.total_sources > 0);
        assert!(resolved.response.loaded_sources > 0);
        assert!(!resolved.prompt_segments.is_empty());
    }

    #[test]
    fn should_support_additional_dirs_when_enabled() {
        let tmp = TempDir::new().expect("create temp dir");
        let root = tmp.path().join("main");
        let ext = tmp.path().join("extra");
        fs::create_dir_all(&root).expect("create main");
        fs::create_dir_all(&ext).expect("create extra");
        fs::write(ext.join("AGENTS.md"), "extra memory").expect("write extra agents");

        let mut cfg = Config::default();
        cfg.memory.enabled = true;
        cfg.memory.sources.project_memory_paths = vec!["AGENTS.md".to_string()];
        cfg.memory.resolve.load_additional_dirs_memory = true;
        cfg.memory.resolve.additional_dirs = vec![ext.to_string_lossy().to_string()];

        let resolved = resolve_effective_sources(&cfg, &root, None);
        let has_additional_loaded = resolved
            .response
            .sources
            .iter()
            .any(|s| s.kind == "additional_memory" && s.loaded);
        assert!(has_additional_loaded);
    }
}
