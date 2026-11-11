//! How OpenSpec decides the state of a change, reimplemented from files on disk.
//!
//! Mirrors OpenSpec 1.17 (`src/core/artifact-graph/*`, `src/utils/change-metadata.ts`,
//! `src/utils/task-progress.ts`, `src/utils/nested-change.ts`):
//!
//! - The workflow schema comes from the change's `.openspec.yaml`, else
//!   `openspec/config.yaml`'s `schema:`, else `spec-driven`. Schemas resolve
//!   project-local (`openspec/schemas/<name>/schema.yaml`) first, then
//!   user-level (`<OpenSpec data dir>/schemas`), then built-in.
//! - An artifact is `done` when its `generates` path (or glob) matches at least
//!   one regular file. Dependencies never stop an artifact from being done;
//!   they only decide whether a missing artifact is `ready` or `blocked`.
//! - `skip_specs: true` marks every not-yet-written artifact that generates under
//!   `specs/` as `skipped`, which also satisfies its dependents.
//! - Tasks are counted in the files of the artifact `apply.tracks` names (or
//!   the artifact with id `tasks`), falling back to `tasks.md`.

use super::contain::Root;
use super::tasks::count_tasks;
use super::{Artifact, ArtifactStatus, TaskStats};
use globset::{GlobBuilder, GlobMatcher};
use serde::Deserialize;
use serde_yaml::Value;
use std::collections::{BTreeSet, HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use walkdir::WalkDir;

pub const DEFAULT_SCHEMA: &str = "spec-driven";
const METADATA_FILE: &str = ".openspec.yaml";

/// Top-level `.openspec.yaml` keys OpenSpec recognises (`CHANGE_METADATA_KNOWN_KEYS`).
const KNOWN_METADATA_KEYS: &[&str] = &[
    "schema",
    "created",
    "goal",
    "affected_areas",
    "initiative",
    "skip_specs",
    "retire_capabilities",
];

/// Built-in schemas shipped inside the OpenSpec npm package.
const BUILTIN_SCHEMAS: &[(&str, &str)] = &[("spec-driven", include_str!("schemas/spec-driven.yaml"))];

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SchemaDef {
    pub name: String,
    pub artifacts: Vec<ArtifactDef>,
    pub apply: Option<ApplyDef>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArtifactDef {
    pub id: String,
    pub generates: String,
    pub requires: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ApplyDef {
    pub requires: Vec<String>,
    pub tracks: Option<String>,
}

#[derive(Deserialize)]
struct RawSchema {
    name: String,
    version: Value,
    #[serde(default)]
    #[allow(dead_code)]
    description: Option<String>,
    artifacts: Vec<RawArtifact>,
    #[serde(default)]
    apply: Option<RawApply>,
}

#[derive(Deserialize)]
struct RawArtifact {
    id: String,
    generates: String,
    #[allow(dead_code)]
    description: String,
    template: String,
    #[serde(default)]
    #[allow(dead_code)]
    instruction: Option<String>,
    #[serde(default)]
    requires: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct RawApply {
    requires: Vec<String>,
    #[serde(default)]
    tracks: Option<String>,
    #[serde(default)]
    #[allow(dead_code)]
    instruction: Option<String>,
}

fn check_relative_path(field: &str, value: &str) -> Result<(), String> {
    let segments: Vec<&str> = value.split(['/', '\\']).collect();
    let is_drive =
        value.len() >= 2 && value.as_bytes()[1] == b':' && value.as_bytes()[0].is_ascii_alphabetic();
    if value.is_empty() {
        return Err(format!("{field} is required"));
    }
    if value.starts_with('/')
        || value.starts_with('\\')
        || is_drive
        || segments.contains(&"..")
        || value.contains('\0')
    {
        return Err(format!(
            "{field} must be a relative path inside its allowed directory"
        ));
    }
    Ok(())
}

/// Parse and validate a `schema.yaml` the way OpenSpec's `parseSchema` does:
/// shape, duplicate ids, dangling `requires`, dangling `apply.requires`, cycles.
pub fn parse_schema(content: &str) -> Result<SchemaDef, String> {
    let raw: RawSchema = serde_yaml::from_str(content).map_err(|e| format!("Invalid schema: {e}"))?;

    if raw.name.is_empty() {
        return Err("Invalid schema: name: Schema name is required".into());
    }
    let version_ok = match &raw.version {
        Value::Number(n) => {
            n.as_u64().is_some_and(|v| v > 0) || n.as_f64().is_some_and(|v| v > 0.0 && v.fract() == 0.0)
        }
        _ => false,
    };
    if !version_ok {
        return Err("Invalid schema: version: Version must be a positive integer".into());
    }
    if raw.artifacts.is_empty() {
        return Err("Invalid schema: artifacts: At least one artifact required".into());
    }
    if raw.artifacts.len() > 1000 {
        return Err("Invalid schema: artifacts: A schema may declare at most 1000 artifacts".into());
    }

    let mut artifacts = Vec::with_capacity(raw.artifacts.len());
    for (index, a) in raw.artifacts.into_iter().enumerate() {
        if a.id.is_empty() {
            return Err(format!(
                "Invalid schema: artifacts.{index}.id: Artifact ID is required"
            ));
        }
        check_relative_path("generates field", &a.generates)
            .and_then(|_| check_relative_path("template field", &a.template))
            .map_err(|e| format!("Invalid schema: artifacts.{index}: {e}"))?;
        artifacts.push(ArtifactDef {
            id: a.id,
            generates: a.generates,
            requires: a.requires.unwrap_or_default(),
        });
    }

    let apply = match raw.apply {
        None => None,
        Some(apply) => {
            if apply.requires.is_empty() {
                return Err("Invalid schema: apply.requires: At least one required artifact".into());
            }
            if let Some(tracks) = &apply.tracks {
                check_relative_path("apply.tracks", tracks).map_err(|e| format!("Invalid schema: {e}"))?;
            }
            Some(ApplyDef {
                requires: apply.requires,
                tracks: apply.tracks,
            })
        }
    };

    let mut seen = HashSet::new();
    for a in &artifacts {
        if !seen.insert(a.id.as_str()) {
            return Err(format!("Duplicate artifact ID: {}", a.id));
        }
    }
    for a in &artifacts {
        for req in &a.requires {
            if !seen.contains(req.as_str()) {
                return Err(format!(
                    "Invalid dependency reference in artifact '{}': '{}' does not exist",
                    a.id, req
                ));
            }
        }
    }
    if let Some(apply) = &apply {
        for req in &apply.requires {
            if !seen.contains(req.as_str()) {
                return Err(format!(
                    "Invalid apply.requires reference: '{req}' does not exist"
                ));
            }
        }
    }
    if let Some(cycle) = find_cycle(&artifacts) {
        return Err(format!("Cyclic dependency detected: {cycle}"));
    }

    Ok(SchemaDef {
        name: raw.name,
        artifacts,
        apply,
    })
}

fn find_cycle(artifacts: &[ArtifactDef]) -> Option<String> {
    let by_id: HashMap<&str, &ArtifactDef> = artifacts.iter().map(|a| (a.id.as_str(), a)).collect();
    // 0 = unvisited, 1 = on stack, 2 = done
    let mut state: HashMap<&str, u8> = HashMap::new();
    let mut stack: Vec<&str> = Vec::new();

    fn visit<'a>(
        id: &'a str,
        by_id: &HashMap<&'a str, &'a ArtifactDef>,
        state: &mut HashMap<&'a str, u8>,
        stack: &mut Vec<&'a str>,
    ) -> Option<String> {
        state.insert(id, 1);
        stack.push(id);
        if let Some(artifact) = by_id.get(id) {
            for dep in &artifact.requires {
                match state.get(dep.as_str()).copied().unwrap_or(0) {
                    0 => {
                        if let Some(cycle) = visit(dep.as_str(), by_id, state, stack) {
                            return Some(cycle);
                        }
                    }
                    1 => {
                        let start = stack.iter().position(|s| *s == dep.as_str()).unwrap_or(0);
                        let mut path: Vec<&str> = stack[start..].to_vec();
                        path.push(dep.as_str());
                        return Some(path.join(" → "));
                    }
                    _ => {}
                }
            }
        }
        stack.pop();
        state.insert(id, 2);
        None
    }

    for a in artifacts {
        if state.get(a.id.as_str()).copied().unwrap_or(0) == 0 {
            if let Some(cycle) = visit(a.id.as_str(), &by_id, &mut state, &mut stack) {
                return Some(cycle);
            }
        }
    }
    None
}

/// The built-in schemas, parsed once.
pub fn builtin_schemas() -> &'static Vec<SchemaDef> {
    static BUILTIN: OnceLock<Vec<SchemaDef>> = OnceLock::new();
    BUILTIN.get_or_init(|| {
        BUILTIN_SCHEMAS
            .iter()
            .map(|(name, yaml)| {
                parse_schema(yaml).unwrap_or_else(|e| panic!("built-in schema {name} is invalid: {e}"))
            })
            .collect()
    })
}

/// Where schemas are looked up for one OpenSpec root.
#[derive(Debug, Clone)]
pub struct SchemaDirs {
    /// `<openspec dir>/schemas`
    project: PathBuf,
    /// `<OpenSpec global data dir>/schemas`
    user: Option<PathBuf>,
}

impl SchemaDirs {
    pub fn new(openspec_dir: &Path, global_data_dir: Option<&Path>) -> Self {
        SchemaDirs {
            project: openspec_dir.join("schemas"),
            user: global_data_dir.map(|d| d.join("schemas")),
        }
    }

    fn valid_name(name: &str) -> bool {
        !(name.is_empty()
            || name == "."
            || name == ".."
            || name.contains('/')
            || name.contains('\\')
            || (name.len() >= 2 && name.as_bytes()[1] == b':'))
    }

    /// `schema.yaml` of a project or user schema with this name, if present.
    fn on_disk(&self, name: &str) -> Option<PathBuf> {
        if !Self::valid_name(name) {
            return None;
        }
        std::iter::once(&self.project)
            .chain(self.user.iter())
            .map(|dir| dir.join(name).join("schema.yaml"))
            .find(|path| path.is_file())
    }

    /// Every schema name OpenSpec would accept in `.openspec.yaml` (`listSchemas`).
    pub fn available(&self) -> BTreeSet<String> {
        let mut names: BTreeSet<String> = builtin_schemas().iter().map(|s| s.name.clone()).collect();
        for dir in std::iter::once(&self.project).chain(self.user.iter()) {
            for entry in std::fs::read_dir(dir).into_iter().flatten().flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                let transient = name.starts_with(".fork-staging-")
                    || name.contains(".fork-backup-")
                    || name.starts_with(".init-staging-")
                    || name.contains(".init-backup-");
                if !transient && entry.path().is_dir() && entry.path().join("schema.yaml").is_file() {
                    names.insert(name);
                }
            }
        }
        names
    }

    /// Resolve and parse a schema by name (`resolveSchema`).
    pub fn resolve(&self, name: &str) -> Result<SchemaDef, String> {
        let name = name
            .strip_suffix(".yaml")
            .or_else(|| name.strip_suffix(".yml"))
            .unwrap_or(name);
        if let Some(path) = self.on_disk(name) {
            let content = std::fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read schema at '{}': {e}", path.display()))?;
            return parse_schema(&content)
                .map_err(|e| format!("Invalid schema at '{}': {e}", path.display()));
        }
        if Self::valid_name(name) {
            if let Some(schema) = builtin_schemas().iter().find(|s| s.name == name) {
                return Ok(schema.clone());
            }
        }
        let available: Vec<String> = self.available().into_iter().collect();
        Err(format!(
            "Schema '{name}' not found. Available schemas: {}",
            available.join(", ")
        ))
    }
}

/// OpenSpec's global data directory (`getGlobalDataDir`): `$XDG_DATA_HOME/openspec`,
/// else `%LOCALAPPDATA%\openspec` on Windows, else `~/.local/share/openspec`.
/// User-level schemas and the store registry live here.
pub fn default_global_data_dir() -> Option<PathBuf> {
    if let Some(xdg) = std::env::var_os("XDG_DATA_HOME").filter(|v| !v.is_empty()) {
        return Some(PathBuf::from(xdg).join("openspec"));
    }
    if cfg!(windows) {
        if let Some(local) = std::env::var_os("LOCALAPPDATA").filter(|v| !v.is_empty()) {
            return Some(PathBuf::from(local).join("openspec"));
        }
    }
    let home = std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" })?;
    let home = PathBuf::from(home);
    Some(if cfg!(windows) {
        home.join("AppData").join("Local").join("openspec")
    } else {
        home.join(".local").join("share").join("openspec")
    })
}

// ---------------------------------------------------------------------------
// Metadata (.openspec.yaml) and project config
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default)]
pub struct ChangeMetadata {
    pub schema: String,
    pub skip_specs: bool,
    pub unknown_keys: Vec<String>,
}

