use crate::config::{Config, Source, SourceConfig};
use serde::Serialize;
use std::{
    path::PathBuf,
    sync::Arc,
};
use tokio::sync::{broadcast, RwLock};

#[derive(Clone)]
pub struct AppState {
    pub inner: Arc<RwLock<AppStateInner>>,
    pub config_manager: Arc<ConfigManager>,
    pub update_tx: broadcast::Sender<()>,
}

pub struct AppStateInner {
    pub sources: Vec<Source>,
    pub config_update_tx: broadcast::Sender<()>,
}

impl AppState {
    pub fn new(
        sources: Vec<Source>,
        config_manager: Arc<ConfigManager>,
        update_tx: broadcast::Sender<()>,
        config_update_tx: broadcast::Sender<()>,
    ) -> Self {
        Self {
            inner: Arc::new(RwLock::new(AppStateInner {
                sources,
                config_update_tx,
            })),
            config_manager,
            update_tx,
        }
    }

    pub async fn get_sources(&self) -> Vec<Source> {
        self.inner.read().await.sources.clone()
    }

    pub async fn update_sources(&self, sources: Vec<Source>) {
        let mut inner = self.inner.write().await;
        inner.sources = sources;
    }

    pub async fn config_manager(&self) -> Arc<ConfigManager> {
        self.config_manager.clone()
    }
}

pub struct ConfigManager {
    config_path: PathBuf,
}

#[derive(Serialize)]
pub struct ConfigResponse {
    pub sources: Vec<SourceConfig>,
    pub port: u16,
}

impl ConfigManager {
    pub fn new(config_path: PathBuf) -> Self {
        Self { config_path }
    }

    pub fn load_sources(&self) -> Result<Vec<Source>, anyhow::Error> {
        let config = Config::load(&self.config_path)?;
        let default_path = PathBuf::from(".");
        let base_path = self.config_path.parent().unwrap_or(&default_path);
        Ok(config.resolve_sources(base_path))
    }

    pub fn get_config_response(&self) -> Result<ConfigResponse, anyhow::Error> {
        let config = Config::load(&self.config_path)?;
        Ok(ConfigResponse {
            sources: config.sources,
            port: config.port,
        })
    }

    /// Validates sources and returns (valid_sources, warnings).
    /// Invalid sources are filtered out with warnings instead of failing the entire request.
    pub fn validate_sources(&self, sources: &[SourceConfig]) -> (Vec<SourceConfig>, Vec<String>) {
        let default_path = PathBuf::from(".");
        let base_path = self.config_path.parent().unwrap_or(&default_path);

        let mut valid = Vec::new();
        let mut warnings = Vec::new();

        for source in sources {
            let path = if source.path.starts_with("./") || source.path.starts_with("../") {
                base_path.join(&source.path)
            } else {
                PathBuf::from(&source.path)
            };

            if !path.exists() {
                warnings.push(format!("Skipping '{}': path does not exist: {}", source.name, source.path));
                continue;
            }
            if !path.is_dir() {
                warnings.push(format!("Skipping '{}': path is not a directory: {}", source.name, source.path));
                continue;
            }
            valid.push(source.clone());
        }

        (valid, warnings)
    }

    pub fn save_sources(&self, sources: &[SourceConfig]) -> Result<(), anyhow::Error> {
        // Load existing config to preserve other fields (like port)
        let mut config = Config::load(&self.config_path)?;
        config.sources = sources.to_vec();

        let content = serde_json::to_string_pretty(&config)?;
        std::fs::write(&self.config_path, content)?;
        Ok(())
    }
}

