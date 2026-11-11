mod cli;
mod config;
mod config_manager;
mod discovery;
mod parser;
mod startup;

use axum::{
    extract::{Path, Request, State},
    http::{header, HeaderMap, Method, StatusCode, Uri},
    middleware::{self, Next},
    response::{sse::Event, IntoResponse, Json, Response, Sse},
    routing::{delete, get, put},
    Router,
};
use clap::Parser as ClapParser;
use cli::{Args, SourceChoice};
use config::SourceConfig;
use config_manager::{AppState, ConfigManager, ConfigResponse, Mode};
use futures::stream::{self, Stream};
use notify::{EventKind, RecursiveMode, Watcher};
use notify_debouncer_full::{new_debouncer, DebouncedEvent, FileIdMap};
use parser::{Change, ChangeDetail, Idea, Spec, SpecDetail};
use rust_embed::RustEmbed;
use serde::{Deserialize, Serialize};
use startup::{Bound, Info, InfoSource, Scope};
use std::{
    convert::Infallible,
    env,
    io::{IsTerminal, Write},
    net::IpAddr,
    path::PathBuf,
    process::ExitCode,
    sync::Arc,
    time::Duration,
};
use tokio::sync::broadcast;
use tower_http::{
    cors::{Any, CorsLayer},
    services::ServeDir,
};
use tower_http::cors::AllowOrigin;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

#[derive(RustEmbed)]
#[folder = "../frontend/dist"]
struct Assets;

// AppState is now defined in config_manager module

// === Response Types ===

#[derive(Serialize)]
struct SourceResponse {
    id: String,
    name: String,
    path: String,
    valid: bool,
    /// Where this source's planning lives (local, store checkout, or a
    /// pointer to an OpenSpec store elsewhere on the machine).
    planning: Option<parser::PlanningRoot>,
}

#[derive(Serialize)]
struct SourcesResponse {
    sources: Vec<SourceResponse>,
}