#[derive(Debug, Clone)]
pub enum MetadataRead {
    Absent,
    Valid(ChangeMetadata),
    Invalid(String),
}

fn is_kebab_id(value: &str) -> bool {
    !value.is_empty()
        && value.split('-').all(|part| {
            !part.is_empty() && part.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
        })
}

fn is_iso_date(value: &str) -> bool {
    let b = value.as_bytes();
    b.len() == 10
        && b[4] == b'-'
        && b[7] == b'-'
        && b.iter()
            .enumerate()
            .all(|(i, c)| i == 4 || i == 7 || c.is_ascii_digit())
}

/// Validate `.openspec.yaml` the way OpenSpec's `readChangeMetadata` does. Any
/// failure here makes `openspec status` refuse the change.
pub fn read_metadata(change_dir: &Path, schemas: &SchemaDirs) -> MetadataRead {
    let path = change_dir.join(METADATA_FILE);
    if !path.exists() {
        return MetadataRead::Absent;
    }
    let content = match std::fs::read_to_string(&path) {
        Ok(c) => c,
        Err(e) => return MetadataRead::Invalid(format!("Failed to read {METADATA_FILE}: {e}")),
    };
    let parsed: Value = match serde_yaml::from_str(&content) {
        Ok(v) => v,
        Err(e) => return MetadataRead::Invalid(format!("Invalid YAML in {METADATA_FILE}: {e}")),
    };
    let Value::Mapping(map) = parsed else {
        return MetadataRead::Invalid(format!("Invalid {METADATA_FILE}: expected a mapping of keys"));
    };

    let invalid =
        |key: &str, why: &str| MetadataRead::Invalid(format!("Invalid {METADATA_FILE}: {key} {why}"));
    let get = |key: &str| map.get(Value::String(key.to_string()));

    let schema = match get("schema") {
        Some(Value::String(s)) if !s.is_empty() => s.clone(),
        Some(_) => return invalid("schema", "must be a non-empty string"),
        None => return invalid("schema", "is required"),
    };
    match get("created") {
        None => {}
        Some(Value::String(s)) if is_iso_date(s) => {}
        Some(_) => return invalid("created", "must be YYYY-MM-DD format"),
    }
    match get("goal") {
        None => {}
        Some(Value::String(s)) if !s.is_empty() => {}
        Some(_) => return invalid("goal", "must be a non-empty string"),
    }
    match get("affected_areas") {
        None => {}
        Some(Value::Sequence(items))
            if items
                .iter()
                .all(|i| matches!(i, Value::String(s) if !s.is_empty())) => {}
        Some(_) => return invalid("affected_areas", "must be a list of non-empty strings"),
    }
    match get("initiative") {
        None => {}
        Some(Value::Mapping(m)) => {
            let ok = m.len() == 2
                && ["store", "id"].iter().all(|k| {
                    matches!(m.get(Value::String(k.to_string())), Some(Value::String(s)) if is_kebab_id(s))
                });
            if !ok {
                return invalid("initiative", "must be { store, id } with kebab-case ids");
            }
        }
        Some(_) => return invalid("initiative", "must be { store, id } with kebab-case ids"),
    }
    let mut skip_specs = false;
    for key in ["skip_specs", "retire_capabilities"] {
        match get(key) {
            None => {}
            Some(Value::Bool(b)) => {
                if key == "skip_specs" {
                    skip_specs = *b;
                }
            }
            Some(_) => return invalid(key, "must be true or false"),
        }
    }

    let available = schemas.available();
    if !available.contains(&schema) {
        let list: Vec<String> = available.into_iter().collect();
        return MetadataRead::Invalid(format!(
            "Unknown schema '{schema}'. Available: {}",
            list.join(", ")
        ));
    }

    let mut unknown_keys: Vec<String> = map
        .keys()
        .filter_map(|k| k.as_str())
        .filter(|k| !KNOWN_METADATA_KEYS.contains(k))
        .filter(|k| !(k.len() > 2 && k.starts_with("x-") && !k.chars().any(char::is_whitespace)))
        .map(String::from)
        .collect();
    unknown_keys.sort();

    MetadataRead::Valid(ChangeMetadata {
        schema,
        skip_specs,
        unknown_keys,
    })
}

