//! A one-line description of a change for the board's cards.
//!
//! Display only: nothing here affects a change's state, and every failure
//! (unreadable file, odd YAML, no proposal) just yields `None`.

use super::contain::Root;
use serde_yaml::Value;
use std::path::Path;

/// Longest summary sent to the board; cards clamp to two lines anyway.
const MAX_SUMMARY_CHARS: usize = 240;

/// Headings whose first paragraph says what a change is for. OpenSpec's
/// proposal template opens with `## Why`; the others cover hand-written files.
const PURPOSE_HEADINGS: &[&str] = &["why", "motivation", "problem", "summary", "background", "context"];

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ChangeSummary {
    /// The proposal's own title, when it has a real one (`# Change: Add X`).
    /// OpenSpec 1.x templates title every proposal `# Proposal`, which is dropped.
    pub title: Option<String>,
    /// `goal:` from `.openspec.yaml`, else the first paragraph under the
    /// proposal's `## Why`, else its first paragraph.
    pub summary: Option<String>,
}

/// Files are read only while they stay inside `root` (the source folder).
pub fn summarize(change_dir: &Path, root: &Root) -> ChangeSummary {
    let goal = read_goal(change_dir, root);
    let proposal = root.read(&change_dir.join("proposal.md"));
    let (title, why) = proposal.as_deref().map(parse_proposal).unwrap_or_default();
    ChangeSummary {
        title,
        summary: goal.or(why).map(|s| truncate(&s, MAX_SUMMARY_CHARS)),
    }
}

/// `goal:` from `.openspec.yaml`, read leniently. Whether the file is valid is
/// `workflow::read_metadata`'s call; this never rejects anything.
fn read_goal(change_dir: &Path, root: &Root) -> Option<String> {
    let content = root.read(&change_dir.join(".openspec.yaml"))?;
    let parsed: Value = serde_yaml::from_str(&content).ok()?;
    match parsed.get("goal")? {
        Value::String(s) => non_empty(collapse_whitespace(s)),
        _ => None,
    }
}

/// Lines of a markdown file outside fenced code blocks.
fn prose_lines(markdown: &str) -> Vec<&str> {
    let mut in_fence = false;
    markdown
        .lines()
        .filter(|line| {
            let t = line.trim_start();
            if t.starts_with("```") || t.starts_with("~~~") {
                in_fence = !in_fence;
                return false;
            }
            !in_fence
        })
        .collect()
}

fn heading(line: &str) -> Option<(usize, &str)> {
    let t = line.trim_start();
    let level = t.chars().take_while(|&c| c == '#').count();
    if level == 0 || level > 6 {
        return None;
    }
    let rest = &t[level..];
    (rest.is_empty() || rest.starts_with(' ')).then(|| (level, rest.trim().trim_end_matches('#').trim()))
}

/// The title and purpose paragraph of a proposal.
fn parse_proposal(markdown: &str) -> (Option<String>, Option<String>) {
    let lines = prose_lines(markdown);

    let title = lines
        .iter()
        .find_map(|l| heading(l).filter(|(level, _)| *level == 1).map(|(_, text)| text))
        .and_then(meaningful_title);

    let purpose_start = lines.iter().position(|l| {
        heading(l).is_some_and(|(level, text)| {
            let text = clean_inline(text).to_lowercase();
            level >= 2 && PURPOSE_HEADINGS.iter().any(|h| text == *h || text.starts_with(&format!("{h} ")))
        })
    });
    let why = match purpose_start {
        Some(i) => first_paragraph(&lines[i + 1..]),
        None => first_paragraph(&lines),
    };
    (title, why)
}

fn meaningful_title(raw: &str) -> Option<String> {
    let text = clean_inline(raw);
    let lower = text.to_lowercase();
    let stripped = ["change:", "proposal:", "change proposal:"]
        .iter()
        .find_map(|p| lower.starts_with(p).then(|| text.get(p.len()..).unwrap_or("").trim().to_string()))
        .unwrap_or(text);
    match stripped.to_lowercase().as_str() {
        "" | "proposal" | "change" | "change proposal" => None,
        _ => Some(stripped),
    }
}

/// The first run of non-blank, non-heading lines, list markers removed.
fn first_paragraph(lines: &[&str]) -> Option<String> {
    let mut parts: Vec<String> = Vec::new();
    for line in lines {
        let t = line.trim();
        if heading(t).is_some() {
            if parts.is_empty() {
                continue;
            }
            break;
        }
        if t.is_empty() || t.starts_with("<!--") || t == "---" {
            if parts.is_empty() {
                continue;
            }
            break;
        }
        parts.push(clean_inline(strip_list_marker(t)));
    }
    non_empty(collapse_whitespace(&parts.join(" ")))
}

fn strip_list_marker(line: &str) -> &str {
    for marker in ["- [ ] ", "- [x] ", "- ", "* ", "+ ", "> "] {
        if let Some(rest) = line.strip_prefix(marker) {
            return rest;
        }
    }
    let digits = line.chars().take_while(char::is_ascii_digit).count();
    if digits > 0 {
        if let Some(rest) = line[digits..].strip_prefix(". ") {
            return rest;
        }
    }
    line
}