#[derive(Deserialize)]
struct UpdateSourcesRequest {
    sources: Vec<SourceConfig>,
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

#[derive(Serialize)]
struct ChangesResponse {
    changes: Vec<Change>,
}

#[derive(Serialize)]
struct SpecsResponse {
    specs: Vec<Spec>,
}

#[derive(Serialize)]
struct IdeasResponse {
    ideas: Vec<Idea>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateIdeaRequest {
    title: String,
    description: String,
    #[serde(default)]
    source_id: Option<String>,
}

#[derive(Deserialize)]
struct UpdateIdeaRequest {
    title: String,
    description: String,
}

// === Handlers ===

async fn health() -> &'static str {
    "ok"
}

async fn get_sources(State(state): State<AppState>) -> Json<SourcesResponse> {
    let sources = state.get_sources().await;
    let response = sources
        .iter()
        .map(|s| SourceResponse {
            id: s.id.clone(),
            name: s.name.clone(),
            path: s.path.display().to_string(),
            valid: s.valid,
            planning: s
                .valid
                .then(|| parser::inspect_planning_root(&s.path, &parser::ScanOptions::default())),
        })
        .collect();
    Json(SourcesResponse { sources: response })
}

async fn get_changes(State(state): State<AppState>) -> Json<ChangesResponse> {
    let mut all_changes = Vec::new();
    let sources = state.get_sources().await;

    for source in sources.iter().filter(|s| s.valid) {
        let changes = parser::scan_changes(&source.path, &source.id);
        all_changes.extend(changes);
    }

    Json(ChangesResponse { changes: all_changes })
}

async fn get_change_detail(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ChangeDetail>, StatusCode> {
    // id format: source_id/change_name
    let parts: Vec<&str> = id.splitn(2, '/').collect();
    if parts.len() != 2 {
        return Err(StatusCode::BAD_REQUEST);
    }

    let source_id = parts[0];
    let change_name = parts[1];

    let sources = state.get_sources().await;
    let source = sources
        .iter()
        .find(|s| s.id == source_id && s.valid)
        .ok_or(StatusCode::NOT_FOUND)?;

    parser::get_change_detail(&source.path, source_id, change_name)
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

async fn get_specs(State(state): State<AppState>) -> Json<SpecsResponse> {
    let mut all_specs = Vec::new();
    let sources = state.get_sources().await;

    for source in sources.iter().filter(|s| s.valid) {
        let specs = parser::scan_specs(&source.path, &source.id);
        all_specs.extend(specs);
    }

    Json(SpecsResponse { specs: all_specs })
}

async fn get_spec_detail(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<SpecDetail>, StatusCode> {
    // id format: source_id/spec_path (e.g., "brain-gate/chat" or full path)
    let parts: Vec<&str> = id.splitn(2, '/').collect();
    if parts.len() != 2 {
        return Err(StatusCode::BAD_REQUEST);
    }

    let source_id = parts[0];
    let spec_name = parts[1];

    let sources = state.get_sources().await;
    let source = sources
        .iter()
        .find(|s| s.id == source_id && s.valid)
        .ok_or(StatusCode::NOT_FOUND)?;

    // Try different path formats
    let spec_paths = [
        format!("{}/spec.md", spec_name),
        format!("{}.md", spec_name),
        spec_name.to_string(),
    ];

    for spec_path in &spec_paths {
        if let Some(detail) = parser::get_spec_detail(&source.path, source_id, spec_path) {
            return Ok(Json(detail));
        }
    }

    Err(StatusCode::NOT_FOUND)
}

async fn get_ideas(State(state): State<AppState>) -> Json<IdeasResponse> {
    let mut all_ideas = Vec::new();
    let sources = state.get_sources().await;

    for source in sources.iter().filter(|s| s.valid) {
        let ideas = parser::scan_ideas(&source.path, &source.id);
        all_ideas.extend(ideas);
    }

    Json(IdeasResponse { ideas: all_ideas })
}

async fn create_idea(
    State(state): State<AppState>,
    Json(req): Json<CreateIdeaRequest>,
) -> Result<Json<Idea>, (StatusCode, Json<ErrorResponse>)> {
    // Find target source
    let sources = state.get_sources().await;
    let source = if let Some(source_id) = &req.source_id {
        sources
            .iter()
            .find(|s| s.id == *source_id && s.valid)
            .ok_or_else(|| (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: format!("Source '{}' not found", source_id),
                }),
            ))?
    } else {
        // Default to first valid source if none specified
        sources
            .iter()
            .find(|s| s.valid)
            .ok_or_else(|| (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "No valid source configured".to_string(),
                }),
            ))?
    };

    let id = format!("idea-{}", chrono::Utc::now().timestamp_millis());
    let idea = parser::save_idea(
        &source.path,
        &source.id,
        &id,
        &req.title,
        &req.description,
        None
    )
        .map_err(|e| (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Failed to save idea: {}", e),
            }),
        ))?;

    let _ = state.update_tx.send(());

    Ok(Json(idea))
}

async fn delete_idea(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let parts: Vec<&str> = id.splitn(2, '/').collect();
    if parts.len() != 2 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Invalid idea ID format".to_string(),
            }),
        ));
    }

    let source_id = parts[0];
    let idea_id = parts[1];

    let sources = state.get_sources().await;
    let source = sources
        .iter()
        .find(|s| s.id == source_id && s.valid)
        .ok_or_else(|| (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "Source not found".to_string(),
            }),
        ))?;

    parser::delete_idea(&source.path, idea_id)
        .map_err(|e| (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Failed to delete idea: {}", e),
            }),
        ))?;

    let _ = state.update_tx.send(());

    Ok(StatusCode::OK)
}

async fn update_idea(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<UpdateIdeaRequest>,
) -> Result<Json<Idea>, (StatusCode, Json<ErrorResponse>)> {
    let parts: Vec<&str> = id.splitn(2, '/').collect();
    if parts.len() != 2 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Invalid idea ID format".to_string(),
            }),
        ));
    }

    let source_id = parts[0];
    let idea_id = parts[1];

    let sources = state.get_sources().await;
    let source = sources
        .iter()
        .find(|s| s.id == source_id && s.valid)
        .ok_or_else(|| (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "Source not found".to_string(),
            }),
        ))?;

    let idea = parser::update_idea(&source.path, &source.id, idea_id, &req.title, &req.description)
        .map_err(|e| (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Failed to update idea: {}", e),
            }),
        ))?;

    let _ = state.update_tx.send(());

    Ok(Json(idea))
}

