use crate::config::{resolve_path, resolve_sources, Config, Source, SourceConfig};
use serde::Serialize;
use std::{
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicU16, Ordering},
        Arc, Mutex,
    },
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

/// Where the list of sources comes from.
#[derive(Debug, Clone, PartialEq)]
pub enum Mode {
    /// An explicit config file. Edits from the UI are written back to it.
    File { path: PathBuf },
    /// Found by scanning folders. Edits from the UI live in memory only, so a
    /// zero-config run never writes files the user did not ask for.
    Discovered { roots: Vec<PathBuf> },
}

pub struct ConfigManager {
    mode: Mode,
    /// The current list in `Discovered` mode (unused in `File` mode).
    session_sources: Mutex<Vec<SourceConfig>>,
    /// The port actually bound, set once the server is listening.
    port: AtomicU16,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigResponse {
    pub sources: Vec<SourceConfig>,
    /// The port the server is listening on.
    pub port: u16,
    /// `"file"` or `"discovered"`.
    pub mode: &'static str,
    /// The config file edits are saved to (`file` mode only).
    pub config_path: Option<String>,
    /// Folders that were scanned (`discovered` mode only).
    pub roots: Vec<String>,
    /// Whether edits survive a restart.
    pub persistent: bool,
    /// Whether this client may change the sources: only a browser on the
    /// machine the server runs on may (set per request by the handler).
    pub sources_editable: bool,
}

impl ConfigManager {
    pub fn from_file(config_path: PathBuf) -> Self {
        Self {
            mode: Mode::File { path: config_path },
            session_sources: Mutex::new(Vec::new()),
            port: AtomicU16::new(0),
        }
    }

    pub fn discovered(roots: Vec<PathBuf>, sources: Vec<SourceConfig>) -> Self {
        Self {
            mode: Mode::Discovered { roots },
            session_sources: Mutex::new(sources),
            port: AtomicU16::new(0),
        }
    }

    pub fn set_port(&self, port: u16) {
        self.port.store(port, Ordering::Relaxed);
    }

    /// Relative source paths resolve against this folder.
    fn base_path(&self) -> PathBuf {
        match &self.mode {
            Mode::File { path } => path
                .parent()
                .filter(|p| !p.as_os_str().is_empty())
                .map(Path::to_path_buf)
                .unwrap_or_else(|| PathBuf::from(".")),
            Mode::Discovered { .. } => PathBuf::from("."),
        }
    }

    fn current_sources(&self) -> Result<Vec<SourceConfig>, anyhow::Error> {
        match &self.mode {
            Mode::File { path } => Ok(Config::load(path)?.sources),
            Mode::Discovered { .. } => Ok(self.session_sources.lock().unwrap().clone()),
        }
    }

    pub fn load_sources(&self) -> Result<Vec<Source>, anyhow::Error> {
        Ok(resolve_sources(&self.current_sources()?, &self.base_path()))
    }

    pub fn get_config_response(&self) -> Result<ConfigResponse, anyhow::Error> {
        let sources = self.current_sources()?;
        let port = self.port.load(Ordering::Relaxed);
        Ok(match &self.mode {
            Mode::File { path } => ConfigResponse {
                sources,
                port,
                mode: "file",
                config_path: Some(path.display().to_string()),
                roots: Vec::new(),
                persistent: true,
                sources_editable: true,
            },
            Mode::Discovered { roots } => ConfigResponse {
                sources,
                port,
                mode: "discovered",
                config_path: None,
                roots: roots.iter().map(|r| r.display().to_string()).collect(),
                persistent: false,
                sources_editable: true,
            },
        })
    }

    /// Validates sources and returns (valid_sources, warnings).
    /// Invalid sources are filtered out with warnings instead of failing the entire request.
    /// A repo folder that contains `openspec/` is accepted and pointed at that folder.
    pub fn validate_sources(&self, sources: &[SourceConfig]) -> (Vec<SourceConfig>, Vec<String>) {
        let base_path = self.base_path();

        let mut valid = Vec::new();
        let mut warnings = Vec::new();

        for source in sources {
            let path = resolve_path(&source.path, &base_path);

            if !path.exists() {
                warnings.push(format!("Skipping '{}': path does not exist: {}", source.name, source.path));
                continue;
            }
            if !path.is_dir() {
                warnings.push(format!("Skipping '{}': path is not a directory: {}", source.name, source.path));
                continue;
            }
            let looks_like_openspec = path.join("changes").is_dir() || path.join("specs").is_dir();
            let mut source = source.clone();
            if !looks_like_openspec && path.join("openspec").is_dir() {
                source.path = format!("{}/openspec", source.path.trim_end_matches(['/', '\\']));
            }
            valid.push(source);
        }

        (valid, warnings)
    }

    pub fn save_sources(&self, sources: &[SourceConfig]) -> Result<(), anyhow::Error> {
        match &self.mode {
            Mode::File { path } => {
                // Load existing config to preserve other fields (like port)
                let mut config = Config::load(path)?;
                config.sources = sources.to_vec();
                let content = serde_json::to_string_pretty(&config)?;
                std::fs::write(path, content)?;
            }
            Mode::Discovered { .. } => {
                *self.session_sources.lock().unwrap() = sources.to_vec();
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn src(name: &str, path: &Path) -> SourceConfig {
        SourceConfig {
            name: name.into(),
            path: path.display().to_string(),
        }
    }

    #[test]
    fn discovered_mode_keeps_edits_in_memory() {
        let tmp = tempfile::tempdir().unwrap();
        let a = tmp.path().join("a/openspec");
        fs::create_dir_all(a.join("changes")).unwrap();
        let cm = ConfigManager::discovered(vec![tmp.path().into()], vec![src("a", &a)]);
        cm.save_sources(&[]).unwrap();
        assert!(cm.load_sources().unwrap().is_empty());
        let resp = cm.get_config_response().unwrap();
        assert_eq!(resp.mode, "discovered");
        assert!(!resp.persistent);
        // nothing was written into the scanned folder
        let entries: Vec<_> = fs::read_dir(tmp.path()).unwrap().collect();
        assert_eq!(entries.len(), 1);
    }

    #[test]
    fn file_mode_writes_back_and_keeps_port() {
        let tmp = tempfile::tempdir().unwrap();
        let file = tmp.path().join("openspec-ui.json");
        fs::write(&file, r#"{"sources":[],"port":4100}"#).unwrap();
        let repo = tmp.path().join("api");
        fs::create_dir_all(repo.join("openspec/specs")).unwrap();

        let cm = ConfigManager::from_file(file.clone());
        let (valid, warnings) = cm.validate_sources(&[src("api", &repo), src("gone", &tmp.path().join("nope"))]);
        assert_eq!(warnings.len(), 1);
        // a repo folder is pointed at its openspec/ dir
        assert!(valid[0].path.ends_with("api/openspec"));
        cm.save_sources(&valid).unwrap();

        let written: Config = serde_json::from_str(&fs::read_to_string(&file).unwrap()).unwrap();
        assert_eq!(written.port, Some(4100));
        assert_eq!(written.sources.len(), 1);
        assert_eq!(cm.get_config_response().unwrap().mode, "file");
    }
}
