//! Reads OpenSpec directories from disk. Read-only for changes and specs:
//! nothing here needs OpenSpec installed, and nothing writes to a change.
//!
//! Change state follows OpenSpec 1.17 semantics (see `workflow`), checked
//! against the real CLI by the conformance test (`conformance`).

mod contain;
mod summary;
mod tasks;
mod workflow;
#[cfg(test)]
mod conformance;

use contain::Root;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

pub use workflow::default_global_data_dir;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct TaskStats {
    pub total: usize,
    pub done: usize,
}

/// Board column. Derived from task progress exactly as `openspec list`
/// derives its status: `no-tasks` → draft, `complete` → done, `in-progress`
/// → todo (nothing checked yet) or in_progress.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ChangeStatus {
    Draft,
    Todo,
    InProgress,
    Done,
    Archived,
}

/// State of one artifact, verbatim from `openspec status --json`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ArtifactStatus {
    /// Its output file(s) exist.
    Done,
    /// Not written, and not needed: the change declares `skip_specs`.
    Skipped,
    /// Not written; everything it requires is done or skipped.
    Ready,
    /// Not written; waiting on `missing_deps`.
    Blocked,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Artifact {
    pub id: String,
    /// The schema's `generates` path or glob, relative to the change.
    pub output_path: String,
    pub status: ArtifactStatus,
    /// Artifacts this one depends on, per the schema.
    pub requires: Vec<String>,
    /// Dependencies not yet done, when blocked.
    pub missing_deps: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Change {
    pub id: String,
    pub name: String,
    pub source_id: String,
    pub status: ChangeStatus,
    /// The proposal's own title, when it has one beyond the template's
    /// `# Proposal` (legacy `# Change: Add X`). Display only.
    pub title: Option<String>,
    /// One line on what the change is for: `goal` from `.openspec.yaml`, else
    /// the first paragraph of the proposal's `## Why`. Display only.
    pub summary: Option<String>,
    pub has_proposal: bool,
    pub has_specs: bool,
    pub has_tasks: bool,
    pub has_design: bool,
    pub task_stats: Option<TaskStats>,
    /// Workflow schema the change follows: from `.openspec.yaml`, else the
    /// project default in `openspec/config.yaml`, else `spec-driven`.
    pub schema: Option<String>,
    /// The schema's artifact chain in build order. Empty when `error` is set.
    pub artifacts: Vec<Artifact>,
    /// Every artifact is done or skipped.
    pub is_planning_complete: bool,
    /// Artifacts that must be done before implementation (`apply.requires`).
    pub apply_requires: Vec<String>,
    /// Why OpenSpec cannot read this change (invalid `.openspec.yaml`,
    /// unknown or broken schema, a folder wrapping other changes).
    pub error: Option<String>,
    /// Non-fatal problems OpenSpec would warn about.
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangeDetail {
    pub id: String,
    pub name: String,
    pub source_id: String,
    pub status: ChangeStatus,
    pub proposal: Option<String>,
    pub design: Option<String>,
    pub specs: Vec<SpecContent>,
    pub tasks: Option<TasksContent>,
    pub schema: Option<String>,
    pub artifacts: Vec<Artifact>,
    pub is_planning_complete: bool,
    pub error: Option<String>,
    pub warnings: Vec<String>,
    /// Written files of every artifact in the chain, in chain order. Covers
    /// custom schemas whose artifacts are not proposal/design/specs/tasks.
    pub documents: Vec<ArtifactDocument>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactDocument {
    pub artifact_id: String,
    pub files: Vec<SpecContent>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SpecContent {
    pub path: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TasksContent {
    pub raw: String,
    pub stats: TaskStats,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Spec {
    pub id: String,
    pub source_id: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpecDetail {
    pub id: String,
    pub source_id: String,
    pub path: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Idea {
    pub id: String,
    pub source_id: String,
    pub project_id: Option<String>,
    pub title: String,
    pub description: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdeaFrontmatter {
    /// Required for a file to count as an idea, but never trusted: the id
    /// is the file name (see [`is_safe_idea_id`]).
    #[allow(dead_code)]
    id: String,
    #[serde(default)]
    project_id: Option<String>,
    created_at: String,
    updated_at: String,
}

fn parse_idea_frontmatter(content: &str) -> Option<IdeaFrontmatter> {
    let lines: Vec<&str> = content.lines().collect();

    if !lines.first().map(|l| l.trim() == "---").unwrap_or(false) {
        return None;
    }

    let mut frontmatter_lines = Vec::new();
    let mut i = 1;

    while i < lines.len() {
        let line = lines[i].trim();
        if line == "---" {
            break;
        }
        frontmatter_lines.push(lines[i]);
        i += 1;
    }

    serde_yaml::from_str::<IdeaFrontmatter>(&frontmatter_lines.join("\n")).ok()
}

fn extract_idea_title_and_description(content: &str) -> (String, String) {
    let lines: Vec<&str> = content.lines().collect();

    let mut frontmatter_end = 0;
    for (i, line) in lines.iter().enumerate() {
        if i > 0 && line.trim() == "---" {
            frontmatter_end = i + 1;
            break;
        }
    }

    let content_lines: Vec<&str> = lines.iter().skip(frontmatter_end).copied().collect();

    // Find the first H1 header to use as title
    let title_idx = content_lines
        .iter()
        .position(|l| l.starts_with("# "));

    let title = title_idx
        .map(|i| content_lines[i].trim_start_matches("# ").trim().to_string())
        .unwrap_or_else(|| "Untitled Idea".to_string());

    // Description is everything after the title
    // If no title found, it's everything
    let start_idx = title_idx.map(|i| i + 1).unwrap_or(0);

    let description = content_lines
        .iter()
        .skip(start_idx)
        .skip_while(|l| l.trim().is_empty())
        .copied()
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string();

    (title, description)
}

// ---------------------------------------------------------------------------
// Changes
// ---------------------------------------------------------------------------

/// Machine-level inputs to a scan. OpenSpec reads user-level workflow schemas
/// and the store registry from its global data directory.
#[derive(Debug, Clone)]
pub struct ScanOptions {
    pub global_data_dir: Option<PathBuf>,
}

impl Default for ScanOptions {
    fn default() -> Self {
        ScanOptions { global_data_dir: default_global_data_dir() }
    }
}

/// Board column from task progress (mirrors `openspec list`'s status).
fn compute_status(task_stats: Option<&TaskStats>, is_archived: bool) -> ChangeStatus {
    if is_archived {
        return ChangeStatus::Archived;
    }
    match task_stats {
        None => ChangeStatus::Draft,
        Some(s) if s.total == 0 => ChangeStatus::Draft,
        Some(s) if s.done == s.total => ChangeStatus::Done,
        Some(s) if s.done == 0 => ChangeStatus::Todo,
        Some(_) => ChangeStatus::InProgress,
    }
}

/// Directory names directly under `dir` (not following symlinks, as
/// `readdir(..., { withFileTypes: true })` reports them), sorted.
fn child_dirs(dir: &Path) -> Vec<String> {
    let mut names: Vec<String> = std::fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .filter(|e| e.file_type().is_ok_and(|t| t.is_dir()))
        .map(|e| e.file_name().to_string_lossy().to_string())
        .collect();
    names.sort();
    names
}

/// Is `name`, under `changes/`, something OpenSpec treats as an active change?
/// Every directory is, except `archive` and dot-directories (`openspec status`
/// rejects names starting with a dot; `openspec list` happens to show them).
/// No marker file is needed: an empty directory is a change nobody started.
fn is_active_change_name(name: &str) -> bool {
    name != "archive" && !name.starts_with('.')
}

/// One source's OpenSpec directory and where its schemas resolve from.
struct SourceScan {
    dir: PathBuf,
    /// Canonical `dir`: every file read for this source must stay under it.
    root: Root,
    schemas: workflow::SchemaDirs,
}

impl SourceScan {
    fn new(source_path: &Path, options: &ScanOptions) -> Option<SourceScan> {
        let root = Root::new(source_path)?;
        Some(SourceScan {
            dir: source_path.to_path_buf(),
            schemas: workflow::SchemaDirs::new(&root, options.global_data_dir.as_deref()),
            root,
        })
    }
}

fn scan_change(
    change_path: &Path,
    scan: &SourceScan,
    source_id: &str,
    is_archived: bool,
) -> Option<(Change, Vec<PathBuf>)> {
    let name = change_path.file_name()?.to_str()?.to_string();
    let (openspec_dir, schemas, root) = (scan.dir.as_path(), &scan.schemas, &scan.root);
    let analysis = workflow::analyze_change(change_path, openspec_dir, schemas, root);

    let nested = if is_archived {
        Vec::new()
    } else {
        workflow::find_nested_changes(change_path, &name, openspec_dir, schemas, root)
    };
    let (error, artifacts, is_planning_complete, apply_requires) = if nested.is_empty() {
        (analysis.error, analysis.artifacts, analysis.is_planning_complete, analysis.apply_requires)
    } else {
        let list = nested.iter().map(|n| format!("openspec/changes/{n}/")).collect::<Vec<_>>().join(", ");
        (
            Some(format!(
                "\"{name}\" is not a change: it is a folder wrapping {list}. OpenSpec only sees changes directly under openspec/changes/."
            )),
            Vec::new(),
            false,
            Vec::new(),
        )
    };

    let summary::ChangeSummary { title, summary } = summary::summarize(change_path, root);
    let change = Change {
        id: format!("{}/{}", source_id, name),
        name,
        source_id: source_id.to_string(),
        status: compute_status(analysis.task_stats.as_ref(), is_archived),
        title,
        summary,
        has_proposal: root.file(&change_path.join("proposal.md")).is_some(),
        has_specs: !workflow::resolve_outputs(change_path, "specs/**/*.md", root).is_empty(),
        has_tasks: !analysis.task_files.is_empty(),
        has_design: root.file(&change_path.join("design.md")).is_some(),
        task_stats: analysis.task_stats,
        schema: analysis.schema,
        artifacts,
        is_planning_complete,
        apply_requires,
        error,
        warnings: analysis.warnings,
    };
    Some((change, analysis.task_files))
}

/// Scan changes/ (active and archived) of one OpenSpec directory.
pub fn scan_changes(source_path: &Path, source_id: &str) -> Vec<Change> {
    scan_changes_with(source_path, source_id, &ScanOptions::default())
}

pub fn scan_changes_with(source_path: &Path, source_id: &str, options: &ScanOptions) -> Vec<Change> {
    let Some(scan) = SourceScan::new(source_path, options) else {
        return Vec::new();
    };
    let changes_path = source_path.join("changes");
    let mut changes = Vec::new();

    for name in child_dirs(&changes_path).into_iter().filter(|n| is_active_change_name(n)) {
        if let Some((change, _)) = scan_change(&changes_path.join(&name), &scan, source_id, false) {
            changes.push(change);
        }
    }

    let archive_path = changes_path.join("archive");
    for name in child_dirs(&archive_path).into_iter().filter(|n| !n.starts_with('.')) {
        if let Some((change, _)) = scan_change(&archive_path.join(&name), &scan, source_id, true) {
            changes.push(change);
        }
    }

    changes
}

fn relative_display(path: &Path, base: &Path) -> String {
    path.strip_prefix(base).unwrap_or(path).to_string_lossy().replace('\\', "/")
}

/// Get full details for a specific change
pub fn get_change_detail(source_path: &Path, source_id: &str, change_name: &str) -> Option<ChangeDetail> {
    get_change_detail_with(source_path, source_id, change_name, &ScanOptions::default())
}

pub fn get_change_detail_with(
    source_path: &Path,
    source_id: &str,
    change_name: &str,
    options: &ScanOptions,
) -> Option<ChangeDetail> {
    if change_name.is_empty() || change_name.contains(['/', '\\']) || change_name == "." || change_name == ".." {
        return None;
    }

    let scan = SourceScan::new(source_path, options)?;
    let root = &scan.root;
    let changes_path = source_path.join("changes");
    let mut change_path = changes_path.join(change_name);
    let mut is_archived = false;

    if !is_active_change_name(change_name) || !change_path.is_dir() {
        // Archived changes are named YYYY-MM-DD-<name>; accept either form.
        let archive_path = changes_path.join("archive");
        let found = child_dirs(&archive_path)
            .into_iter()
            .find(|n| n == change_name || n.ends_with(&format!("-{change_name}")));
        change_path = archive_path.join(found?);
        is_archived = true;
    }
    // The list never shows a change folder that is a symlink; one pointing
    // out of the source must not open by URL either.
    if !change_path.symlink_metadata().is_ok_and(|m| m.is_dir()) || root.contain(&change_path).is_none() {
        return None;
    }

    let (change, task_files) = scan_change(&change_path, &scan, source_id, is_archived)?;

    let read = |p: PathBuf| root.read(&p);
    let tasks = (!task_files.is_empty()).then(|| {
        let raw = task_files
            .iter()
            .filter_map(|f| root.read(f))
            .collect::<Vec<_>>()
            .join("\n\n");
        TasksContent { stats: change.task_stats.clone().unwrap_or(TaskStats { total: 0, done: 0 }), raw }
    });

    let specs = workflow::resolve_outputs(&change_path, "specs/**/*.md", root)
        .into_iter()
        .filter_map(|p| {
            let content = root.read(&p)?;
            Some(SpecContent { path: relative_display(&p, &change_path.join("specs")), content })
        })
        .collect();

    let documents = change
        .artifacts
        .iter()
        .filter(|a| matches!(a.status, ArtifactStatus::Done))
        .map(|a| ArtifactDocument {
            artifact_id: a.id.clone(),
            files: workflow::resolve_outputs(&change_path, &a.output_path, root)
                .into_iter()
                .filter_map(|p| {
                    let content = root.read(&p)?;
                    Some(SpecContent { path: relative_display(&p, &change_path), content })
                })
                .collect(),
        })
        .filter(|d| !d.files.is_empty())
        .collect();

    Some(ChangeDetail {
        id: format!("{}/{}", source_id, change_name),
        name: change.name,
        source_id: source_id.to_string(),
        status: change.status,
        proposal: read(change_path.join("proposal.md")),
        design: read(change_path.join("design.md")),
        specs,
        tasks,
        schema: change.schema,
        artifacts: change.artifacts,
        is_planning_complete: change.is_planning_complete,
        error: change.error,
        warnings: change.warnings,
        documents,
    })
}

// ---------------------------------------------------------------------------
// Where planning lives (stores, beta)
// ---------------------------------------------------------------------------

/// Where a source's planning lives, as far as OpenSpec stores (beta) go.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PlanningKind {
    /// An ordinary `openspec/` directory with its own changes and specs.
    Local,
    /// A store checkout (`.openspec-store/store.yaml` next to `openspec/`).
    /// Same layout as a local root, so it is read the same way.
    Store,
    /// A code repo whose `openspec/config.yaml` declares `store: <id>` and
    /// has no planning folders of its own: OpenSpec commands run here act on
    /// that store. The dashboard does not follow the pointer; it reports it.
    StorePointer,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanningRoot {
    pub kind: PlanningKind,
    pub store_id: Option<String>,
    /// The store's `openspec/` directory on this machine, from OpenSpec's
    /// store registry, when the pointer resolves. Add it as a source to see
    /// the store's changes.
    pub store_path: Option<String>,
    /// Why a declared store could not be resolved on this machine.
    pub problem: Option<String>,
}

/// A string field of a YAML file that stays inside `root` (a file outside
/// it counts as absent).
fn yaml_string_field(root: Option<&Root>, path: &Path, key: &str) -> Result<Option<String>, ()> {
    let Some(content) = root.and_then(|r| r.read(path)) else {
        return Ok(None);
    };
    let value: serde_yaml::Value = serde_yaml::from_str(&content).map_err(|_| ())?;
    match value.get(key) {
        None => Ok(None),
        Some(serde_yaml::Value::String(s)) => Ok(Some(s.clone())),
        Some(_) => Err(()),
    }
}

/// Classify a source's planning home. Mirrors OpenSpec's root selection: a
/// directory with `changes/` or `specs/` is a real root and any `store:`
/// pointer in its config is ignored; without them, the pointer decides.
pub fn inspect_planning_root(source_path: &Path, options: &ScanOptions) -> PlanningRoot {
    let local = PlanningRoot { kind: PlanningKind::Local, store_id: None, store_path: None, problem: None };

    let parent = source_path.parent().unwrap_or(source_path);
    let identity = parent.join(".openspec-store").join("store.yaml");
    if identity.is_file() {
        return PlanningRoot {
            kind: PlanningKind::Store,
            store_id: yaml_string_field(Root::new(parent).as_ref(), &identity, "id").ok().flatten(),
            ..local
        };
    }

    let has_planning_shape = ["changes", "specs"].iter().any(|d| {
        let dir = source_path.join(d);
        dir.is_dir() && !dir.join(".openspec-store").join("store.yaml").exists()
    });
    if has_planning_shape {
        return local;
    }

    let Some(config) = ["config.yaml", "config.yml"].iter().map(|f| source_path.join(f)).find(|p| p.exists()) else {
        return local;
    };
    let store_id = match yaml_string_field(Root::new(source_path).as_ref(), &config, "store") {
        Ok(Some(id)) => id,
        Ok(None) => return local,
        Err(()) => {
            return PlanningRoot {
                kind: PlanningKind::StorePointer,
                problem: Some(format!("{} has an unreadable store declaration", config.display())),
                ..local
            }
        }
    };

    let registry = options.global_data_dir.as_ref().map(|d| d.join("stores").join("registry.yaml"));
    let local_path = registry
        .as_ref()
        .and_then(|r| std::fs::read_to_string(r).ok())
        .and_then(|c| serde_yaml::from_str::<serde_yaml::Value>(&c).ok())
        .and_then(|v| {
            v.get("stores")?
                .get(store_id.as_str())?
                .get("backend")?
                .get("local_path")?
                .as_str()
                .map(PathBuf::from)
        });
    let (store_path, problem) = match local_path {
        Some(p) if p.join("openspec").is_dir() => (Some(p.join("openspec").display().to_string()), None),
        Some(p) => (None, Some(format!("Store '{store_id}' is registered at {}, but that folder has no openspec/ directory.", p.display()))),
        None => (None, Some(format!("Store '{store_id}' is not registered on this machine (openspec store register <path>)."))),
    };
    PlanningRoot { kind: PlanningKind::StorePointer, store_id: Some(store_id), store_path, problem }
}


/// Scan specs/ directory for source-of-truth specs. Lists exactly the files
/// [`get_spec_detail`] opens: `*.md` directly in the OpenSpec directory, and
/// `*.md` under `specs/`, each staying inside the source.
pub fn scan_specs(source_path: &Path, source_id: &str) -> Vec<Spec> {
    let mut specs = Vec::new();
    let Some(root) = Root::new(source_path) else {
        return specs;
    };

    // Include root-level markdown files
    for entry in std::fs::read_dir(source_path).into_iter().flatten().flatten() {
        let path = entry.path();
        if root.file(&path).is_some() && path.extension().is_some_and(|e| e == "md") {
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            // Skip common change files and changes directory
            if name != "proposal.md" && name != "tasks.md" && name != "design.md" && name != "changes" {
                let id = format!("{}/{}", source_id, name.replace(".md", ""));
                specs.push(Spec {
                    id,
                    source_id: source_id.to_string(),
                    path: name.to_string(),
                });
            }
        }
    }

    // Scan specs/ directory (directory symlinks are not followed)
    let specs_path = source_path.join("specs");
    if root.sub("specs").is_some() {
        for entry in WalkDir::new(&specs_path).min_depth(1).into_iter().flatten() {
            let path = entry.path();
            if root.file(path).is_some() && path.extension().is_some_and(|e| e == "md") {
                let relative = path.strip_prefix(&specs_path).unwrap_or(path);
                let path_str = relative.to_string_lossy().replace('\\', "/");
                let id = format!("{}/{}", source_id, path_str.replace("/spec.md", "").replace(".md", ""));
                specs.push(Spec {
                    id,
                    source_id: source_id.to_string(),
                    path: path_str,
                });
            }
        }
    }

    specs
}

/// Content of the spec `name` (the part of a spec id after the source):
/// `<name>/spec.md`, `<name>.md` or `<name>` under `specs/`, or a single
/// `<name>.md` directly in the OpenSpec directory. Only `.md` files inside
/// the source are returned; `..`, absolute paths and empty segments never
/// resolve.
pub fn get_spec_detail(source_path: &Path, source_id: &str, name: &str) -> Option<SpecDetail> {
    if !contain::is_plain_relative(name) {
        return None;
    }
    let root = Root::new(source_path)?;
    let specs = root.sub("specs");

    for candidate in [format!("{name}/spec.md"), format!("{name}.md"), name.to_string()] {
        if !candidate.ends_with(".md") {
            continue;
        }
        let at_root = (!candidate.contains('/')).then(|| root.join(&candidate)).flatten();
        let found = at_root
            .filter(|p| p.is_file())
            .or_else(|| specs.as_ref()?.join(&candidate).filter(|p| p.is_file()));
        let Some(path) = found else { continue };
        let content = std::fs::read_to_string(&path).ok()?;
        return Some(SpecDetail {
            id: format!("{}/{}", source_id, candidate.replace("/spec.md", "").replace(".md", "")),
            source_id: source_id.to_string(),
            path: candidate,
            content,
        });
    }
    None
}

// ---------------------------------------------------------------------------
// Ideas
// ---------------------------------------------------------------------------

/// Idea ids are file names in `ideas/` (without `.md`): letters, digits,
/// `-`, `_` and `.`, not starting with a dot, at most 128 characters. They
/// arrive in URLs and, through the UI, from repo files, so nothing else is
/// ever joined to a path.
pub fn is_safe_idea_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 128
        && !id.starts_with('.')
        && id.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
}

fn invalid_input(message: &str) -> std::io::Error {
    std::io::Error::new(std::io::ErrorKind::InvalidInput, message.to_string())
}

/// The source's `ideas/` folder, which must stay inside the source.
/// `NotFound` when there is none yet (and `create` is false).
fn ideas_root(source_path: &Path, create: bool) -> std::io::Result<Root> {
    let not_found = || std::io::Error::new(std::io::ErrorKind::NotFound, "Idea not found");
    let source = Root::new(source_path).ok_or_else(not_found)?;
    let dir = source.path().join("ideas");
    if dir.symlink_metadata().is_err() {
        if !create {
            return Err(not_found());
        }
        std::fs::create_dir(&dir)?;
    }
    source
        .sub("ideas")
        .ok_or_else(|| invalid_input("The ideas folder is not a folder inside the source"))
}

/// Path of an idea file. Refuses unsafe ids, and anything at that path
/// that is not a regular file (a symlink is never read, written or deleted).
fn idea_path(ideas: &Root, id: &str) -> std::io::Result<PathBuf> {
    if !is_safe_idea_id(id) {
        return Err(invalid_input("Invalid idea id"));
    }
    let path = ideas.path().join(format!("{id}.md"));
    match path.symlink_metadata() {
        Ok(meta) if !meta.file_type().is_file() => Err(invalid_input("Not an idea file")),
        _ => Ok(path),
    }
}

/// Frontmatter and body of an idea file. `id` is the file name.
fn idea_content(id: &str, project_id: Option<&str>, created_at: &str, updated_at: &str, title: &str, description: &str) -> String {
    // A value with a line break would add keys to the frontmatter.
    let project_id_line = match project_id.filter(|p| !p.contains(['\n', '\r'])) {
        Some(pid) => format!("projectId: {pid}"),
        None => String::new(),
    };
    format!(
        "---\nid: {id}\n{project_id_line}\ncreatedAt: {created_at}\nupdatedAt: {updated_at}\n---\n\n# {title}\n\n{description}\n"
    )
}

/// Scan ideas/ directory for all ideas. An idea's id is its file name;
/// the `id` in its frontmatter is not used. Files with an unsafe name and
/// symlinks are skipped.
pub fn scan_ideas(source_path: &Path, source_id: &str) -> Vec<Idea> {
    let mut ideas = Vec::new();
    let Ok(ideas_dir) = ideas_root(source_path, false) else {
        return ideas;
    };

    for entry in std::fs::read_dir(ideas_dir.path()).into_iter().flatten().flatten() {
        let path = entry.path();
        if !entry.file_type().is_ok_and(|t| t.is_file()) || path.extension().is_none_or(|e| e != "md") {
            continue;
        }
        let Some(id) = path.file_stem().and_then(|s| s.to_str()).filter(|s| is_safe_idea_id(s)) else {
            continue;
        };
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Some(frontmatter) = parse_idea_frontmatter(&content) {
                let (title, description) = extract_idea_title_and_description(&content);
                ideas.push(Idea {
                    id: format!("{}/{}", source_id, id),
                    source_id: source_id.to_string(),
                    project_id: frontmatter.project_id,
                    title,
                    description,
                    created_at: frontmatter.created_at,
                    updated_at: frontmatter.updated_at,
                });
            }
        }
    }

    ideas.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    ideas
}

/// Save a new idea. Never overwrites an existing file.
pub fn save_idea(source_path: &Path, source_id: &str, id: &str, title: &str, description: &str, project_id: Option<&str>) -> std::io::Result<Idea> {
    if !is_safe_idea_id(id) {
        return Err(invalid_input("Invalid idea id"));
    }
    let ideas = ideas_root(source_path, true)?;
    let path = idea_path(&ideas, id)?;
    let now = chrono::Utc::now().to_rfc3339();
    let content = idea_content(id, project_id, &now, &now, title, description);

    let mut file = std::fs::OpenOptions::new().write(true).create_new(true).open(&path)?;
    std::io::Write::write_all(&mut file, content.as_bytes())?;

    Ok(Idea {
        id: format!("{}/{}", source_id, id),
        source_id: source_id.to_string(),
        project_id: project_id.map(|s| s.to_string()),
        title: title.to_string(),
        description: description.to_string(),
        created_at: now.clone(),
        updated_at: now,
    })
}

/// Delete idea from file system. A missing idea is not an error.
pub fn delete_idea(source_path: &Path, id: &str) -> std::io::Result<()> {
    if !is_safe_idea_id(id) {
        return Err(invalid_input("Invalid idea id"));
    }
    let ideas = match ideas_root(source_path, false) {
        Ok(ideas) => ideas,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(e) => return Err(e),
    };
    let path = idea_path(&ideas, id)?;
    match std::fs::remove_file(path) {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        other => other,
    }
}

/// Update idea in file system. The id written back is the file name.
pub fn update_idea(source_path: &Path, source_id: &str, id: &str, title: &str, description: &str) -> std::io::Result<Idea> {
    if !is_safe_idea_id(id) {
        return Err(invalid_input("Invalid idea id"));
    }
    let ideas = ideas_root(source_path, false)?;
    let idea_path = idea_path(&ideas, id)?;

    if !idea_path.exists() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "Idea file not found"
        ));
    }

    let existing_content = std::fs::read_to_string(&idea_path)?;
    let frontmatter = parse_idea_frontmatter(&existing_content).ok_or_else(|| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "Invalid idea file format"
        )
    })?;

    let now = chrono::Utc::now().to_rfc3339();
    let content = idea_content(id, frontmatter.project_id.as_deref(), &frontmatter.created_at, &now, title, description);
    std::fs::write(&idea_path, content)?;

    Ok(Idea {
        id: format!("{}/{}", source_id, id),
        source_id: source_id.to_string(),
        project_id: frontmatter.project_id,
        title: title.to_string(),
        description: description.to_string(),
        created_at: frontmatter.created_at,
        updated_at: now,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A throwaway OpenSpec directory under the system temp dir.
    struct TempOpenSpec(PathBuf);

    impl TempOpenSpec {
        fn new(label: &str) -> Self {
            let dir = std::env::temp_dir().join(format!(
                "ospec-ui-{label}-{}-{:?}",
                std::process::id(),
                std::thread::current().id()
            ));
            std::fs::remove_dir_all(&dir).ok();
            std::fs::create_dir_all(dir.join("openspec").join("changes")).unwrap();
            TempOpenSpec(dir)
        }
        fn openspec(&self) -> PathBuf {
            self.0.join("openspec")
        }
        fn write(&self, rel: &str, content: &str) {
            let path = self.openspec().join(rel);
            std::fs::create_dir_all(path.parent().unwrap()).unwrap();
            std::fs::write(path, content).unwrap();
        }
        fn scan(&self) -> Vec<Change> {
            scan_changes_with(&self.openspec(), "repo", &ScanOptions { global_data_dir: None })
        }
        fn change(&self, name: &str) -> Change {
            self.scan().into_iter().find(|c| c.name == name).expect("change present")
        }
    }

    impl Drop for TempOpenSpec {
        fn drop(&mut self) {
            std::fs::remove_dir_all(&self.0).ok();
        }
    }

    fn statuses(change: &Change) -> Vec<(String, ArtifactStatus)> {
        change.artifacts.iter().map(|a| (a.id.clone(), a.status)).collect()
    }

    #[test]
    fn list_carries_a_summary_without_changing_state() {
        let repo = TempOpenSpec::new("summary");
        repo.write("changes/add-x/.openspec.yaml", "schema: spec-driven\ngoal: Ship X\n");
        repo.write("changes/add-y/proposal.md", "# Change: Add Y\n\n## Why\n\nY is missing.\n");
        repo.write("changes/broken/.openspec.yaml", "schema: [nope\n");

        let x = repo.change("add-x");
        assert_eq!((x.title, x.summary.as_deref()), (None, Some("Ship X")));
        assert_eq!(x.status, ChangeStatus::Draft);

        let y = repo.change("add-y");
        assert_eq!((y.title.as_deref(), y.summary.as_deref()), (Some("Add Y"), Some("Y is missing.")));

        let broken = repo.change("broken");
        assert!(broken.error.is_some(), "metadata errors still surface");
        assert_eq!(broken.summary, None);

        let json = serde_json::to_value(&y).unwrap();
        assert_eq!(json["summary"], "Y is missing.");
        assert_eq!(json["title"], "Add Y");
    }

    #[test]
    fn test_parse_idea_frontmatter_with_empty_line() {
        let content = r#"---
id: idea-123

createdAt: 2026-01-01T00:00:00+00:00
updatedAt: 2026-01-01T00:00:00+00:00
---

# Title
Description"#;

        let frontmatter = parse_idea_frontmatter(content);
        assert!(frontmatter.is_some());
        let f = frontmatter.unwrap();
        assert_eq!(f.id, "idea-123");
        assert!(f.project_id.is_none());
    }

    #[test]
    fn test_parse_task_stats() {
        let content = r#"
# Tasks

## 1. Backend
- [x] 1.1 Done task
- [ ] 1.2 Todo task
- [x] 1.3 Another done
  - [X] 1.3.1 Nested, upper-case

## 2. Frontend
* [ ] 2.1 Pending
1. [ ] 2.2 Also pending
- [Docs](./docs.md) is a link, not a task
"#;
        let stats = tasks::count_tasks(content);
        assert_eq!(stats.total, 6);
        assert_eq!(stats.done, 3);
    }

    #[test]
    fn marker_only_change_is_visible_with_proposal_ready() {
        let t = TempOpenSpec::new("marker");
        t.write("changes/fresh/.openspec.yaml", "schema: spec-driven\ncreated: 2026-07-26\n");
        let change = t.change("fresh");
        assert_eq!(change.status, ChangeStatus::Draft);
        assert_eq!(change.schema.as_deref(), Some("spec-driven"));
        assert_eq!(
            statuses(&change),
            vec![
                ("proposal".into(), ArtifactStatus::Ready),
                ("specs".into(), ArtifactStatus::Blocked),
                ("design".into(), ArtifactStatus::Blocked),
                ("tasks".into(), ArtifactStatus::Blocked),
            ]
        );
        assert_eq!(change.artifacts[3].missing_deps, vec!["specs", "design"]);
    }

    #[test]
    fn tasks_file_alone_is_done_even_though_its_dependencies_are_not() {
        let t = TempOpenSpec::new("tasks-only");
        t.write("changes/quick/.openspec.yaml", "schema: spec-driven\n");
        t.write("changes/quick/tasks.md", "- [x] a\n- [ ] b\n");
        let change = t.change("quick");
        assert_eq!(change.artifacts[3].status, ArtifactStatus::Done);
        assert!(change.artifacts[3].missing_deps.is_empty());
        assert_eq!(change.artifacts[1].missing_deps, vec!["proposal"]);
        assert_eq!(change.status, ChangeStatus::InProgress);
        assert!(!change.is_planning_complete);
    }

    #[test]
    fn empty_specs_directory_is_not_written_specs() {
        let t = TempOpenSpec::new("empty-specs");
        t.write("changes/c/proposal.md", "# p\n");
        std::fs::create_dir_all(t.openspec().join("changes/c/specs/auth")).unwrap();
        let change = t.change("c");
        assert!(!change.has_specs);
        assert_eq!(change.artifacts[1].status, ArtifactStatus::Ready);
    }

    #[test]
    fn skip_specs_marks_specs_skipped_and_unblocks_tasks() {
        let t = TempOpenSpec::new("skip");
        t.write("changes/c/.openspec.yaml", "schema: spec-driven\nskip_specs: true\n");
        t.write("changes/c/proposal.md", "# p\n");
        t.write("changes/c/design.md", "# d\n");
        let change = t.change("c");
        assert_eq!(change.artifacts[1].status, ArtifactStatus::Skipped);
        assert_eq!(change.artifacts[3].status, ArtifactStatus::Ready);
    }

    #[test]
    fn legacy_and_bare_directories_are_changes() {
        let t = TempOpenSpec::new("legacy");
        t.write("changes/old/proposal.md", "# p\n");
        std::fs::create_dir_all(t.openspec().join("changes/empty")).unwrap();
        std::fs::create_dir_all(t.openspec().join("changes/.hidden")).unwrap();
        let names: Vec<String> = t.scan().into_iter().map(|c| c.name).collect();
        assert_eq!(names, vec!["empty", "old"]);
    }

    #[test]
    fn invalid_metadata_is_reported_not_guessed() {
        let t = TempOpenSpec::new("invalid");
        t.write("changes/c/.openspec.yaml", "created: 2026-01-01\n");
        t.write("changes/c/tasks.md", "- [x] a\n");
        let change = t.change("c");
        assert!(change.error.as_deref().unwrap().contains("schema"));
        assert!(change.artifacts.is_empty());
        // Task progress still counts tasks.md, as `openspec list` does.
        assert_eq!(change.task_stats, Some(TaskStats { total: 1, done: 1 }));
        assert_eq!(change.status, ChangeStatus::Done);
    }

    #[test]
    fn project_local_schema_drives_the_chain() {
        let t = TempOpenSpec::new("custom");
        t.write(
            "schemas/mini/schema.yaml",
            "name: mini\nversion: 1\nartifacts:\n  - {id: brief, generates: brief.md, description: d, template: t.md}\n  - {id: todo, generates: \"todo/*.md\", description: d, template: t.md, requires: [brief]}\napply:\n  requires: [todo]\n  tracks: \"todo/*.md\"\n",
        );
        t.write("changes/c/.openspec.yaml", "schema: mini\n");
        t.write("changes/c/todo/a.md", "- [x] one\n");
        t.write("changes/c/todo/b.md", "- [ ] two\n");
        let change = t.change("c");
        assert_eq!(
            statuses(&change),
            vec![("brief".into(), ArtifactStatus::Ready), ("todo".into(), ArtifactStatus::Done)]
        );
        assert_eq!(change.task_stats, Some(TaskStats { total: 2, done: 1 }));
        assert_eq!(change.apply_requires, vec!["todo"]);
    }

    #[test]
    fn test_compute_status() {
        let stats = |done, total| Some(TaskStats { total, done });
        assert_eq!(compute_status(None, false), ChangeStatus::Draft);
        assert_eq!(compute_status(stats(0, 0).as_ref(), false), ChangeStatus::Draft);
        assert_eq!(compute_status(stats(0, 5).as_ref(), false), ChangeStatus::Todo);
        assert_eq!(compute_status(stats(2, 5).as_ref(), false), ChangeStatus::InProgress);
        assert_eq!(compute_status(stats(5, 5).as_ref(), false), ChangeStatus::Done);
        assert_eq!(compute_status(None, true), ChangeStatus::Archived);
        assert_eq!(compute_status(stats(5, 5).as_ref(), true), ChangeStatus::Archived);
    }

    #[test]
    fn change_detail_lists_documents_per_artifact() {
        let t = TempOpenSpec::new("detail");
        t.write("changes/c/proposal.md", "# p\n");
        t.write("changes/c/specs/auth/spec.md", "# s\n");
        t.write("changes/c/tasks.md", "- [x] a\n");
        let detail = get_change_detail_with(&t.openspec(), "repo", "c", &ScanOptions { global_data_dir: None }).unwrap();
        let ids: Vec<&str> = detail.documents.iter().map(|d| d.artifact_id.as_str()).collect();
        assert_eq!(ids, vec!["proposal", "specs", "tasks"]);
        assert_eq!(detail.specs[0].path, "auth/spec.md");
        assert_eq!(detail.tasks.unwrap().stats, TaskStats { total: 1, done: 1 });
        assert!(get_change_detail_with(&t.openspec(), "repo", "../c", &ScanOptions { global_data_dir: None }).is_none());
    }

    /// A file next to the temp OpenSpec dir, outside the source.
    fn outside_file(t: &TempOpenSpec, name: &str, content: &str) -> PathBuf {
        let dir = t.0.join("outside");
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join(name);
        std::fs::write(&path, content).unwrap();
        path
    }

    #[test]
    fn spec_detail_refuses_paths_outside_the_source() {
        let t = TempOpenSpec::new("spec-escape");
        t.write("specs/auth/spec.md", "# Auth\n");
        let secret = outside_file(&t, "secret.md", "SECRET\n");
        let src = t.openspec();

        let absolute = secret.to_string_lossy().to_string();
        for name in [
            "../outside/secret",
            "../outside/secret.md",
            "auth/../../outside/secret",
            absolute.as_str(),
            absolute.trim_end_matches(".md"),
            "/etc/passwd",
            "",
            "auth//spec",
            "./auth",
            "config.yaml",
        ] {
            assert!(get_spec_detail(&src, "repo", name).is_none(), "{name:?} must not resolve");
        }
        assert_eq!(get_spec_detail(&src, "repo", "auth").unwrap().content, "# Auth\n");
    }

    #[test]
    fn every_listed_spec_opens_by_its_id() {
        let t = TempOpenSpec::new("spec-roundtrip");
        t.write("project.md", "# Project\n");
        t.write("specs/auth/spec.md", "# Auth\n");
        t.write("specs/billing/invoices/spec.md", "# Invoices\n");
        t.write("specs/flat.md", "# Flat\n");
        let specs = scan_specs(&t.openspec(), "repo");
        assert_eq!(specs.len(), 4);
        for spec in specs {
            let name = spec.id.strip_prefix("repo/").unwrap();
            let detail = get_spec_detail(&t.openspec(), "repo", name)
                .unwrap_or_else(|| panic!("{} is listed but does not open", spec.id));
            assert_eq!(detail.id, spec.id);
        }
    }

    #[cfg(unix)]
    #[test]
    fn symlinks_out_of_the_source_are_not_read() {
        use std::os::unix::fs::symlink;
        let t = TempOpenSpec::new("symlink-out");
        let src = t.openspec();
        let secret = outside_file(&t, "hosts.md", "## Why\n\nTOP-SECRET\n");
        t.write("changes/c/tasks.md", "- [ ] a\n");
        symlink(&secret, src.join("changes/c/proposal.md")).unwrap();
        std::fs::create_dir_all(src.join("changes/c/specs")).unwrap();
        symlink(secret.parent().unwrap(), src.join("changes/c/specs/out")).unwrap();
        std::fs::create_dir_all(src.join("specs")).unwrap();
        symlink(&secret, src.join("specs/leak.md")).unwrap();
        // A change folder that is itself a symlink out of the source.
        std::fs::create_dir_all(t.0.join("outside/elsewhere")).unwrap();
        std::fs::write(t.0.join("outside/elsewhere/proposal.md"), "TOP-SECRET\n").unwrap();
        symlink(t.0.join("outside/elsewhere"), src.join("changes/linked")).unwrap();

        let options = ScanOptions { global_data_dir: None };
        let change = t.change("c");
        assert!(!change.has_proposal, "an out-of-source proposal does not exist");
        assert!(!change.has_specs);
        assert_eq!(change.summary, None);
        assert_eq!(change.artifacts[0].status, ArtifactStatus::Ready);

        let detail = get_change_detail_with(&src, "repo", "c", &options).unwrap();
        let json = serde_json::to_string(&detail).unwrap();
        assert!(!json.contains("TOP-SECRET"), "{json}");
        assert!(detail.proposal.is_none());

        assert!(get_change_detail_with(&src, "repo", "linked", &options).is_none());
        assert!(get_spec_detail(&src, "repo", "leak").is_none());
        assert!(scan_specs(&src, "repo").is_empty(), "out-of-source specs are not listed");
    }

    #[cfg(unix)]
    #[test]
    fn symlinked_yaml_out_of_the_source_is_not_read() {
        use std::os::unix::fs::symlink;
        let t = TempOpenSpec::new("symlink-yaml");
        let src = t.openspec();
        let secret = outside_file(&t, "secret.txt", "TOP-SECRET-LINE\n");
        let mapping = outside_file(&t, "secret.yaml", "schema: TOP-SECRET-SCHEMA\nstore: TOP-SECRET-STORE\nid: TOP-SECRET-ID\n");

        // A project schema that is a symlink out of the source.
        std::fs::create_dir_all(src.join("schemas/leak")).unwrap();
        symlink(&secret, src.join("schemas/leak/schema.yaml")).unwrap();
        t.write("changes/a/.openspec.yaml", "schema: leak\n");
        t.write("changes/a/proposal.md", "# p\n");
        // Change metadata that is a symlink out of the source.
        t.write("changes/b/proposal.md", "# p\n");
        symlink(&mapping, src.join("changes/b/.openspec.yaml")).unwrap();

        let json = serde_json::to_string(&t.scan()).unwrap();
        assert!(!json.contains("TOP-SECRET"), "{json}");
        assert_eq!(t.change("b").schema.as_deref(), Some("spec-driven"), "outside metadata counts as absent");

        // Project config and store identity pointing out of the source.
        let t2 = TempOpenSpec::new("symlink-yaml-config");
        let src2 = t2.openspec();
        std::fs::remove_dir_all(src2.join("changes")).unwrap();
        symlink(&mapping, src2.join("config.yaml")).unwrap();
        let planning = inspect_planning_root(&src2, &ScanOptions { global_data_dir: None });
        assert!(!format!("{planning:?}").contains("TOP-SECRET"), "{planning:?}");
        std::fs::create_dir_all(t2.0.join(".openspec-store")).unwrap();
        symlink(&mapping, t2.0.join(".openspec-store/store.yaml")).unwrap();
        let planning = inspect_planning_root(&src2, &ScanOptions { global_data_dir: None });
        assert!(!format!("{planning:?}").contains("TOP-SECRET"), "{planning:?}");
    }

    #[cfg(unix)]
    #[test]
    fn a_symlink_to_the_filesystem_root_is_not_walked() {
        use std::os::unix::fs::symlink;
        let t = TempOpenSpec::new("symlink-root");
        let src = t.openspec();
        t.write("changes/c/proposal.md", "# p\n");
        std::fs::create_dir_all(src.join("changes/c/specs")).unwrap();
        symlink("/", src.join("changes/c/specs/root")).unwrap();
        let started = std::time::Instant::now();
        let change = t.change("c");
        assert!(!change.has_specs);
        assert!(started.elapsed() < std::time::Duration::from_secs(5), "walked outside the source");
    }

    #[cfg(unix)]
    #[test]
    fn symlinks_inside_the_source_and_a_symlinked_source_still_work() {
        use std::os::unix::fs::symlink;
        let t = TempOpenSpec::new("symlink-in");
        let src = t.openspec();
        t.write("shared/auth.md", "## ADDED Requirements\n");
        t.write("changes/c/proposal.md", "# p\n\n## Why\n\nBecause.\n");
        std::fs::create_dir_all(src.join("changes/c/specs/auth")).unwrap();
        symlink(src.join("shared/auth.md"), src.join("changes/c/specs/auth/spec.md")).unwrap();
        symlink(src.join("shared"), src.join("changes/c/specs/shared-dir")).unwrap();

        let link = t.0.join("linked-openspec");
        symlink(&src, &link).unwrap();
        let options = ScanOptions { global_data_dir: None };
        let changes = scan_changes_with(&link, "repo", &options);
        let c = changes.iter().find(|c| c.name == "c").unwrap();
        assert!(c.has_proposal && c.has_specs);
        assert_eq!(c.summary.as_deref(), Some("Because."));
        let detail = get_change_detail_with(&link, "repo", "c", &options).unwrap();
        let paths: Vec<&str> = detail.specs.iter().map(|s| s.path.as_str()).collect();
        assert_eq!(paths, vec!["auth/spec.md", "shared-dir/auth.md"]);
    }

    fn idea_file(id: &str) -> String {
        format!("---\nid: {id}\ncreatedAt: 2026-01-01T00:00:00+00:00\nupdatedAt: 2026-01-01T00:00:00+00:00\n---\n\n# Title\n\nBody\n")
    }

    #[test]
    fn idea_ids_cannot_leave_the_ideas_folder() {
        let t = TempOpenSpec::new("idea-escape");
        let src = t.openspec();
        t.write("ideas/idea-1.md", &idea_file("idea-1"));
        let victim = outside_file(&t, "victim.md", &idea_file("victim"));
        let in_source = src.join("project.md");
        std::fs::write(&in_source, idea_file("project")).unwrap();

        for id in ["../../outside/victim", "../project", "/etc/passwd", ".hidden", "", "a/b", "a\\b"] {
            let deleted = delete_idea(&src, id);
            assert_eq!(deleted.unwrap_err().kind(), std::io::ErrorKind::InvalidInput, "delete {id:?}");
            let updated = update_idea(&src, "repo", id, "pwned", "x");
            assert_eq!(updated.unwrap_err().kind(), std::io::ErrorKind::InvalidInput, "update {id:?}");
            let saved = save_idea(&src, "repo", id, "t", "d", None);
            assert_eq!(saved.unwrap_err().kind(), std::io::ErrorKind::InvalidInput, "create {id:?}");
        }
        assert!(victim.exists());
        assert!(in_source.exists());
        assert!(!std::fs::read_to_string(&victim).unwrap().contains("pwned"));
    }

    #[test]
    fn a_planted_frontmatter_id_does_not_become_the_idea_id() {
        let t = TempOpenSpec::new("idea-planted");
        let src = t.openspec();
        let victim = outside_file(&t, "planted.md", &idea_file("planted"));
        t.write("ideas/evil.md", &idea_file("../../outside/planted"));
        t.write("ideas/.hidden.md", &idea_file("hidden"));

        let ideas = scan_ideas(&src, "repo");
        let ids: Vec<&str> = ideas.iter().map(|i| i.id.as_str()).collect();
        assert_eq!(ids, vec!["repo/evil"], "the id comes from the filename");

        // What the UI's delete button would send.
        let id = ideas[0].id.strip_prefix("repo/").unwrap();
        delete_idea(&src, id).unwrap();
        assert!(victim.exists());
        assert!(!src.join("ideas/evil.md").exists());
    }

    #[test]
    fn editing_an_idea_rewrites_its_id_from_the_filename() {
        let t = TempOpenSpec::new("idea-rewrite");
        let src = t.openspec();
        t.write("ideas/idea-7.md", &idea_file("something-else"));
        let idea = update_idea(&src, "repo", "idea-7", "New", "Text").unwrap();
        assert_eq!(idea.id, "repo/idea-7");
        let written = std::fs::read_to_string(src.join("ideas/idea-7.md")).unwrap();
        assert!(written.contains("id: idea-7\n"), "{written}");
        assert_eq!(scan_ideas(&src, "repo")[0].title, "New");
    }

    #[test]
    fn a_source_without_ideas_folder_answers_like_a_missing_idea() {
        let t = TempOpenSpec::new("idea-none");
        let src = t.openspec();
        assert!(scan_ideas(&src, "repo").is_empty());
        delete_idea(&src, "idea-1").unwrap();
        let update = update_idea(&src, "repo", "idea-1", "t", "d");
        assert_eq!(update.unwrap_err().kind(), std::io::ErrorKind::NotFound);
        assert!(save_idea(&src, "repo", "idea-1", "t", "d", None).is_ok(), "creates ideas/");
    }

    #[test]
    fn creating_an_idea_never_overwrites_a_file() {
        let t = TempOpenSpec::new("idea-create");
        let src = t.openspec();
        let created = save_idea(&src, "repo", "idea-1", "First", "one", None).unwrap();
        assert_eq!(created.id, "repo/idea-1");
        let again = save_idea(&src, "repo", "idea-1", "Second", "two", None);
        assert_eq!(again.unwrap_err().kind(), std::io::ErrorKind::AlreadyExists);
        assert_eq!(scan_ideas(&src, "repo")[0].title, "First");
    }

    #[cfg(unix)]
    #[test]
    fn symlinked_ideas_are_neither_listed_nor_written_through() {
        use std::os::unix::fs::symlink;
        let t = TempOpenSpec::new("idea-symlink");
        let src = t.openspec();
        let victim = outside_file(&t, "victim.md", &idea_file("victim"));
        std::fs::create_dir_all(src.join("ideas")).unwrap();
        symlink(&victim, src.join("ideas/link.md")).unwrap();
        assert!(scan_ideas(&src, "repo").is_empty());
        assert!(update_idea(&src, "repo", "link", "pwned", "x").is_err());
        assert!(!std::fs::read_to_string(&victim).unwrap().contains("pwned"));

        // The ideas folder itself pointing out of the source.
        let t2 = TempOpenSpec::new("idea-symlink-dir");
        let src2 = t2.openspec();
        let outside = victim.parent().unwrap();
        symlink(outside, src2.join("ideas")).unwrap();
        assert!(scan_ideas(&src2, "repo").is_empty());
        assert!(delete_idea(&src2, "victim").is_err());
        assert!(save_idea(&src2, "repo", "idea-9", "t", "d", None).is_err());
        assert!(victim.exists());
        assert!(!outside.join("idea-9.md").exists());
    }

    #[test]
    fn store_pointer_is_detected_and_resolved_through_the_registry() {
        let t = TempOpenSpec::new("pointer");
        std::fs::remove_dir_all(t.openspec().join("changes")).unwrap();
        t.write("config.yaml", "store: team-plans\n");

        let data = t.0.join("data");
        let no_registry = inspect_planning_root(&t.openspec(), &ScanOptions { global_data_dir: Some(data.clone()) });
        assert_eq!(no_registry.kind, PlanningKind::StorePointer);
        assert_eq!(no_registry.store_id.as_deref(), Some("team-plans"));
        assert!(no_registry.store_path.is_none());
        assert!(no_registry.problem.is_some());

        let store = t.0.join("team-plans");
        std::fs::create_dir_all(store.join("openspec").join("changes")).unwrap();
        std::fs::create_dir_all(data.join("stores")).unwrap();
        std::fs::write(
            data.join("stores").join("registry.yaml"),
            format!("version: 1\nstores:\n  team-plans:\n    backend:\n      type: git\n      local_path: {}\n", store.display()),
        )
        .unwrap();
        let resolved = inspect_planning_root(&t.openspec(), &ScanOptions { global_data_dir: Some(data) });
        assert_eq!(resolved.store_path, Some(store.join("openspec").display().to_string()));
        assert!(resolved.problem.is_none());

        // Once the repo has planning folders of its own, the pointer is ignored.
        std::fs::create_dir_all(t.openspec().join("changes")).unwrap();
        assert_eq!(inspect_planning_root(&t.openspec(), &ScanOptions::default()).kind, PlanningKind::Local);
    }
}