async fn get_config(State(state): State<AppState>) -> Result<Json<ConfigResponse>, StatusCode> {
    let config_manager = state.config_manager().await;
    config_manager
        .get_config_response()
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn update_sources(
    State(state): State<AppState>,
    Json(req): Json<UpdateSourcesRequest>,
) -> Result<Json<ConfigResponse>, (StatusCode, Json<ErrorResponse>)> {
    let config_manager = state.config_manager().await;

    // Validate sources - invalid ones are filtered out with warnings
    let (valid_sources, warnings) = config_manager.validate_sources(&req.sources);

    // Log warnings for filtered sources
    for warning in &warnings {
        tracing::warn!("{}", warning);
    }

    // Save only valid sources to disk
    if let Err(e) = config_manager.save_sources(&valid_sources) {
        tracing::error!("Failed to save config: {}", e);
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Failed to save configuration: {}", e),
            }),
        ));
    }

    // Reload sources and update state
    let new_sources = config_manager
        .load_sources()
        .map_err(|e| {
            tracing::error!("Failed to reload sources: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: format!("Failed to reload sources: {}", e),
                }),
            )
        })?;

    state.update_sources(new_sources).await;

    // Trigger file watcher restart and SSE update
    let inner = state.inner.read().await;
    let _ = inner.config_update_tx.send(());
    drop(inner);
    let _ = state.update_tx.send(());

    // Return updated config
    config_manager
        .get_config_response()
        .map(Json)
        .map_err(|e| {
            tracing::error!("Failed to get config response: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to get updated configuration".to_string(),
                }),
            )
        })
}

async fn sse_handler(
    State(state): State<AppState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let rx = state.update_tx.subscribe();

    let stream = stream::unfold(rx, |mut rx| async move {
        match rx.recv().await {
            Ok(_) | Err(broadcast::error::RecvError::Lagged(_)) => {
                Some((Ok(Event::default().event("update").data("changed")), rx))
            }
            Err(_) => None,
        }
    });

    Sse::new(stream).keep_alive(
        axum::response::sse::KeepAlive::new()
        // Reduce keep-alive interval to 15s to keep connections fresh
            .interval(Duration::from_secs(15))
            .text("keep-alive-text"),
    )
}

async fn static_handler(uri: Uri) -> impl IntoResponse {
    let mut path = uri.path().trim_start_matches('/').to_string();

    if path.is_empty() {
        path = "index.html".to_string();
    }

    match Assets::get(&path) {
        Some(content) => {
            let mime = mime_guess::from_path(&path).first_or_octet_stream();
            ([(header::CONTENT_TYPE, mime.as_ref())], content.data).into_response()
        }
        None => {
            if path.contains('.') {
                return StatusCode::NOT_FOUND.into_response();
            }
            // Serve index.html for SPA routing
            match Assets::get("index.html") {
                Some(content) => {
                    ([(header::CONTENT_TYPE, "text/html")], content.data).into_response()
                }
                None => StatusCode::NOT_FOUND.into_response(),
            }
        }
    }
}

// === Server metadata & request guard ===

async fn get_info(State((state, meta)): State<(AppState, Arc<Info>)>) -> Json<Info> {
    let mut info = (*meta).clone();
    info.sources = info_sources(&state.get_sources().await);
    Json(info)
}

fn info_sources(sources: &[config::Source]) -> Vec<InfoSource> {
    sources
        .iter()
        .map(|s| InfoSource {
            name: s.name.clone(),
            path: s.path.display().to_string(),
            valid: s.valid,
        })
        .collect()
}

struct Guard {
    /// Bound to a loopback address: only answer to localhost names.
    loopback: bool,
    /// Extra origins allowed to write (from CORS_ALLOWED_ORIGINS).
    allowed_origins: Vec<String>,
}