/// `schema:` from `openspec/config.yaml` (or `.yml`), the project default.
pub fn read_project_default_schema(openspec_dir: &Path) -> Option<String> {
    let path = ["config.yaml", "config.yml"]
        .iter()
        .map(|f| openspec_dir.join(f))
        .find(|p| p.exists())?;
    let parsed: Value = serde_yaml::from_str(&std::fs::read_to_string(path).ok()?).ok()?;
    match parsed.get("schema")? {
        Value::String(s) if !s.is_empty() => Some(s.clone()),
        _ => None,
    }
}

// ---------------------------------------------------------------------------
// Artifact outputs
// ---------------------------------------------------------------------------

fn has_brace_expansion(pattern: &str) -> bool {
    let mut openings = Vec::new();
    for (i, c) in pattern.char_indices() {
        if c == '{' {
            openings.push(i);
        } else if c == '}' {
            if let Some(start) = openings.pop() {
                let body = &pattern[start..i];
                if body.contains(',') || body.contains("..") {
                    return true;
                }
            }
        }
    }
    false
}

fn is_glob(pattern: &str) -> bool {
    pattern.contains('*') || pattern.contains('?') || pattern.contains('[') || has_brace_expansion(pattern)
}

/// Whether an artifact's output lives under the change's `specs/` tree, which
/// is what `skip_specs` skips (`isSpecsArtifactPath`).
pub fn is_specs_path(generates: &str) -> bool {
    let mut parts: Vec<&str> = Vec::new();
    for segment in generates.split(['/', '\\']) {
        match segment {
            "" | "." => {}
            ".." => {
                parts.pop();
            }
            s => parts.push(s),
        }
    }
    parts.first() == Some(&"specs") && (parts.len() > 1 || generates.ends_with('/'))
}

