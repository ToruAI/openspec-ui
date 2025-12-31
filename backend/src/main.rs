mod config;
mod config_manager;
mod parser;

use axum::{
    extract::{Path, State},
    http::{header, StatusCode, Uri},
    response::{sse::Event, IntoResponse, Json, Sse},
    routing::{get, put},
    Router,
};
use clap::Parser as ClapParser;
use config::SourceConfig;
use config_manager::{AppState, ConfigManager, ConfigResponse};
use futures::stream::{self, Stream};
use notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, DebouncedEvent};
use parser::{Change, ChangeDetail, Spec, SpecDetail};
use rust_embed::RustEmbed;
use serde::{Deserialize, Serialize};
use std::{
    convert::Infallible,
    env,
    net::SocketAddr,
    path::PathBuf,
    sync::Arc,
    time::Duration,
};
use tokio::sync::broadcast;
use tower_http::{
    cors::{Any, CorsLayer},
    services::ServeDir,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[derive(RustEmbed)]
#[folder = "../frontend/dist"]
struct Assets;

#[derive(ClapParser, Debug)]
#[command(name = "openspec-ui")]
#[command(about = "A read-only dashboard for OpenSpec")]
struct Args {
    /// Path to config file
    #[arg(short, long)]
    config: Option<PathBuf>,
}

// AppState is now defined in config_manager module

// === Response Types ===

#[derive(Serialize)]
struct SourceResponse {
    id: String,
    name: String,
    path: String,
    valid: bool,
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

    // Validate sources
    if let Err(err) = config_manager.validate_sources(&req.sources) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse { error: err }),
        ));
    }

    // Save to disk
    if let Err(e) = config_manager.save_sources(&req.sources) {
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
                Some((Ok(Event::default().data("update")), rx))
            }
            Err(_) => None,
        }
    });

    Sse::new(stream).keep_alive(
        axum::response::sse::KeepAlive::new()
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

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .init();

    let args = Args::parse();

    // Determine config path
    let config_path = args
        .config
        .or_else(|| env::var("OPENSPEC_UI_CONFIG").ok().map(PathBuf::from))
        .unwrap_or_else(|| PathBuf::from("openspec-ui.json"));

    if !config_path.exists() {
        tracing::error!("Config file not found: {:?}", config_path);
        std::process::exit(1);
    }

    // Create config manager
    let config_manager = Arc::new(ConfigManager::new(config_path.clone()));

    // Load initial sources
    let sources = match config_manager.load_sources() {
        Ok(s) => s,
        Err(e) => {
            tracing::error!("Failed to load sources: {}", e);
            std::process::exit(1);
        }
    };

    tracing::info!("Loaded {} sources", sources.len());
    for source in &sources {
        tracing::info!(
            "  {} @ {:?} (valid: {})",
            source.name,
            source.path,
            source.valid
        );
    }

    // Create broadcast channel for SSE updates
    let (update_tx, _) = broadcast::channel::<()>(16);

    // Create a separate channel for watcher restarts (config changes)
    let (config_update_tx, _) = broadcast::channel::<()>(16);
    let config_update_tx_for_watcher = config_update_tx.clone();

    // Create app state
    let state = AppState::new(sources.clone(), config_manager.clone(), update_tx.clone(), config_update_tx.clone());

    // Setup file watcher with dynamic update support
    let state_for_watcher = state.clone();
    tokio::spawn(async move {
        let mut current_watcher: Option<notify_debouncer_mini::Debouncer<notify::RecommendedWatcher>> = None;
        let mut config_rx = config_update_tx_for_watcher.subscribe();

        // Initial setup
        let mut should_setup = true;

        loop {
            if should_setup {
                // Get current sources
                let sources = state_for_watcher.get_sources().await;

                // Drop old watcher if it exists
                if let Some(debouncer) = current_watcher.take() {
                    drop(debouncer);
                }

                // Create new watcher
                let update_tx_watcher = state_for_watcher.update_tx.clone();
                match new_debouncer(
                    Duration::from_millis(500),
                    move |result: Result<Vec<DebouncedEvent>, notify::Error>| {
                        match result {
                            Ok(_) => {
                                let _ = update_tx_watcher.send(());
                            }
                            Err(e) => {
                                tracing::warn!("File watcher error: {}", e);
                            }
                        }
                    },
                ) {
                    Ok(mut debouncer) => {
                        // Watch all valid source directories
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

    // Determine port
    let config_response = config_manager.get_config_response().unwrap_or(ConfigResponse {
        sources: vec![],
        port: 3000,
    });
    
    let port = env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(config_response.port);

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let mut app = Router::new()
        .route("/api/health", get(health))
        .route("/api/config", get(get_config))
        .route("/api/config/sources", put(update_sources))
        .route("/api/sources", get(get_sources))
        .route("/api/changes", get(get_changes))
        .route("/api/changes/{id}", get(get_change_detail))
        .route("/api/specs", get(get_specs))
        .route("/api/specs/{id}", get(get_spec_detail))
        .route("/api/events", get(sse_handler))
        .layer(cors)
        .with_state(state);

    // If FRONTEND_DIR is set, use ServeDir (dev mode), otherwise use embedded assets
    if let Ok(frontend_dir) = env::var("FRONTEND_DIR") {
        tracing::info!("Serving frontend from local directory: {}", frontend_dir);
        let serve_dir = ServeDir::new(frontend_dir);
        app = app.nest_service("/", serve_dir.clone()).fallback_service(serve_dir);
    } else {
        tracing::info!("Serving embedded frontend assets");
        app = app.fallback(static_handler);
    }

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("Starting server on http://localhost:{}", port);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