fn is_loopback_host(host: &str) -> bool {
    let name = if let Some(rest) = host.strip_prefix('[') {
        rest.split(']').next().unwrap_or("")
    } else {
        host.rsplit_once(':').map(|(h, _)| h).unwrap_or(host)
    };
    name.eq_ignore_ascii_case("localhost")
        || name.to_ascii_lowercase().ends_with(".localhost")
        || name.parse::<IpAddr>().map(|ip| ip.is_loopback()).unwrap_or(false)
}

/// The API writes files (ideas, config). On loopback, refusing foreign Host
/// names blocks DNS rebinding; refusing cross-origin writes stops other
/// websites from posting to the local server.
fn guard_verdict(guard: &Guard, method: &Method, headers: &HeaderMap) -> Option<&'static str> {
    let host = headers
        .get(header::HOST)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if guard.loopback && !host.is_empty() && !is_loopback_host(host) {
        return Some("openspec-ui only answers to localhost. Start it with --host 0.0.0.0 to allow other addresses.");
    }
    if !matches!(*method, Method::GET | Method::HEAD | Method::OPTIONS) {
        if let Some(origin) = headers.get(header::ORIGIN).and_then(|v| v.to_str().ok()) {
            let same_origin = origin
                .split_once("://")
                .is_some_and(|(_, authority)| authority.eq_ignore_ascii_case(host));
            if !same_origin && !guard.allowed_origins.iter().any(|o| o == origin) {
                return Some("Cross-origin changes are not allowed.");
            }
        }
    }
    None
}

async fn request_guard(State(guard): State<Arc<Guard>>, req: Request, next: Next) -> Response {
    match guard_verdict(&guard, req.method(), req.headers()) {
        Some(reason) => (StatusCode::FORBIDDEN, reason).into_response(),
        None => next.run(req).await,
    }
}

/// CORS: by default only the server's own origins; CORS_ALLOWED_ORIGINS
/// (comma-separated) replaces them. Returns the layer and the configured list.
fn cors_layer(default_origins: &[String]) -> (CorsLayer, Vec<String>) {
    let configured: Vec<String> = env::var("CORS_ALLOWED_ORIGINS")
        .map(|s| {
            s.split(',')
                .map(|o| o.trim().to_string())
                .filter(|o| !o.is_empty())
                .collect()
        })
        .unwrap_or_default();
    let origins = if configured.is_empty() {
        default_origins.to_vec()
    } else {
        tracing::info!("Configured CORS origins: {:?}", configured);
        configured.clone()
    };
    let layer = CorsLayer::new()
        .allow_origin(AllowOrigin::list(
            origins.iter().filter_map(|s| s.parse().ok()).collect::<Vec<_>>(),
        ))
        .allow_methods(Any)
        .allow_headers(Any);
    (layer, configured)
}

// === File watcher ===

fn spawn_watcher(state: AppState, config_update_tx: broadcast::Sender<()>) {
    tokio::spawn(async move {
        // Use full debouncer to get event kinds
        let mut current_watcher: Option<notify_debouncer_full::Debouncer<notify::RecommendedWatcher, FileIdMap>> = None;
        let mut config_rx = config_update_tx.subscribe();
        let mut should_setup = true;

        loop {
            if should_setup {
                let sources = state.get_sources().await;

                // Drop old watcher if it exists
                if let Some(debouncer) = current_watcher.take() {
                    drop(debouncer);
                }

                let update_tx_watcher = state.update_tx.clone();

                // Using notify-debouncer-full to filter Access events
                match new_debouncer(
                    Duration::from_millis(500),
                    None,
                    move |result: Result<Vec<DebouncedEvent>, Vec<notify::Error>>| match result {
                        Ok(events) => {
                            // Access events would cause infinite refresh loops
                            let changed = events
                                .iter()
                                .find(|e| !matches!(e.event.kind, EventKind::Access(_)));
                            if let Some(e) = changed {
                                tracing::info!("File changed: {:?} {:?}", e.event.paths, e.event.kind);
                                let _ = update_tx_watcher.send(());
                            }
                        }
                        Err(errors) => {
                            for e in errors {
                                tracing::warn!("File watcher error: {}", e);
                            }
                        }
                    },
                ) {
                    Ok(mut debouncer) => {
                        for source in sources.iter().filter(|s| s.valid) {
                            if let Err(e) = debouncer.watcher().watch(&source.path, RecursiveMode::Recursive) {
                                tracing::warn!("Failed to watch source {:?}: {}", source.path, e);
                            } else {
                                tracing::info!("Watching source: {:?}", source.path);
                            }
                        }
                        current_watcher = Some(debouncer);
                    }
                    Err(e) => {
                        tracing::error!("Failed to create file watcher: {}", e);
                    }
                }
                should_setup = false;
            }

            // Wait for config update signal
            if config_rx.recv().await.is_ok() {
                tracing::info!("File watcher: configuration updated, restarting watcher...");
                should_setup = true;
            }
        }
    });
}

