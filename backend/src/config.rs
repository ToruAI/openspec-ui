use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("Failed to read config file: {0}")]
    ReadError(#[from] std::io::Error),
    #[error("Failed to parse config file: {0}")]
    ParseError(#[from] serde_json::Error),
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
pub struct SourceConfig {
    pub name: String,
    pub path: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Config {
    pub sources: Vec<SourceConfig>,
    /// Port written in the file. `None` means "not specified", which lets the
    /// server move to the next free port when the default one is taken.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub port: Option<u16>,
}

#[derive(Debug, Clone)]
pub struct Source {
    pub id: String,
    pub name: String,
    pub path: PathBuf,
    pub valid: bool,
}

impl Config {
    pub fn load(path: &Path) -> Result<Self, ConfigError> {
        let content = std::fs::read_to_string(path)?;
        let config: Config = serde_json::from_str(&content)?;
        Ok(config)
    }
}

/// Paths starting with `./` or `../` are relative to `base_path` (the config
/// file's folder); anything else is used as written.
pub fn resolve_path(path: &str, base_path: &Path) -> PathBuf {
    if path.starts_with("./") || path.starts_with("../") {
        base_path.join(path)
    } else {
        PathBuf::from(path)
    }
}

pub fn resolve_sources(sources: &[SourceConfig], base_path: &Path) -> Vec<Source> {
    sources
        .iter()
        .map(|s| {
            let path = resolve_path(&s.path, base_path);
            let valid = path.exists() && path.is_dir();
            if !valid {
                tracing::warn!("Source path does not exist or is not a directory: {:?}", path);
            }
            Source {
                id: s.name.clone(),
                name: s.name.clone(),
                path,
                valid,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn port_is_optional_and_not_written_back_when_absent() {
        let c: Config = serde_json::from_str(r#"{"sources":[]}"#).unwrap();
        assert_eq!(c.port, None);
        assert!(!serde_json::to_string(&c).unwrap().contains("port"));

        let c: Config = serde_json::from_str(r#"{"sources":[],"port":4000}"#).unwrap();
        assert_eq!(c.port, Some(4000));
        assert!(serde_json::to_string(&c).unwrap().contains("4000"));
    }
}
