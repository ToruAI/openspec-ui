//! Conformance against the real OpenSpec CLI.
//!
//! `conformance/generate.mjs` builds fixture projects with the `openspec` CLI
//! and records its answers (`openspec list --all --json`, `openspec status
//! --all --json`) in each fixture's `expected.json`. This test scans the same
//! files and reports every field where openspec-ui disagrees with OpenSpec.
//!
//! Fixtures are committed, so `cargo test` runs offline. CI regenerates them
//! with the latest OpenSpec release first; set `OPENSPEC_UI_CONFORMANCE_DIR`
//! to point the test at another fixture directory.
//!
//! Deliberate differences, asserted as such rather than skipped silently:
//! - Dot-directories under `changes/`: `openspec list` shows them,
//!   `openspec status` rejects them; the board follows `status` and hides them.
//! - A store pointer (`store:` in openspec/config.yaml): the CLI acts on the
//!   store; the board reports the pointer instead of following it.

use super::workflow::{builtin_schemas, SchemaDef};
use super::{inspect_planning_root, scan_changes_with, Change, PlanningKind, ScanOptions};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

fn fixtures_dir() -> PathBuf {
    std::env::var_os("OPENSPEC_UI_CONFORMANCE_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| Path::new(env!("CARGO_MANIFEST_DIR")).join("../conformance/fixtures"))
}

fn read_json(path: &Path) -> Value {
    let text =
        std::fs::read_to_string(path).unwrap_or_else(|e| panic!("cannot read {}: {e}", path.display()));
    serde_json::from_str(&text).unwrap_or_else(|e| panic!("cannot parse {}: {e}", path.display()))
}

/// Collects mismatches as readable lines: where, which field, OpenSpec's
/// answer, ours.
struct Report {
    lines: Vec<String>,
    checks: usize,
}

impl Report {
    fn check(&mut self, place: &str, field: &str, expected: &Value, actual: &Value) {
        self.checks += 1;
        if expected != actual {
            self.lines.push(format!(
                "{place}\n    {field}\n      openspec:    {expected}\n      openspec-ui: {actual}"
            ));
        }
    }

    fn fail(&mut self, place: &str, message: String) {
        self.checks += 1;
        self.lines.push(format!("{place}\n    {message}"));
    }
}

/// `openspec list` status → board column.
fn board_column(list_status: &str, completed: u64, archived: bool) -> &'static str {
    if archived {
        return "archived";
    }
    match list_status {
        "no-tasks" => "draft",
        "complete" => "done",
        _ if completed == 0 => "todo",
        _ => "in_progress",
    }
}

fn schema_graph(schema: &SchemaDef) -> Value {
    json!({
        "name": schema.name,
        "artifacts": schema.artifacts.iter().map(|a| json!({
            "id": a.id, "generates": a.generates, "requires": a.requires,
        })).collect::<Vec<_>>(),
        "apply": schema.apply.as_ref().map(|a| json!({ "requires": a.requires, "tracks": a.tracks })),
    })
}