// === Startup ===

#[tokio::main]
async fn main() -> ExitCode {
    let args = Args::parse();

    // Logs go to stderr; stdout is reserved for the banner / --json line.
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new(cli::log_filter(args.verbose)));
    tracing_subscriber::registry()
        .with(filter)
        .with(tracing_subscriber::fmt::layer().with_writer(std::io::stderr))
        .init();

    match run(args).await {
        Ok(()) => ExitCode::SUCCESS,
        Err(message) => {
            eprintln!("openspec-ui: {message}");
            ExitCode::FAILURE
        }
    }
}

fn print_stdout(text: &str) {
    let mut out = std::io::stdout().lock();
    let _ = out.write_all(text.as_bytes());
    let _ = out.flush();
}

fn maybe_open_browser(args: &Args, url: &str) {
    let tty = std::io::stdout().is_terminal();
    if startup::should_open_browser(args.no_open, args.json, tty, |k| env::var(k).ok(), startup::in_container()) {
        startup::open_browser(url);
    }
}

async fn run(args: Args) -> Result<(), String> {
    let cwd = env::current_dir().map_err(|e| format!("Cannot read the current folder: {e}"))?;
    let env_config = env::var("OPENSPEC_UI_CONFIG").ok();
    let choice = cli::choose_sources(args.config.as_deref(), &args.paths, env_config.as_deref(), &cwd);
    let ip = startup::parse_host(&args.host)?;

    // Check inputs before touching the network: a wrong explicit config or
    // path is an error, never a silent fall-back to scanning.
    let (mode, config_port) = match &choice {
        SourceChoice::ConfigFile { path, origin } => {
            let abs = path.canonicalize().map_err(|_| {
                format!("Config file not found: {} (from {})", path.display(), origin.describe())
            })?;
            let config = config::Config::load(&abs).map_err(|e| format!("{}: {e}", abs.display()))?;
            (Mode::File { path: abs }, config.port)
        }
        SourceChoice::Discover { roots } => {
            let mut canonical: Vec<PathBuf> = Vec::new();
            for root in roots {
                let c = root
                    .canonicalize()
                    .map_err(|_| format!("Folder not found: {}", root.display()))?;
                if !c.is_dir() {
                    return Err(format!("Not a folder: {}", root.display()));
                }
                if !canonical.contains(&c) {
                    canonical.push(c);
                }
            }
            (Mode::Discovered { roots: canonical }, None)
        }
    };

    let (mode_name, config_path, roots) = match &mode {
        Mode::File { path } => ("file", Some(path.display().to_string()), Vec::new()),
        Mode::Discovered { roots } => (
            "discovered",
            None,
            roots.iter().map(|r| r.display().to_string()).collect::<Vec<_>>(),
        ),
    };
    let scope = Scope {
        host: ip.to_string(),
        mode: mode_name.to_string(),
        config_path: config_path.clone(),
        roots: roots.clone(),
    };

    let (port, port_origin) = cli::choose_port(args.port, config_port);
    let requested_by = port_origin.map(|o| match o {
        cli::PortOrigin::FlagOrEnv => "--port or the PORT variable".to_string(),
        cli::PortOrigin::ConfigFile => format!(
            "\"port\" in {}",
            config_path.as_deref().unwrap_or(cli::CONFIG_FILE_NAME)
        ),
    });
    let (listener, skipped_ports) = match startup::bind(ip, port, requested_by.as_deref(), &scope).await? {
        Bound::Reused(mut info) => {
            info.reused = true;
            if args.json {
                print_stdout(&format!("{}\n", serde_json::to_string(&info).unwrap_or_default()));
            } else {
                print_stdout(&startup::banner(&startup::BannerContext {
                    info: &info,
                    base: None,
                    origin: String::new(),
                    skipped_ports: &[],
                    lan_url: info.lan_url.clone(),
                    empty_hint: false,
                    notes: vec![],
                }));
            }
            maybe_open_browser(&args, &info.url);
            return Ok(());
        }
        Bound::Listening { listener, skipped } => (listener, skipped),
    };
    let port = listener
        .local_addr()
        .map_err(|e| format!("Cannot read the listening address: {e}"))?
        .port();
    let url = startup::local_url(ip, port);

    // Build the source list. Scanning happens after binding so that a reused
    // server answers instantly.
    let mut notes = Vec::new();
    let (config_manager, origin) = match &mode {
        Mode::File { path } => {
            notes.push(format!("Edits in Settings are saved to {}.", path.display()));
            (ConfigManager::from_file(path.clone()), format!("listed in {}", path.display()))
        }
        Mode::Discovered { roots: dirs } => {
            let found = discovery::discover(dirs, args.depth);
            tracing::info!(
                "discovery: {} sources, {} folders read, {} worktrees skipped, {:?}",
                found.sources.len(),
                found.dirs_visited,
                found.worktrees_skipped,
                found.elapsed
            );
            let folders = if found.dirs_visited == 1 { "folder" } else { "folders" };
            let home = startup::home_dir();
            let shown_roots: Vec<String> = roots
                .iter()
                .map(|r| startup::display_path(r, None, home.as_deref()))
                .collect();
            let origin = if found.dirs_visited == 0 {
                // every PATH was a repo or an openspec folder: nothing to search
                format!("in {}", shown_roots.join(", "))
            } else {
                format!(
                    "found in {} (searched {} {folders} in {} ms)",
                    shown_roots.join(", "),
                    found.dirs_visited,
                    found.elapsed.as_millis()
                )
            };
            if found.truncated {
                notes.push(format!(
                    "Search stopped after {} folders. Point openspec-ui at a narrower folder.",
                    discovery::MAX_DIRS
                ));
            }
            if found.worktrees_skipped > 0 {
                notes.push(format!(
                    "Skipped {} linked git worktree(s); pass one as a PATH to include it.",
                    found.worktrees_skipped
                ));
            }
            notes.push("Edits in Settings last until you stop the server; nothing is written to disk.".to_string());
            (ConfigManager::discovered(dirs.clone(), found.sources), origin)
        }
    };
    let config_manager = Arc::new(config_manager);
    config_manager.set_port(port);
    let sources = config_manager
        .load_sources()
        .map_err(|e| format!("Failed to load sources: {e}"))?;

    // Broadcast channels for SSE updates and watcher restarts
    let (update_tx, _) = broadcast::channel::<()>(16);
    let (config_update_tx, _) = broadcast::channel::<()>(16);
    let state = AppState::new(sources.clone(), config_manager.clone(), update_tx.clone(), config_update_tx.clone());
    spawn_watcher(state.clone(), config_update_tx);

    // Inside a container the address is the container's, not the host's.
    let lan_url = (ip.is_unspecified() && !startup::in_container())
        .then(startup::lan_ip)
        .flatten()
        .map(|lan| startup::local_url(lan, port));

    let info = Info {
        name: startup::APP_NAME.to_string(),
        version: cli::VERSION.to_string(),
        url: url.clone(),
        host: ip.to_string(),
        port,
        pid: std::process::id(),
        mode: mode_name.to_string(),
        config_path,
        roots,
        sources: Vec::new(),
        changelog: cli::CHANGELOG_URL.to_string(),
        lan_url: lan_url.clone(),
        reused: false,
    };
    let meta = Arc::new(info.clone());

    let local_origins = vec![url.clone(), format!("http://localhost:{port}")];
    let (cors, allowed_origins) = cors_layer(&local_origins);
    let guard = Arc::new(Guard {
        loopback: ip.is_loopback(),
        allowed_origins,
    });

    let api = Router::new()
        .route("/api/health", get(health))
        .route("/api/config", get(get_config))
        .route("/api/config/sources", put(update_sources))
        .route("/api/sources", get(get_sources))
        .route("/api/changes", get(get_changes))
        .route("/api/changes/{id}", get(get_change_detail))
        .route("/api/specs", get(get_specs))
        .route("/api/specs/{id}", get(get_spec_detail))
        .route("/api/ideas", get(get_ideas).post(create_idea))
        .route("/api/ideas/{id}", delete(delete_idea).put(update_idea))
        .route("/api/events", get(sse_handler))
        .with_state(state.clone())
        .merge(
            Router::new()
                .route("/api/info", get(get_info))
                .with_state((state, meta)),
        );

    // If FRONTEND_DIR is set, serve it (dev mode), otherwise use embedded assets
    let app = if let Ok(frontend_dir) = env::var("FRONTEND_DIR") {
        tracing::info!("Serving frontend from local directory: {}", frontend_dir);
        api.fallback_service(ServeDir::new(frontend_dir))
    } else {
        api.fallback(static_handler)
    };
    let app = app
        .layer(cors)
        .layer(middleware::from_fn_with_state(guard, request_guard));

    // Announce
    let mut announced = info;
    announced.sources = info_sources(&sources);
    if args.json {
        print_stdout(&format!("{}\n", serde_json::to_string(&announced).unwrap_or_default()));
    } else {
        // With one searched folder, list projects relative to it.
        let base = match announced.roots.as_slice() {
            [single] => Some(single.clone()),
            _ => None,
        };
        print_stdout(&startup::banner(&startup::BannerContext {
            info: &announced,
            base,
            origin,
            skipped_ports: &skipped_ports,
            lan_url,
            empty_hint: matches!(mode, Mode::Discovered { .. }),
            notes,
        }));
    }
    maybe_open_browser(&args, &url);

    axum::serve(listener, app)
        .await
        .map_err(|e| format!("Server stopped: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    fn headers(host: &str, origin: Option<&str>) -> HeaderMap {
        let mut h = HeaderMap::new();
        h.insert(header::HOST, HeaderValue::from_str(host).unwrap());
        if let Some(o) = origin {
            h.insert(header::ORIGIN, HeaderValue::from_str(o).unwrap());
        }
        h
    }

    #[test]
    fn loopback_server_rejects_foreign_host_names() {
        let g = Guard { loopback: true, allowed_origins: vec![] };
        assert!(guard_verdict(&g, &Method::GET, &headers("127.0.0.1:3000", None)).is_none());
        assert!(guard_verdict(&g, &Method::GET, &headers("localhost:3000", None)).is_none());
        assert!(guard_verdict(&g, &Method::GET, &headers("[::1]:3000", None)).is_none());
        assert!(guard_verdict(&g, &Method::GET, &headers("evil.example:3000", None)).is_some());

        let lan = Guard { loopback: false, allowed_origins: vec![] };
        assert!(guard_verdict(&lan, &Method::GET, &headers("my-laptop.local:3000", None)).is_none());
    }

    #[test]
    fn cross_origin_writes_are_rejected() {
        let g = Guard { loopback: true, allowed_origins: vec!["http://localhost:5173".into()] };
        let post = Method::POST;
        let same = headers("127.0.0.1:3000", Some("http://127.0.0.1:3000"));
        assert!(guard_verdict(&g, &post, &same).is_none());
        // curl and scripts send no Origin
        assert!(guard_verdict(&g, &post, &headers("127.0.0.1:3000", None)).is_none());
        let evil = headers("127.0.0.1:3000", Some("https://evil.example"));
        assert!(guard_verdict(&g, &post, &evil).is_some());
        let dev = headers("127.0.0.1:3000", Some("http://localhost:5173"));
        assert!(guard_verdict(&g, &post, &dev).is_none());
        // reads stay open (CORS still keeps the response from other sites)
        assert!(guard_verdict(&g, &Method::GET, &evil).is_none());
    }
}

