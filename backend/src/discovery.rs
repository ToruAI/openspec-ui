//! Zero-config source discovery: find OpenSpec projects below a folder.
//!
//! A *source* is always an `openspec` directory (the parser joins `changes/`
//! and `specs/` onto it). For every root folder:
//!
//! 1. the root is itself an `openspec` directory → that is the source;
//! 2. the root contains `openspec/` → that is the source (a single repo);
//! 3. the root has both `changes/` and `specs/` → treated as an OpenSpec dir
//!    with a custom name (e.g. `example-openspec/`);
//! 4. otherwise the tree below is scanned, breadth-first, to a bounded depth,
//!    for repos whose `openspec/` looks real (has `changes/` or `specs/`);
//! 5. if that finds nothing and the root sits inside a git repo, the repo root
//!    (and folders on the way up to it) are checked, so running from `repo/src`
//!    still shows the repo's board.
//!
//! The scan never follows symlinks, skips hidden folders and well-known heavy
//! folders (`node_modules`, `target`, ...), stops descending once a repo with
//! OpenSpec is found, skips linked git worktrees (duplicates of a repo that is
//! usually found anyway) and gives up after [`MAX_DIRS`] folders.

use crate::config::SourceConfig;
use std::{
    collections::{HashMap, HashSet, VecDeque},
    path::{Path, PathBuf},
    time::{Duration, Instant},
};

/// Default number of folder levels below a root where a repo may sit.
pub const DEFAULT_DEPTH: usize = 3;

/// Upper bound on folders read during one scan, so `openspec-ui ~` stays fast.
pub const MAX_DIRS: usize = 20_000;

/// Folder names never worth descending into.
const SKIP_DIRS: &[&str] = &[
    "node_modules",
    "bower_components",
    "target",
    "dist",
    "build",
    "out",
    "vendor",
    "venv",
    "env",
    "__pycache__",
    "site-packages",
    "Pods",
    "DerivedData",
    // macOS / Windows home folders that never hold source code
    "Library",
    "Applications",
    "Music",
    "Movies",
    "Pictures",
    "Photos",
    "AppData",
];

#[derive(Debug, Default)]
pub struct Discovery {
    pub sources: Vec<SourceConfig>,
    /// Folders read while scanning.
    pub dirs_visited: usize,
    /// Linked git worktrees skipped as duplicates.
    pub worktrees_skipped: usize,
    /// True when the scan stopped at [`MAX_DIRS`].
    pub truncated: bool,
    pub elapsed: Duration,
}

/// `dir` has the shape of an OpenSpec directory.
fn has_openspec_content(dir: &Path) -> bool {
    dir.join("changes").is_dir() || dir.join("specs").is_dir()
}

/// `repo/openspec` if it exists and looks real.
fn real_openspec_in(repo: &Path) -> Option<PathBuf> {
    let candidate = repo.join("openspec");
    (candidate.is_dir() && has_openspec_content(&candidate)).then_some(candidate)
}

/// A linked worktree has a `.git` *file* pointing into `<main>/.git/worktrees/`.
/// Submodules also have a `.git` file, but it points into `.git/modules/`.
fn is_linked_worktree(repo: &Path) -> bool {
    let git = repo.join(".git");
    if !git.is_file() {
        return false;
    }
    std::fs::read_to_string(git)
        .map(|s| s.contains("/worktrees/") || s.contains("\\worktrees\\"))
        .unwrap_or(false)
}

fn skip_dir(name: &str) -> bool {
    name.starts_with('.') || name.ends_with(".app") || SKIP_DIRS.contains(&name)
}

fn file_name(p: &Path) -> String {
    p.file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| p.display().to_string())
}

/// What a root folder directly is, before any scanning.
fn direct_source(root: &Path) -> Option<PathBuf> {
    if root.file_name().is_some_and(|n| n == "openspec") {
        return Some(root.to_path_buf());
    }
    let nested = root.join("openspec");
    if nested.is_dir() {
        return Some(nested);
    }
    if root.join("changes").is_dir() && root.join("specs").is_dir() {
        return Some(root.to_path_buf());
    }
    None
}