fn compile(pattern: &str) -> Option<GlobMatcher> {
    GlobBuilder::new(&pattern.replace('\\', "/"))
        .literal_separator(true)
        .build()
        .ok()
        .map(|g| g.compile_matcher())
}

/// Files an artifact's `generates` resolves to (`resolveArtifactOutputs`).
/// Regular files only; dot files and dot directories never match a glob.
///
/// Symlinks are followed only while they stay inside `root` (the source's
/// OpenSpec directory): one pointing elsewhere counts as absent, for the
/// board's status and for the content shown alike, and a link to `/` is
/// never walked.
pub fn resolve_outputs(change_dir: &Path, generates: &str, root: &Root) -> Vec<PathBuf> {
    if !is_glob(generates) {
        return root.file(&change_dir.join(generates)).into_iter().collect();
    }
    let Some(matcher) = compile(generates) else {
        return Vec::new();
    };
    if root.contain(change_dir).is_none() {
        return Vec::new();
    }
    let mut matches: Vec<PathBuf> = WalkDir::new(change_dir)
        .follow_links(true)
        .min_depth(1)
        .into_iter()
        .filter_entry(|e| {
            !e.file_name().to_string_lossy().starts_with('.')
                && (!e.path_is_symlink() || root.contain(e.path()).is_some())
        })
        .flatten()
        .filter(|e| e.file_type().is_file())
        .filter(|e| {
            e.path()
                .strip_prefix(change_dir)
                .ok()
                .map(|rel| rel.to_string_lossy().replace('\\', "/"))
                .is_some_and(|rel| matcher.is_match(rel))
        })
        .map(|e| e.into_path())
        .collect();
    matches.sort();
    matches
}

