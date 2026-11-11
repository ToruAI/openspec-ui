//! Task checkbox counting, ported from OpenSpec's `TASK_LINE_PATTERN`
//! (`src/utils/task-progress.ts`):
//!
//! ```text
//! /^\s*(?:[-*+]|\d{1,9}[.)])\s*\[(?:\s*([^\]\s]?)\s*\](?![([])|\s+\])\s*(.*)/
//! ```
//!
//! A task is a list item (`-`, `*`, `+`, or `1.` / `1)` with up to nine
//! digits), optionally indented, carrying a checkbox with at most one
//! non-space marker. Only `x`/`X` means done; any other marker (`[~]`, `[]`,
//! `[ ]`) is open. A box followed by `(` or `[` is a Markdown link, not a task,
//! unless the box holds only whitespace. Every matching line counts, including
//! lines inside code fences and HTML comments, exactly as OpenSpec counts them.
//!
//! The `regex` crate has no lookahead, so the line is matched by hand.

use super::TaskStats;

/// JavaScript's `\s`: ECMAScript WhiteSpace + LineTerminator. Differs from
/// `char::is_whitespace` (Unicode White_Space) in two places: it includes
/// U+FEFF (byte-order mark) and excludes U+0085.
fn is_js_space(c: char) -> bool {
    matches!(
        c,
        '\t' | '\n' | '\u{0B}' | '\u{0C}' | '\r' | ' ' | '\u{A0}' | '\u{1680}' | '\u{2000}'
            ..='\u{200A}' | '\u{2028}' | '\u{2029}' | '\u{202F}' | '\u{205F}' | '\u{3000}' | '\u{FEFF}'
    )
}

/// `Some(done)` when the line is a task line, `None` otherwise.
pub fn parse_task_line(line: &str) -> Option<bool> {
    let mut chars = line.chars().peekable();

    // ^\s*
    while chars.peek().is_some_and(|c| is_js_space(*c)) {
        chars.next();
    }

    // (?:[-*+]|\d{1,9}[.)])
    match chars.next()? {
        '-' | '*' | '+' => {}
        c if c.is_ascii_digit() => {
            let mut digits = 1;
            loop {
                match chars.next()? {
                    d if d.is_ascii_digit() => {
                        digits += 1;
                        if digits > 9 {
                            return None;
                        }
                    }
                    '.' | ')' => break,
                    _ => return None,
                }
            }
        }
        _ => return None,
    }

    // \s*\[
    while chars.peek().is_some_and(|c| is_js_space(*c)) {
        chars.next();
    }
    if chars.next()? != '[' {
        return None;
    }

    // Inside the box: whitespace, at most one marker, whitespace, `]`.
    let mut leading_space = 0usize;
    while chars.peek().is_some_and(|c| is_js_space(*c)) {
        chars.next();
        leading_space += 1;
    }
    let marker = match chars.next()? {
        ']' => None,
        // JavaScript regexes without the `u` flag see an astral character as
        // two UTF-16 units, so `[^\]\s]?` takes half of it and the `]` never
        // follows: not a task.
        c if (c as u32) > 0xFFFF => return None,
        c => {
            while chars.peek().is_some_and(|c| is_js_space(*c)) {
                chars.next();
            }
            if chars.next()? != ']' {
                return None;
            }
            Some(c)
        }
    };

    // (?![([]) - a following `(` or `[` makes it a link, except for a box
    // that holds only whitespace (the `\s+\]` alternative).
    let followed_by_link = matches!(chars.peek(), Some('(') | Some('['));
    if followed_by_link && (marker.is_some() || leading_space == 0) {
        return None;
    }

    Some(matches!(marker, Some('x') | Some('X')))
}

/// Count task checkboxes the way `openspec list` / `openspec status` do.
pub fn count_tasks(content: &str) -> TaskStats {
    let mut stats = TaskStats { total: 0, done: 0 };
    for line in content.split('\n') {
        if let Some(done) = parse_task_line(line) {
            stats.total += 1;
            if done {
                stats.done += 1;
            }
        }
    }
    stats
}

#[cfg(test)]
mod tests {
    use super::*;

    fn task(line: &str) -> Option<bool> {
        parse_task_line(line)
    }

    #[test]
    fn list_markers() {
        assert_eq!(task("- [ ] a"), Some(false));
        assert_eq!(task("- [x] a"), Some(true));
        assert_eq!(task("- [X] a"), Some(true));
        assert_eq!(task("* [ ] a"), Some(false));
        assert_eq!(task("+ [x] a"), Some(true));
        assert_eq!(task("1. [ ] a"), Some(false));
        assert_eq!(task("2) [x] a"), Some(true));
        assert_eq!(task("123456789. [ ] a"), Some(false));
        assert_eq!(task("1234567890. [ ] a"), None);
        assert_eq!(task("-[x] tight"), Some(true));
        assert_eq!(task("Not a list - [ ] a"), None);
    }

    #[test]
    fn indentation_and_line_endings() {
        assert_eq!(task("  - [ ] nested"), Some(false));
        assert_eq!(task("\t- [x] tab"), Some(true));
        assert_eq!(task("- [x]\r"), Some(true));
        assert_eq!(task("\u{FEFF}- [ ] behind a BOM"), Some(false));
    }

    #[test]
    fn markers() {
        assert_eq!(task("- [~] tilde"), Some(false));
        assert_eq!(task("- [] empty"), Some(false));
        assert_eq!(task("- [ x ] padded"), Some(true));
        assert_eq!(task("- [\u{e9}] accented"), Some(false));
        assert_eq!(task("- [WIP] label"), None);
        assert_eq!(task("- [\u{1F680}] astral"), None);
    }

    #[test]
    fn links_are_not_tasks() {
        assert_eq!(task("- [x](./link)"), None);
        assert_eq!(task("- [A](https://example.com)"), None);
        assert_eq!(task("- [1][ref]"), None);
        assert_eq!(task("- [](./x)"), None);
        assert_eq!(task("- [Doc](./doc.md)"), None);
        // A whitespace-only box still counts, link or not.
        assert_eq!(task("- [ ](./link)"), Some(false));
        assert_eq!(task("- [ ][ref]"), Some(false));
    }

    #[test]
    fn counts_across_lines() {
        let stats = count_tasks("# Tasks\n- [x] a\n- [ ] b\n```\n- [ ] fenced\n```\n");
        assert_eq!(stats.total, 3);
        assert_eq!(stats.done, 1);
    }
}