/// Plain text from inline markdown: links keep their text, emphasis and
/// code markers are dropped.
fn clean_inline(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut chars = text.chars().peekable();
    while let Some(c) = chars.next() {
        match c {
            '*' | '_' if chars.peek() == Some(&c) => {
                chars.next();
            }
            '`' => {}
            '[' if text_has_link_close(&chars) => {}
            ']' if chars.peek() == Some(&'(') => {
                // Skip the link target.
                for t in chars.by_ref() {
                    if t == ')' {
                        break;
                    }
                }
            }
            _ => out.push(c),
        }
    }
    out.trim().to_string()
}

/// Does a `](` follow, i.e. is the `[` just consumed the start of a link?
fn text_has_link_close(rest: &std::iter::Peekable<std::str::Chars<'_>>) -> bool {
    rest.clone().collect::<String>().find("](").is_some_and(|i| !rest.clone().take(i).any(|c| c == '['))
}

fn collapse_whitespace(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn non_empty(text: String) -> Option<String> {
    (!text.is_empty()).then_some(text)
}

fn truncate(text: &str, max: usize) -> String {
    if text.chars().count() <= max {
        return text.to_string();
    }
    let cut: String = text.chars().take(max).collect();
    let cut = match cut.rfind(' ') {
        Some(i) if i > max / 2 => &cut[..i],
        _ => cut.as_str(),
    };
    format!("{}…", cut.trim_end_matches([',', ';', ':', '.', ' ']))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn summarize(dir: &Path) -> ChangeSummary {
        super::summarize(dir, &Root::new(dir).unwrap())
    }

    fn change(files: &[(&str, &str)]) -> TempDir {
        let dir = TempDir::new().unwrap();
        for (name, content) in files {
            std::fs::write(dir.path().join(name), content).unwrap();
        }
        dir
    }

    #[test]
    fn goal_wins_over_the_proposal() {
        let dir = change(&[
            (".openspec.yaml", "schema: spec-driven\ngoal: Let shoppers share a wishlist\n  by link.\n"),
            ("proposal.md", "# Proposal\n\n## Why\n\nSomething else.\n"),
        ]);
        let s = summarize(dir.path());
        assert_eq!(s.summary.as_deref(), Some("Let shoppers share a wishlist by link."));
        assert_eq!(s.title, None, "the 1.x template title says nothing");
    }

    #[test]
    fn why_paragraph_of_a_1x_proposal() {
        let dir = change(&[(
            "proposal.md",
            "# Proposal\n\n## Why\n\nRefunds are **all-or-nothing** today. See [the issue](https://x.y/1)\nand `refund.rs`.\n\n## What Changes\n\n- Add refunds\n",
        )]);
        let s = summarize(dir.path());
        assert_eq!(s.summary.as_deref(), Some("Refunds are all-or-nothing today. See the issue and refund.rs."));
    }

    #[test]
    fn brackets_that_are_not_links_survive() {
        assert_eq!(clean_inline("read items[0] and [the docs](https://x.y)"), "read items[0] and the docs");
        assert_eq!(clean_inline("[draft] tidy up"), "[draft] tidy up");
    }

    #[test]
    fn legacy_change_title_and_list_paragraph() {
        let dir = change(&[(
            "proposal.md",
            "# Change: Add Model Selection\n\n## Why\nUsers need to:\n- See available models\n- Pick one\n\n## What\n",
        )]);
        let s = summarize(dir.path());
        assert_eq!(s.title.as_deref(), Some("Add Model Selection"));
        assert_eq!(s.summary.as_deref(), Some("Users need to: See available models Pick one"));
    }

    #[test]
    fn falls_back_to_the_first_paragraph_and_skips_code() {
        let dir = change(&[("proposal.md", "```md\n## Why\nnot this\n```\n# Faster search\n\nIndex the catalog nightly.\n")]);
        let s = summarize(dir.path());
        assert_eq!(s.title.as_deref(), Some("Faster search"));
        assert_eq!(s.summary.as_deref(), Some("Index the catalog nightly."));
    }

    #[test]
    fn nothing_written_and_broken_metadata_fail_soft() {
        assert_eq!(summarize(change(&[]).path()), ChangeSummary::default());
        let dir = change(&[(".openspec.yaml", "goal: [not, a, string]\n:::"), ("proposal.md", "# Proposal\n")]);
        assert_eq!(summarize(dir.path()), ChangeSummary::default());
    }

    #[test]
    fn long_summaries_are_cut_at_a_word() {
        let long = "word ".repeat(100);
        let dir = change(&[("proposal.md", &format!("## Why\n\n{long}\n"))]);
        let summary = summarize(dir.path()).summary.unwrap();
        assert!(summary.chars().count() <= MAX_SUMMARY_CHARS + 1);
        assert!(summary.ends_with("word…"), "{summary}");
    }
}