// ---------------------------------------------------------------------------
// Change analysis
// ---------------------------------------------------------------------------

/// Everything the board needs to know about one change's workflow state.
#[derive(Debug, Clone)]
pub struct ChangeAnalysis {
    /// Resolved workflow schema name; `None` when `.openspec.yaml` is unreadable.
    pub schema: Option<String>,
    /// Why `openspec status` would refuse this change, if it would.
    pub error: Option<String>,
    pub warnings: Vec<String>,
    /// In build order, as `openspec status` lists them.
    pub artifacts: Vec<Artifact>,
    pub is_planning_complete: bool,
    pub apply_requires: Vec<String>,
    /// Files tasks are counted in (existing files only).
    pub task_files: Vec<PathBuf>,
    pub task_stats: Option<TaskStats>,
}

/// Topological build order with declaration-order tie-breaks (`getBuildOrder`).
fn build_order(schema: &SchemaDef) -> Vec<String> {
    let position: HashMap<&str, usize> = schema
        .artifacts
        .iter()
        .enumerate()
        .map(|(i, a)| (a.id.as_str(), i))
        .collect();
    let mut in_degree: HashMap<&str, usize> = schema
        .artifacts
        .iter()
        .map(|a| (a.id.as_str(), a.requires.len()))
        .collect();
    let mut dependents: HashMap<&str, Vec<&str>> = HashMap::new();
    for a in &schema.artifacts {
        for req in &a.requires {
            dependents.entry(req.as_str()).or_default().push(a.id.as_str());
        }
    }
    let mut queue: Vec<&str> = schema
        .artifacts
        .iter()
        .map(|a| a.id.as_str())
        .filter(|id| in_degree[id] == 0)
        .collect();
    let mut order = Vec::new();
    while !queue.is_empty() {
        queue.sort_by_key(|id| position[id]);
        let current = queue.remove(0);
        order.push(current.to_string());
        for dep in dependents.get(current).into_iter().flatten() {
            let degree = in_degree.get_mut(dep).expect("known artifact");
            *degree -= 1;
            if *degree == 0 {
                queue.push(dep);
            }
        }
    }
    order
}