/// Breadth-first scan below `root`. Returns openspec dirs found.
fn scan(root: &Path, max_depth: usize, out: &mut Discovery) -> Vec<PathBuf> {
    let mut found = Vec::new();
    let mut queue = VecDeque::from([(root.to_path_buf(), 0usize)]);

    while let Some((dir, depth)) = queue.pop_front() {
        if out.dirs_visited >= MAX_DIRS {
            out.truncated = true;
            break;
        }
        out.dirs_visited += 1;

        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue; // permission denied etc.
        };
        let mut children: Vec<PathBuf> = entries
            .filter_map(Result::ok)
            // file_type() does not follow symlinks
            .filter(|e| e.file_type().map(|t| t.is_dir()).unwrap_or(false))
            .filter(|e| !skip_dir(&e.file_name().to_string_lossy()))
            .map(|e| e.path())
            .collect();
        children.sort();

        for child in children {
            if let Some(openspec) = real_openspec_in(&child) {
                if is_linked_worktree(&child) {
                    tracing::debug!("skipping git worktree {:?}", child);
                    out.worktrees_skipped += 1;
                } else {
                    found.push(openspec);
                }
                continue; // do not descend into a repo that has OpenSpec
            }
            if depth + 1 < max_depth {
                queue.push_back((child, depth + 1));
            }
        }
    }
    found
}

/// Walk up from `root` to the enclosing git repo root looking for `openspec/`.
fn enclosing_repo_source(root: &Path) -> Option<PathBuf> {
    // Only inside a git repo: never wander up into unrelated parent folders.
    // (When the root is itself a repo root, there is nothing above to check.)
    let repo_root = root.ancestors().find(|d| d.join(".git").exists())?;
    root.ancestors()
        .skip(1)
        .take_while(|d| d.starts_with(repo_root))
        .find_map(real_openspec_in)
}

/// Display name for a source dir: the repo folder, or the dir itself when it is
/// not literally called `openspec`.
fn base_name(openspec_dir: &Path) -> String {
    if openspec_dir.file_name().is_some_and(|n| n == "openspec") {
        openspec_dir
            .parent()
            .map(file_name)
            .unwrap_or_else(|| "openspec".to_string())
    } else {
        file_name(openspec_dir)
    }
}

/// Names must be unique (they double as source ids) and must not contain `/`
/// (ids are split on the first `/`). Clashes become `api (work)`, `api (personal)`
/// using the folder above the repo; anything still clashing gets ` 2`, ` 3`.
pub fn unique_names(dirs: &[PathBuf]) -> Vec<String> {
    let bases: Vec<String> = dirs.iter().map(|d| base_name(d).replace('/', "-")).collect();
    let mut counts: HashMap<&str, usize> = HashMap::new();
    for b in &bases {
        *counts.entry(b.as_str()).or_default() += 1;
    }

    let mut names: Vec<String> = dirs
        .iter()
        .zip(&bases)
        .map(|(dir, base)| {
            if counts[base.as_str()] == 1 {
                return base.clone();
            }
            let repo = if dir.file_name().is_some_and(|n| n == "openspec") {
                dir.parent()
            } else {
                Some(dir.as_path())
            };
            match repo.and_then(Path::parent).and_then(Path::file_name) {
                Some(parent) => format!("{} ({})", base, parent.to_string_lossy().replace('/', "-")),
                None => base.clone(),
            }
        })
        .collect();

    let mut seen: HashMap<String, usize> = HashMap::new();
    for name in names.iter_mut() {
        let n = seen.entry(name.clone()).or_default();
        *n += 1;
        if *n > 1 {
            *name = format!("{} {}", name, n);
        }
    }
    names
}

