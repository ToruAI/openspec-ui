//! Keeping file access inside a source folder.
//!
//! Every path that comes from a request (a spec name, an idea id) or from repo
//! content (a symlink, a glob match) goes through [`Root`] before it is read,
//! written or deleted: the root is canonicalised once (a source path may itself
//! be a symlink), and a path counts only when its canonical form stays under it.
//! A symlink that points out of the source is treated as if it did not exist.

use std::path::{Path, PathBuf};

/// A plain relative path: not absolute, no drive prefix, no backslash or NUL,
/// and no empty, `.` or `..` segment. Request-supplied names must pass this
/// before they are joined to anything.
pub fn is_plain_relative(rel: &str) -> bool {
    let b = rel.as_bytes();
    let drive = b.len() >= 2 && b[1] == b':' && b[0].is_ascii_alphabetic();
    !rel.is_empty()
        && !drive
        && !rel.contains(['\\', '\0'])
        && rel.split('/').all(|segment| !matches!(segment, "" | "." | ".."))
}

/// A directory resolved to its canonical path.
#[derive(Debug, Clone)]
pub struct Root(PathBuf);

impl Root {
    /// `None` when `dir` does not exist or is not a directory.
    pub fn new(dir: &Path) -> Option<Root> {
        let canonical = dir.canonicalize().ok()?;
        canonical.is_dir().then_some(Root(canonical))
    }

    pub fn path(&self) -> &Path {
        &self.0
    }

    /// Canonical form of `path` when it exists and stays under this root.
    pub fn contain(&self, path: &Path) -> Option<PathBuf> {
        let canonical = path.canonicalize().ok()?;
        canonical.starts_with(&self.0).then_some(canonical)
    }

    /// `path` itself when it is a regular file (after following symlinks)
    /// that stays under this root.
    pub fn file(&self, path: &Path) -> Option<PathBuf> {
        self.contain(path).filter(|c| c.is_file()).map(|_| path.to_path_buf())
    }

    /// Read a file that stays under this root.
    pub fn read(&self, path: &Path) -> Option<String> {
        let canonical = self.contain(path)?;
        if !canonical.is_file() {
            return None;
        }
        std::fs::read_to_string(canonical).ok()
    }

    /// Resolve a request-supplied relative path under this root. `None` when
    /// it is not a plain relative path, does not exist, or leaves the root.
    pub fn join(&self, rel: &str) -> Option<PathBuf> {
        if !is_plain_relative(rel) {
            return None;
        }
        self.contain(&self.0.join(rel))
    }

    /// A subdirectory that stays under this root.
    pub fn sub(&self, rel: &str) -> Option<Root> {
        self.join(rel).filter(|p| p.is_dir()).map(Root)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plain_relative_paths_only() {
        for ok in ["auth", "auth/spec.md", "a.b/c-d_e", "x..y"] {
            assert!(is_plain_relative(ok), "{ok}");
        }
        for bad in [
            "",
            "/etc/passwd",
            "//etc/passwd",
            "../x",
            "a/../../x",
            "a/./b",
            "a//b",
            "a/",
            ".",
            "..",
            "C:/x",
            "c:x",
            "a\\..\\x",
            "a\0b",
        ] {
            assert!(!is_plain_relative(bad), "{bad:?}");
        }
    }

    #[test]
    fn join_stays_inside_and_follows_only_inner_symlinks() {
        let tmp = tempfile::tempdir().unwrap();
        let root_dir = tmp.path().join("root");
        let outside = tmp.path().join("outside");
        std::fs::create_dir_all(root_dir.join("specs/auth")).unwrap();
        std::fs::create_dir_all(&outside).unwrap();
        std::fs::write(root_dir.join("specs/auth/spec.md"), "inside").unwrap();
        std::fs::write(outside.join("secret.md"), "secret").unwrap();

        let root = Root::new(&root_dir).unwrap();
        assert!(root.join("specs/auth/spec.md").is_some());
        assert!(root.join("../outside/secret.md").is_none());
        assert!(root.join(outside.join("secret.md").to_str().unwrap()).is_none(), "absolute");
        assert!(root.join("specs/missing.md").is_none());

        #[cfg(unix)]
        {
            use std::os::unix::fs::symlink;
            symlink(outside.join("secret.md"), root_dir.join("leak.md")).unwrap();
            symlink(&outside, root_dir.join("specs/out")).unwrap();
            symlink(root_dir.join("specs/auth/spec.md"), root_dir.join("alias.md")).unwrap();
            assert!(root.join("leak.md").is_none(), "file symlink out of the root");
            assert!(root.read(&root_dir.join("leak.md")).is_none());
            assert!(root.join("specs/out/secret.md").is_none(), "dir symlink out of the root");
            assert_eq!(root.read(&root_dir.join("alias.md")).as_deref(), Some("inside"));

            // The root itself may be a symlink: it is canonicalised once.
            let link = tmp.path().join("link-to-root");
            symlink(&root_dir, &link).unwrap();
            let via_link = Root::new(&link).unwrap();
            assert_eq!(via_link.read(&link.join("specs/auth/spec.md")).as_deref(), Some("inside"));
            assert!(via_link.read(&link.join("leak.md")).is_none());
        }
    }
}