/// The artifact whose files hold the tasks (`findTrackedTasksArtifact`).
fn tracked_tasks_generates(schema: &SchemaDef) -> Option<&str> {
    match schema.apply.as_ref().and_then(|a| a.tracks.as_deref()) {
        Some(tracks) => schema.artifacts.iter().find(|a| a.generates == tracks),
        None => schema.artifacts.iter().find(|a| a.id == "tasks"),
    }
    .map(|a| a.generates.as_str())
}

fn count_task_files(files: &[PathBuf]) -> TaskStats {
    let mut stats = TaskStats { total: 0, done: 0 };
    for file in files {
        if let Ok(content) = std::fs::read_to_string(file) {
            let s = count_tasks(&content);
            stats.total += s.total;
            stats.done += s.done;
        }
    }
    stats
}

pub fn analyze_change(change_dir: &Path, openspec_dir: &Path, schemas: &SchemaDirs, root: &Root) -> ChangeAnalysis {
    let metadata = read_metadata(change_dir, schemas);

    let (schema_name, skip_specs, warnings, mut error) = match &metadata {
        MetadataRead::Invalid(e) => (None, false, Vec::new(), Some(e.clone())),
        MetadataRead::Valid(m) => {
            let warnings = if m.unknown_keys.is_empty() {
                Vec::new()
            } else {
                vec![format!(
                    "Unrecognized key(s) in {METADATA_FILE}: {}. OpenSpec ignores them; prefix tool-specific keys with x-.",
                    m.unknown_keys.join(", ")
                )]
            };
            (Some(m.schema.clone()), m.skip_specs, warnings, None)
        }
        MetadataRead::Absent => (
            Some(read_project_default_schema(openspec_dir).unwrap_or_else(|| DEFAULT_SCHEMA.to_string())),
            false,
            Vec::new(),
            None,
        ),
    };

    let schema = match (&schema_name, &error) {
        (Some(name), None) => match schemas.resolve(name) {
            Ok(schema) => Some(schema),
            Err(e) => {
                error = Some(e);
                None
            }
        },
        _ => None,
    };

    // Task files: the tracked artifact's outputs, else a top-level tasks.md.
    let mut task_files = schema
        .as_ref()
        .and_then(tracked_tasks_generates)
        .map(|generates| resolve_outputs(change_dir, generates, root))
        .unwrap_or_default();
    if task_files.is_empty() {
        task_files.extend(root.file(&change_dir.join("tasks.md")));
    }
    let task_stats = (!task_files.is_empty()).then(|| count_task_files(&task_files));

    let Some(schema) = schema else {
        return ChangeAnalysis {
            schema: schema_name,
            error,
            warnings,
            artifacts: Vec::new(),
            is_planning_complete: false,
            apply_requires: Vec::new(),
            task_files,
            task_stats,
        };
    };

    let mut completed: HashSet<&str> = schema
        .artifacts
        .iter()
        .filter(|a| !resolve_outputs(change_dir, &a.generates, root).is_empty())
        .map(|a| a.id.as_str())
        .collect();
    let mut skipped: HashSet<&str> = HashSet::new();
    if skip_specs {
        for a in &schema.artifacts {
            if is_specs_path(&a.generates) && !completed.contains(a.id.as_str()) {
                skipped.insert(a.id.as_str());
            }
        }
        completed.extend(skipped.iter().copied());
    }

    let position: HashMap<&str, usize> = schema
        .artifacts
        .iter()
        .enumerate()
        .map(|(i, a)| (a.id.as_str(), i))
        .collect();
    let by_id: HashMap<&str, &ArtifactDef> = schema.artifacts.iter().map(|a| (a.id.as_str(), a)).collect();

    let artifacts = build_order(&schema)
        .into_iter()
        .map(|id| {
            let def = by_id[id.as_str()];
            let mut missing: Vec<String> = def
                .requires
                .iter()
                .filter(|r| !completed.contains(r.as_str()))
                .cloned()
                .collect();
            missing.sort_by_key(|r| position[r.as_str()]);
            let status = if skipped.contains(id.as_str()) {
                ArtifactStatus::Skipped
            } else if completed.contains(id.as_str()) {
                ArtifactStatus::Done
            } else if missing.is_empty() {
                ArtifactStatus::Ready
            } else {
                ArtifactStatus::Blocked
            };
            if status != ArtifactStatus::Blocked {
                missing.clear();
            }
            Artifact {
                id,
                output_path: def.generates.clone(),
                status,
                requires: def.requires.clone(),
                missing_deps: missing,
            }
        })
        .collect();

    let is_planning_complete = schema.artifacts.iter().all(|a| completed.contains(a.id.as_str()));
    let apply_requires = schema
        .apply
        .as_ref()
        .map(|a| a.requires.clone())
        .unwrap_or_else(|| schema.artifacts.iter().map(|a| a.id.clone()).collect());

    ChangeAnalysis {
        schema: schema_name,
        error: None,
        warnings,
        artifacts,
        is_planning_complete,
        apply_requires,
        task_files,
        task_stats,
    }
}