/// Discover sources below `roots`. Roots must exist (the caller reports
/// missing paths); they are canonicalized here.
pub fn discover(roots: &[PathBuf], max_depth: usize) -> Discovery {
    let started = Instant::now();
    let mut out = Discovery::default();
    let mut dirs: Vec<PathBuf> = Vec::new();

    for root in roots {
        let root = root.canonicalize().unwrap_or_else(|_| root.clone());
        if let Some(dir) = direct_source(&root) {
            dirs.push(dir);
            continue;
        }
        let found = scan(&root, max_depth, &mut out);
        if found.is_empty() {
            if let Some(dir) = enclosing_repo_source(&root) {
                dirs.push(dir);
            }
        } else {
            dirs.extend(found);
        }
    }

    // De-duplicate (overlapping roots, symlinks) and keep a stable order.
    let mut seen = HashSet::new();
    let mut unique: Vec<PathBuf> = dirs
        .into_iter()
        .map(|d| d.canonicalize().unwrap_or(d))
        .filter(|d| seen.insert(d.clone()))
        .collect();
    unique.sort();

    let names = unique_names(&unique);
    out.sources = unique
        .iter()
        .zip(names)
        .map(|(dir, name)| SourceConfig {
            name,
            path: dir.display().to_string(),
        })
        .collect();
    out.elapsed = started.elapsed();
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn repo(base: &Path, rel: &str) -> PathBuf {
        let r = base.join(rel);
        fs::create_dir_all(r.join("openspec").join("changes")).unwrap();
        fs::create_dir_all(r.join("openspec").join("specs")).unwrap();
        r
    }

    fn names(d: &Discovery) -> Vec<&str> {
        d.sources.iter().map(|s| s.name.as_str()).collect()
    }

    fn canon(p: &Path) -> String {
        p.canonicalize().unwrap().display().to_string()
    }

    #[test]
    fn root_that_is_a_repo_is_the_only_source() {
        let tmp = tempfile::tempdir().unwrap();
        let r = repo(tmp.path(), "api");
        repo(&r, "nested/inner"); // ignored: the root itself is a repo
        let d = discover(std::slice::from_ref(&r), DEFAULT_DEPTH);
        assert_eq!(names(&d), vec!["api"]);
        assert_eq!(d.sources[0].path, canon(&r.join("openspec")));
    }

    #[test]
    fn root_that_is_an_openspec_dir_is_used_directly() {
        let tmp = tempfile::tempdir().unwrap();
        let r = repo(tmp.path(), "web");
        let d = discover(&[r.join("openspec")], DEFAULT_DEPTH);
        assert_eq!(names(&d), vec!["web"]);

        // a custom-named openspec dir with changes/ + specs/
        let custom = tmp.path().join("example-openspec");
        fs::create_dir_all(custom.join("changes")).unwrap();
        fs::create_dir_all(custom.join("specs")).unwrap();
        let d = discover(std::slice::from_ref(&custom), DEFAULT_DEPTH);
        assert_eq!(names(&d), vec!["example-openspec"]);
        assert_eq!(d.sources[0].path, canon(&custom));
    }

    #[test]
    fn scans_below_root_and_skips_noise() {
        let tmp = tempfile::tempdir().unwrap();
        repo(tmp.path(), "api");
        repo(tmp.path(), "group/web");
        repo(tmp.path(), "node_modules/pkg"); // skipped dir
        repo(tmp.path(), ".hidden/secret"); // hidden
        repo(tmp.path(), "a/b/c/too-deep"); // beyond depth 3
        // an `openspec/` without changes/ or specs/ does not count when scanning
        fs::create_dir_all(tmp.path().join("fake/openspec")).unwrap();
        // a plain folder without openspec
        fs::create_dir_all(tmp.path().join("notes/docs")).unwrap();

        let d = discover(&[tmp.path().to_path_buf()], DEFAULT_DEPTH);
        assert_eq!(names(&d), vec!["api", "web"]);
        assert!(!d.truncated);

        let deeper = discover(&[tmp.path().to_path_buf()], 4);
        // sorted by path: a/b/c/too-deep < api < group/web
        assert_eq!(names(&deeper), vec!["too-deep", "api", "web"]);
    }

    #[test]
    fn does_not_descend_into_found_repos() {
        let tmp = tempfile::tempdir().unwrap();
        let api = repo(tmp.path(), "api");
        repo(&api, "packages/sub");
        let d = discover(&[tmp.path().to_path_buf()], DEFAULT_DEPTH);
        assert_eq!(names(&d), vec!["api"]);
    }

    #[test]
    fn skips_linked_worktrees_but_not_submodules() {
        let tmp = tempfile::tempdir().unwrap();
        let main = repo(tmp.path(), "api");
        fs::create_dir_all(main.join(".git")).unwrap();
        let wt = repo(tmp.path(), "api-feature");
        fs::write(wt.join(".git"), "gitdir: /x/api/.git/worktrees/api-feature\n").unwrap();
        let sub = repo(tmp.path(), "lib");
        fs::write(sub.join(".git"), "gitdir: ../.git/modules/lib\n").unwrap();

        let d = discover(&[tmp.path().to_path_buf()], DEFAULT_DEPTH);
        assert_eq!(names(&d), vec!["api", "lib"]);
        assert_eq!(d.worktrees_skipped, 1);

        // pointing at a worktree explicitly still works
        let d = discover(&[wt], DEFAULT_DEPTH);
        assert_eq!(names(&d), vec!["api-feature"]);
    }

    #[test]
    fn root_inside_hidden_or_worktree_folder_still_works() {
        // Filters apply below the root only, never to the root or its ancestors.
        let tmp = tempfile::tempdir().unwrap();
        let wt = repo(tmp.path(), ".claude/worktrees/agent-1");
        fs::write(wt.join(".git"), "gitdir: /x/.git/worktrees/agent-1\n").unwrap();
        let d = discover(&[tmp.path().join(".claude/worktrees")], DEFAULT_DEPTH);
        // agent-1 is a worktree found by scanning → skipped as duplicate
        assert!(d.sources.is_empty());
        let d = discover(std::slice::from_ref(&wt), DEFAULT_DEPTH);
        assert_eq!(names(&d), vec!["agent-1"]);
    }

    #[test]
    fn duplicate_names_get_readable_suffixes() {
        let tmp = tempfile::tempdir().unwrap();
        repo(tmp.path(), "work/api");
        repo(tmp.path(), "personal/api");
        repo(tmp.path(), "web");
        let d = discover(&[tmp.path().to_path_buf()], DEFAULT_DEPTH);
        assert_eq!(names(&d), vec!["api (personal)", "web", "api (work)"]);
        assert!(d.sources.iter().all(|s| !s.name.contains('/')));
    }

    #[test]
    fn identical_names_and_parents_get_numbers() {
        let dirs = vec![
            PathBuf::from("/a/x/api/openspec"),
            PathBuf::from("/b/x/api/openspec"),
        ];
        assert_eq!(unique_names(&dirs), vec!["api (x)", "api (x) 2"]);
    }

    #[test]
    fn overlapping_roots_are_deduplicated() {
        let tmp = tempfile::tempdir().unwrap();
        let api = repo(tmp.path(), "api");
        let d = discover(&[tmp.path().to_path_buf(), api.clone(), api.join("openspec")], DEFAULT_DEPTH);
        assert_eq!(names(&d), vec!["api"]);
    }

    #[test]
    fn subfolder_of_a_repo_finds_the_repo() {
        let tmp = tempfile::tempdir().unwrap();
        let api = repo(tmp.path(), "api");
        fs::create_dir_all(api.join(".git")).unwrap();
        fs::create_dir_all(api.join("src/deep")).unwrap();
        let d = discover(&[api.join("src/deep")], DEFAULT_DEPTH);
        assert_eq!(names(&d), vec!["api"]);

        // but not across a repo boundary
        let other = tmp.path().join("api/vendored");
        fs::create_dir_all(other.join(".git")).unwrap();
        fs::create_dir_all(other.join("src")).unwrap();
        let d = discover(&[other.join("src")], DEFAULT_DEPTH);
        assert!(d.sources.is_empty());
    }

    #[test]
    fn empty_folder_finds_nothing() {
        let tmp = tempfile::tempdir().unwrap();
        let d = discover(&[tmp.path().to_path_buf()], DEFAULT_DEPTH);
        assert!(d.sources.is_empty());
        assert_eq!(d.dirs_visited, 1);
    }

    #[test]
    fn scan_is_bounded() {
        let tmp = tempfile::tempdir().unwrap();
        for i in 0..30 {
            fs::create_dir_all(tmp.path().join(format!("d{i}/e"))).unwrap();
        }
        let mut out = Discovery {
            dirs_visited: MAX_DIRS - 5,
            ..Default::default()
        };
        scan(tmp.path(), DEFAULT_DEPTH, &mut out);
        assert!(out.truncated);
        assert_eq!(out.dirs_visited, MAX_DIRS);
    }
}
