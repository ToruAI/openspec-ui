use regex::Regex;
use serde::{Deserialize, Serialize};
use std::path::Path;
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize)]
pub struct TaskStats {
    pub total: usize,
    pub done: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ChangeStatus {
    Draft,
    Todo,
    InProgress,
    Done,
    Archived,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Change {
    pub id: String,
    pub name: String,
    pub source_id: String,
    pub status: ChangeStatus,
    pub has_proposal: bool,
    pub has_specs: bool,
    pub has_tasks: bool,
    pub has_design: bool,
    pub task_stats: Option<TaskStats>,
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
    id: String,
    #[serde(default)]
    project_id: Option<String>,
    created_at: String,
    updated_at: String,
}

fn parse_idea_frontmatter(content: &str) -> Option<IdeaFrontmatter> {
    let lines: Vec<&str> = content.lines().collect();
    
    if !lines.get(0).map(|l| l.trim() == "---").unwrap_or(false) {
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

/// Parse tasks.md content and count [x] vs [ ] checkboxes
pub fn parse_task_stats(content: &str) -> TaskStats {
    let done_re = Regex::new(r"- \[x\]").unwrap();
    let todo_re = Regex::new(r"- \[ \]").unwrap();

    let done = done_re.find_iter(content).count();
    let todo = todo_re.find_iter(content).count();

    TaskStats {
        total: done + todo,
        done,
    }
}

/// Compute change status from artifacts and task stats
fn compute_status(has_tasks: bool, task_stats: &Option<TaskStats>, is_archived: bool) -> ChangeStatus {
    if is_archived {
        return ChangeStatus::Archived;
    }

    match (has_tasks, task_stats) {
        (false, _) => ChangeStatus::Draft,
        (true, Some(stats)) if stats.done == 0 => ChangeStatus::Todo,
        (true, Some(stats)) if stats.done == stats.total && stats.total > 0 => ChangeStatus::Done,
        (true, Some(_)) => ChangeStatus::InProgress,
        (true, None) => ChangeStatus::Draft,
    }
}

/// Scan a single change directory and return Change
fn scan_change(change_path: &Path, source_id: &str, is_archived: bool) -> Option<Change> {
    let name = change_path.file_name()?.to_str()?;

    // Skip if not a directory
    if !change_path.is_dir() {
        return None;
    }

    let proposal_path = change_path.join("proposal.md");
    let tasks_path = change_path.join("tasks.md");
    let design_path = change_path.join("design.md");
    let specs_path = change_path.join("specs");

    let has_proposal = proposal_path.exists();
    let has_tasks = tasks_path.exists();
    let has_design = design_path.exists();
    let has_specs = specs_path.exists() && specs_path.is_dir();

    // Only include if it has at least a proposal
    if !has_proposal {
        return None;
    }

    let task_stats = if has_tasks {
        std::fs::read_to_string(&tasks_path)
            .ok()
            .map(|content| parse_task_stats(&content))
    } else {
        None
    };

    let status = compute_status(has_tasks, &task_stats, is_archived);

    Some(Change {
        id: format!("{}/{}", source_id, name),
        name: name.to_string(),
        source_id: source_id.to_string(),
        status,
        has_proposal,
        has_specs,
        has_tasks,
        has_design,
        task_stats,
    })
}

/// Scan changes/ directory for all changes
pub fn scan_changes(source_path: &Path, source_id: &str) -> Vec<Change> {
    let mut changes = Vec::new();

    let changes_path = source_path.join("changes");
    if !changes_path.exists() {
        return changes;
    }

    // Scan active changes
    for entry in std::fs::read_dir(&changes_path).into_iter().flatten() {
        if let Ok(entry) = entry {
            let path = entry.path();
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

            // Skip archive directory
            if name == "archive" {
                continue;
            }

            if let Some(change) = scan_change(&path, source_id, false) {
                changes.push(change);
            }
        }
    }

    // Scan archived changes
    let archive_path = changes_path.join("archive");
    if archive_path.exists() {
        for entry in std::fs::read_dir(&archive_path).into_iter().flatten() {
            if let Ok(entry) = entry {
                let path = entry.path();
                if let Some(change) = scan_change(&path, source_id, true) {
                    changes.push(change);
                }
            }
        }
    }

    changes
}

/// Get full details for a specific change
pub fn get_change_detail(source_path: &Path, source_id: &str, change_name: &str) -> Option<ChangeDetail> {
    // Try active changes first
    let mut change_path = source_path.join("changes").join(change_name);
    let mut is_archived = false;

    if !change_path.exists() {
        // Try archive - need to search for name ending
        let archive_path = source_path.join("changes").join("archive");
        if archive_path.exists() {
            for entry in std::fs::read_dir(&archive_path).into_iter().flatten() {
                if let Ok(entry) = entry {
                    let name = entry.file_name();
                    let name_str = name.to_string_lossy();
                    if name_str.ends_with(change_name) || name_str == change_name {
                        change_path = entry.path();
                        is_archived = true;
                        break;
                    }
                }
            }
        }
    }

    if !change_path.exists() {
        return None;
    }

    let proposal_path = change_path.join("proposal.md");
    let tasks_path = change_path.join("tasks.md");
    let design_path = change_path.join("design.md");
    let specs_path = change_path.join("specs");

    let proposal = std::fs::read_to_string(&proposal_path).ok();
    let design = std::fs::read_to_string(&design_path).ok();

    let tasks = std::fs::read_to_string(&tasks_path).ok().map(|raw| {
        let stats = parse_task_stats(&raw);
        TasksContent { raw, stats }
    });

    let has_tasks = tasks.is_some();
    let task_stats = tasks.as_ref().map(|t| t.stats.clone());
    let status = compute_status(has_tasks, &task_stats, is_archived);

    // Scan specs within the change
    let mut specs = Vec::new();
    if specs_path.exists() {
        for entry in WalkDir::new(&specs_path).min_depth(1) {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.is_file() && path.extension().map_or(false, |e| e == "md") {
                    let relative = path.strip_prefix(&specs_path).unwrap_or(path);
                    if let Ok(content) = std::fs::read_to_string(path) {
                        specs.push(SpecContent {
                            path: relative.display().to_string(),
                            content,
                        });
                    }
                }
            }
        }
    }

    let name = change_path.file_name()?.to_str()?.to_string();

    Some(ChangeDetail {
        id: format!("{}/{}", source_id, change_name),
        name,
        source_id: source_id.to_string(),
        status,
        proposal,
        design,
        specs,
        tasks,
    })
}

/// Scan specs/ directory for source-of-truth specs
pub fn scan_specs(source_path: &Path, source_id: &str) -> Vec<Spec> {
    let mut specs = Vec::new();
    let specs_path = source_path.join("specs");

    // Include root-level markdown files
    for entry in std::fs::read_dir(source_path).into_iter().flatten() {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_file() && path.extension().map_or(false, |e| e == "md") {
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
    }

    // Scan specs/ directory
    if specs_path.exists() {
        for entry in WalkDir::new(&specs_path).min_depth(1) {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.is_file() && path.extension().map_or(false, |e| e == "md") {
                    let relative = path.strip_prefix(&specs_path).unwrap_or(path);
                    let path_str = relative.display().to_string();
                    let id = format!("{}/{}", source_id, path_str.replace("/spec.md", "").replace(".md", ""));
                    specs.push(Spec {
                        id,
                        source_id: source_id.to_string(),
                        path: path_str,
                    });
                }
            }
        }
    }

    specs
}

/// Get content for a specific spec
pub fn get_spec_detail(source_path: &Path, source_id: &str, spec_path: &str) -> Option<SpecDetail> {
    // First try root-level file
    let mut full_path = source_path.join(spec_path);

    if !full_path.exists() {
        // Then try specs/ directory
        full_path = source_path.join("specs").join(spec_path);
        if !full_path.exists() {
            return None;
        }
    }

    let content = std::fs::read_to_string(&full_path).ok()?;
    let id = format!("{}/{}", source_id, spec_path.replace("/spec.md", "").replace(".md", ""));

    Some(SpecDetail {
        id,
        source_id: source_id.to_string(),
        path: spec_path.to_string(),
        content,
    })
}

/// Scan ideas/ directory for all ideas
pub fn scan_ideas(source_path: &Path, source_id: &str) -> Vec<Idea> {
    let mut ideas = Vec::new();
    let ideas_path = source_path.join("ideas");

    if !ideas_path.exists() || !ideas_path.is_dir() {
        return ideas;
    }

    for entry in std::fs::read_dir(&ideas_path).into_iter().flatten() {
        if let Ok(entry) = entry {
            let path = entry.path();
            
            if path.is_file() && path.extension().map_or(false, |e| e == "md") {
                if let Some(content) = std::fs::read_to_string(&path).ok() {
                    if let Some(frontmatter) = parse_idea_frontmatter(&content) {
                        let (title, description) = extract_idea_title_and_description(&content);
                        ideas.push(Idea {
                            id: format!("{}/{}", source_id, frontmatter.id),
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
        }
    }

    ideas.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    ideas
}

/// Save idea to file system
pub fn save_idea(source_path: &Path, source_id: &str, id: &str, title: &str, description: &str, project_id: Option<&str>) -> std::io::Result<Idea> {
    let ideas_path = source_path.join("ideas");
    
    if !ideas_path.exists() {
        std::fs::create_dir_all(&ideas_path)?;
    }

    let now = chrono::Utc::now().to_rfc3339();
    
    let project_id_line = if let Some(pid) = project_id {
        format!("projectId: {}", pid)
    } else {
        String::new()
    };
    
    let content = format!(
        r#"---
id: {}
{}
createdAt: {}
updatedAt: {}
---

# {}

{}
"#,
        id, project_id_line, now, now, title, description
    );

    let idea_path = ideas_path.join(format!("{}.md", id));
    std::fs::write(&idea_path, content)?;

    Ok(Idea {
        id: id.to_string(),
        source_id: source_id.to_string(),
        project_id: project_id.map(|s| s.to_string()),
        title: title.to_string(),
        description: description.to_string(),
        created_at: now.clone(),
        updated_at: now,
    })
}

/// Delete idea from file system
pub fn delete_idea(source_path: &Path, id: &str) -> std::io::Result<()> {
    let idea_path = source_path.join("ideas").join(format!("{}.md", id));

    if idea_path.exists() {
        std::fs::remove_file(idea_path)?;
    }

    Ok(())
}

/// Update idea in file system
pub fn update_idea(source_path: &Path, source_id: &str, id: &str, title: &str, description: &str) -> std::io::Result<Idea> {
    let idea_path = source_path.join("ideas").join(format!("{}.md", id));

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

    let project_id_line = if let Some(ref pid) = frontmatter.project_id {
        format!("projectId: {}", pid)
    } else {
        String::new()
    };

    let content = format!(
        r#"---
id: {}
{}
createdAt: {}
updatedAt: {}
---

# {}

{}
"#,
        id, project_id_line, frontmatter.created_at, now, title, description
    );

    std::fs::write(&idea_path, content)?;

    Ok(Idea {
        id: id.to_string(),
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

## 2. Frontend
- [ ] 2.1 Pending
- [ ] 2.2 Also pending
"#;
        let stats = parse_task_stats(content);
        assert_eq!(stats.total, 5);
        assert_eq!(stats.done, 2);
    }

    #[test]
    fn test_compute_status() {
        // No tasks = Draft
        assert_eq!(compute_status(false, &None, false), ChangeStatus::Draft);

        // Tasks with 0 done = Todo
        assert_eq!(
            compute_status(true, &Some(TaskStats { total: 5, done: 0 }), false),
            ChangeStatus::Todo
        );

        // Tasks partially done = InProgress
        assert_eq!(
            compute_status(true, &Some(TaskStats { total: 5, done: 2 }), false),
            ChangeStatus::InProgress
        );

        // All tasks done = Done
        assert_eq!(
            compute_status(true, &Some(TaskStats { total: 5, done: 5 }), false),
            ChangeStatus::Done
        );

        // Archived = Archived regardless
        assert_eq!(
            compute_status(false, &None, true),
            ChangeStatus::Archived
        );

        // Archived even if all tasks done
        assert_eq!(
            compute_status(true, &Some(TaskStats { total: 5, done: 5 }), true),
            ChangeStatus::Archived
        );
    }
}