// ---------------------------------------------------------------------------
// What counts as a change
// ---------------------------------------------------------------------------

const CHANGE_ROOT_MARKERS: &[&str] = &[METADATA_FILE, "proposal.md", "tasks.md", "design.md"];
const MAX_NESTING_DEPTH: usize = 3;

fn has_any_file_under(dir: &Path) -> bool {
    std::fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .any(|entry| {
            let name = entry.file_name();
            if name.to_string_lossy().starts_with('.') {
                return false;
            }
            match entry.file_type() {
                Ok(t) if t.is_file() || t.is_symlink() => true,
                Ok(t) if t.is_dir() => has_any_file_under(&entry.path()),
                _ => false,
            }
        })
}

fn looks_like_change(dir: &Path, openspec_dir: &Path, schemas: &SchemaDirs, root: &Root) -> bool {
    if CHANGE_ROOT_MARKERS.iter().any(|m| root.file(&dir.join(m)).is_some()) {
        return true;
    }
    if has_any_file_under(&dir.join("specs")) {
        return true;
    }
    let name = match read_metadata(dir, schemas) {
        MetadataRead::Valid(m) => m.schema,
        MetadataRead::Invalid(_) => return false,
        MetadataRead::Absent => {
            read_project_default_schema(openspec_dir).unwrap_or_else(|| DEFAULT_SCHEMA.into())
        }
    };
    schemas
        .resolve(&name)
        .map(|s| {
            s.artifacts
                .iter()
                .any(|a| !resolve_outputs(dir, &a.generates, root).is_empty())
        })
        .unwrap_or(false)
}

