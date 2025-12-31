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

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SourceConfig {
    pub name: String,
    pub path: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Config {
    pub sources: Vec<SourceConfig>,
    #[serde(default = "default_port")]
    pub port: u16,
}

fn default_port() -> u16 {
    3000
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

    pub fn resolve_sources(&self, base_path: &Path) -> Vec<Source> {
        self.sources
            .iter()
            .map(|s| {
                let path = if s.path.starts_with("./") || s.path.starts_with("../") {
                    base_path.join(&s.path)
                } else {
                    PathBuf::from(&s.path)
                };
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
}