fn check_builtin_schemas(manifest: &Value, report: &mut Report) {
    let recorded = manifest["builtinSchemas"]
        .as_object()
        .cloned()
        .unwrap_or_default();
    for (name, graph) in &recorded {
        let place = format!("[built-in schema] {name}");
        match builtin_schemas().iter().find(|s| &s.name == name) {
            Some(ours) => {
                let ours = schema_graph(ours);
                let ids = |g: &Value| {
                    json!(g["artifacts"]
                        .as_array()
                        .map(|a| a.iter().map(|x| x["id"].clone()).collect::<Vec<_>>()))
                };
                report.check(&place, "artifacts", &ids(graph), &ids(&ours));
                for (want, got) in graph["artifacts"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .zip(ours["artifacts"].as_array().into_iter().flatten())
                {
                    let id = want["id"].as_str().unwrap_or("?");
                    for field in ["generates", "requires"] {
                        report.check(
                            &place,
                            &format!("artifacts[{id}].{field}"),
                            &want[field],
                            &got[field],
                        );
                    }
                }
                report.check(&place, "apply", &graph["apply"], &ours["apply"]);
            }
            None => report.fail(
                &place,
                "ships with OpenSpec but is not embedded in openspec-ui (backend/src/parser/schemas/)".into(),
            ),
        }
    }
    for ours in builtin_schemas() {
        if !recorded.contains_key(&ours.name) {
            report.fail(
                &format!("[built-in schema] {}", ours.name),
                "embedded in openspec-ui but no longer ships with OpenSpec".into(),
            );
        }
    }
}

fn check_case(case_dir: &Path, report: &mut Report) {
    let expected = read_json(&case_dir.join("expected.json"));
    let case = expected["case"].as_str().unwrap_or("?").to_string();
    let source = case_dir.join("openspec");
    let options = ScanOptions {
        global_data_dir: Some(if expected["userData"].as_bool() == Some(true) {
            case_dir.join("user-data").join("openspec")
        } else {
            case_dir.join(".no-user-data")
        }),
    };

    let planning = inspect_planning_root(&source, &options);
    let ours = scan_changes_with(&source, &case, &options);

    if expected["root"]["source"] == "declared" {
        // The CLI followed a store pointer. We detect it and say so instead.
        let place = format!("[{case}] planning root");
        report.check(
            &place,
            "kind",
            &json!("store_pointer"),
            &serde_json::to_value(&planning.kind).unwrap(),
        );
        report.check(
            &place,
            "storeId",
            &expected["root"]["storeId"],
            &json!(planning.store_id),
        );
        report.check(
            &place,
            "changes on the board (pointer is reported, not followed)",
            &json!(0),
            &json!(ours.len()),
        );
        return;
    }
    if planning.kind == PlanningKind::StorePointer {
        report.fail(
            &format!("[{case}] planning root"),
            "detected a store pointer, but OpenSpec used this directory as the root".into(),
        );
    }
    if case_dir.join(".openspec-store/store.yaml").is_file() && planning.kind != PlanningKind::Store {
        report.fail(
            &format!("[{case}] planning root"),
            "store checkout not recognised as a store".into(),
        );
    }

    let ours: Vec<(Change, Value)> = ours
        .into_iter()
        .map(|c| {
            let v = serde_json::to_value(&c).unwrap();
            (c, v)
        })
        .collect();

    let listed: Vec<&Value> = expected["list"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter(|c| !c["name"].as_str().unwrap_or("").starts_with('.'))
                .collect()
        })
        .unwrap_or_default();

    // Same set of changes.
    let key = |name: &str, archived: bool| format!("{}{name}", if archived { "archive/" } else { "" });
    let mut expected_names: Vec<String> = listed
        .iter()
        .map(|c| {
            key(
                c["name"].as_str().unwrap(),
                c["archived"].as_bool().unwrap_or(false),
            )
        })
        .collect();
    let mut our_names: Vec<String> = ours
        .iter()
        .map(|(c, _)| key(&c.name, c.status == super::ChangeStatus::Archived))
        .collect();
    expected_names.sort();
    our_names.sort();
    report.check(
        &format!("[{case}]"),
        "changes found",
        &json!(expected_names),
        &json!(our_names),
    );

    for entry in listed {
        let name = entry["name"].as_str().unwrap();
        let archived = entry["archived"].as_bool().unwrap_or(false);
        let place = format!("[{case}] {}", key(name, archived));
        let Some((change, value)) = ours
            .iter()
            .find(|(c, _)| c.name == name && (c.status == super::ChangeStatus::Archived) == archived)
        else {
            continue; // already reported by "changes found"
        };

        // `openspec list`: task progress and status.
        let completed = entry["completedTasks"].as_u64().unwrap_or(0);
        let stats = change
            .task_stats
            .clone()
            .unwrap_or(super::TaskStats { total: 0, done: 0 });
        report.check(
            &place,
            "completed tasks (openspec list)",
            &entry["completedTasks"],
            &json!(stats.done),
        );
        report.check(
            &place,
            "total tasks (openspec list)",
            &entry["totalTasks"],
            &json!(stats.total),
        );
        report.check(
            &place,
            &format!(
                "board column (openspec list status \"{}\")",
                entry["status"].as_str().unwrap_or("")
            ),
            &json!(board_column(
                entry["status"].as_str().unwrap_or(""),
                completed,
                archived
            )),
            &value["status"],
        );
        if entry.get("nested").is_some() {
            report.check(
                &place,
                "flagged as not a change (folder wrapping changes)",
                &json!(true),
                &json!(change.error.is_some()),
            );
        }

        // `openspec status`: active changes only.
        if archived {
            continue;
        }
        let Some(status) = expected["status"].get(name) else {
            report.fail(
                &place,
                "no `openspec status` answer recorded for this change".into(),
            );
            continue;
        };
        if status["ok"] == false {
            report.check(
                &place,
                &format!(
                    "error (openspec status: {})",
                    status["message"]
                        .as_str()
                        .unwrap_or("")
                        .lines()
                        .next()
                        .unwrap_or("")
                ),
                &json!(true),
                &json!(change.error.is_some()),
            );
            report.check(
                &place,
                "artifacts when OpenSpec cannot read the change",
                &json!([]),
                &value["artifacts"],
            );
            continue;
        }
        report.check(&place, "error", &Value::Null, &value["error"]);
        report.check(&place, "schema", &status["schemaName"], &value["schema"]);
        report.check(
            &place,
            "isPlanningComplete",
            &status["isPlanningComplete"],
            &value["isPlanningComplete"],
        );
        report.check(
            &place,
            "applyRequires",
            &status["applyRequires"],
            &value["applyRequires"],
        );
        report.check(
            &place,
            "has warnings",
            &json!(status["warnings"].as_u64().unwrap_or(0) > 0),
            &json!(!change.warnings.is_empty()),
        );
        let expected_ids: Vec<&Value> = status["artifacts"]
            .as_array()
            .map(|a| a.iter().map(|x| &x["id"]).collect())
            .unwrap_or_default();
        let our_ids: Vec<&Value> = value["artifacts"]
            .as_array()
            .map(|a| a.iter().map(|x| &x["id"]).collect())
            .unwrap_or_default();
        report.check(&place, "artifact order", &json!(expected_ids), &json!(our_ids));
        for (want, got) in status["artifacts"]
            .as_array()
            .into_iter()
            .flatten()
            .zip(value["artifacts"].as_array().into_iter().flatten())
        {
            let id = want["id"].as_str().unwrap_or("?");
            for field in ["outputPath", "status", "requires", "missingDeps"] {
                report.check(
                    &place,
                    &format!("artifacts[{id}].{field}"),
                    &want[field],
                    &got[field],
                );
            }
        }
    }
}

#[test]
fn scan_matches_openspec_cli() {
    let dir = fixtures_dir();
    let manifest = read_json(&dir.join("manifest.json"));
    let version = manifest["openspecVersion"].as_str().unwrap_or("?").to_string();
    let mut report = Report {
        lines: Vec::new(),
        checks: 0,
    };

    check_builtin_schemas(&manifest, &mut report);
    let cases = manifest["cases"].as_array().cloned().unwrap_or_default();
    assert!(!cases.is_empty(), "no conformance cases in {}", dir.display());
    for case in &cases {
        check_case(&dir.join(case.as_str().unwrap()), &mut report);
    }

    if !report.lines.is_empty() {
        panic!(
            "\n{} of {} checks disagree with OpenSpec {version} (fixtures: {}).\n\
             Each entry: fixture and change, field, what the OpenSpec CLI reported, what openspec-ui computed.\n\n{}\n",
            report.lines.len(),
            report.checks,
            dir.display(),
            report.lines.join("\n\n")
        );
    }
    eprintln!(
        "conformance: {} checks across {} fixtures agree with OpenSpec {version}",
        report.checks,
        cases.len()
    );
}