fn subdirectories(dir: &Path) -> Vec<String> {
    let mut names: Vec<String> = std::fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .filter(|e| e.file_type().is_ok_and(|t| t.is_dir()))
        .map(|e| e.file_name().to_string_lossy().to_string())
        .filter(|n| !n.starts_with('.'))
        .collect();
    names.sort();
    names
}

/// Change directories nested inside `name`, when `name` is only a folder
/// wrapping them (`findNestedChangesIn`). OpenSpec reports such a folder as
/// "not a change" and ignores what is inside it.
pub fn find_nested_changes(
    change_dir: &Path,
    name: &str,
    openspec_dir: &Path,
    schemas: &SchemaDirs,
    root: &Root,
) -> Vec<String> {
    if looks_like_change(change_dir, openspec_dir, schemas, root) {
        return Vec::new();
    }
    let has_own_file = std::fs::read_dir(change_dir)
        .into_iter()
        .flatten()
        .flatten()
        .any(|e| {
            !e.file_name().to_string_lossy().starts_with('.') && !e.file_type().is_ok_and(|t| t.is_dir())
        });
    if has_own_file {
        return Vec::new();
    }
    fn collect(
        dir: &Path,
        prefix: &str,
        depth: usize,
        found: &mut Vec<String>,
        openspec_dir: &Path,
        schemas: &SchemaDirs,
        root: &Root,
    ) {
        if depth > MAX_NESTING_DEPTH {
            return;
        }
        for child in subdirectories(dir) {
            let path = dir.join(&child);
            let id = format!("{prefix}/{child}");
            if looks_like_change(&path, openspec_dir, schemas, root) {
                found.push(id);
            } else {
                collect(&path, &id, depth + 1, found, openspec_dir, schemas, root);
            }
        }
    }
    let mut found = Vec::new();
    collect(change_dir, name, 1, &mut found, openspec_dir, schemas, root);
    found.sort();
    found
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builtin_spec_driven_parses() {
        let schema = builtin_schemas()
            .iter()
            .find(|s| s.name == "spec-driven")
            .unwrap();
        assert_eq!(build_order(schema), vec!["proposal", "specs", "design", "tasks"]);
        assert_eq!(tracked_tasks_generates(schema), Some("tasks.md"));
    }

    #[test]
    fn specs_path_detection() {
        assert!(is_specs_path("specs/**/*.md"));
        assert!(is_specs_path("./specs/x.md"));
        assert!(!is_specs_path("specs"));
        assert!(!is_specs_path("design/specs.md"));
    }

    #[test]
    fn schema_validation_rejects_bad_graphs() {
        let base = |artifacts: &str| format!("name: t\nversion: 1\nartifacts:\n{artifacts}");
        let cyclic = base("  - {id: a, generates: a.md, description: d, template: t.md, requires: [b]}\n  - {id: b, generates: b.md, description: d, template: t.md, requires: [a]}\n");
        assert!(parse_schema(&cyclic).unwrap_err().contains("Cyclic"));
        let dangling =
            base("  - {id: a, generates: a.md, description: d, template: t.md, requires: [nope]}\n");
        assert!(parse_schema(&dangling).unwrap_err().contains("does not exist"));
        let duplicate = base("  - {id: a, generates: a.md, description: d, template: t.md}\n  - {id: a, generates: b.md, description: d, template: t.md}\n");
        assert!(parse_schema(&duplicate).unwrap_err().contains("Duplicate"));
        let escaping = base("  - {id: a, generates: ../a.md, description: d, template: t.md}\n");
        assert!(parse_schema(&escaping).is_err());
        let no_description = base("  - {id: a, generates: a.md, template: t.md}\n");
        assert!(parse_schema(&no_description).is_err());
    }
}
