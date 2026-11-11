---
name: openspec-ui
description: Start the OpenSpec board (openspec-ui), a live read-only kanban of OpenSpec changes, specs and ideas, and answer project-status questions from its API. Use when the user wants to see, open or share the board or dashboard, asks "show me the board", "what's the status across my repos", "what's in progress / blocked / closest to done / ready to archive", "which changes are open", "how far along is change X", or wants to check OpenSpec progress from their phone, in a repo with an openspec/ folder.
---

# OpenSpec board

`openspec-ui` serves a kanban board (Planning, Ready to apply, In progress, Complete, Archived) for every `openspec/` folder it finds, plus specs and ideas. It reads the files live and never edits specs or changes.

## 1. Start it (or reuse it)

Run from the folder to show (a repo, or a parent of several repos), or pass folders as arguments. A server is long-running, so background it and read the URL from its output. Use this exact shape (adjust nothing but optional folder arguments):

```sh
OUT=$(mktemp); nohup npx -y openspec-ui --json </dev/null >"$OUT" 2>"$OUT.err" &
for i in $(seq 90); do [ -s "$OUT" ] && break; sleep 1; done; cat "$OUT" "$OUT.err"
```

The first run downloads the binary and can take a while. Prints one JSON line: `url`, `pid`, `version`, `sources` (the repos found), `lanUrl`, `reused`. Tell the user the `url`; keep `pid` for stopping.

- `"reused": true` means a server for the same folders is already running; use its `url`. Never start a second one.
- Do not pass `--port` unless asked; the default picks a free port (the URL is not always :3000).
- No output: report what is in `$OUT.err`. `"sources": []` means no `openspec/` folder was found (it searches 3 levels deep; `--depth N` goes deeper, or name the repo folders explicitly).
- Without a browser the user opens the URL themselves; do not try to open one.

## 2. Answer status questions from the API

Use `curl` on the `url` yourself; the user does not need to look at the board. Ids look like `repo/change-name`; URL-encode the slash (`%2F`) in paths.

- `GET /api/changes` returns `{"changes":[...]}` including archived ones. Each has `id`, `sourceId` (repo), `status`, `summary` (one line on what it is for), `taskStats` (`{"total":13,"done":9}`, or `null` before `tasks.md` exists), `schema`, `artifacts[]`, `isPlanningComplete`, `applyRequires`, `error`, `warnings`.
- `status` (from the task checkboxes, as `openspec list` counts them): `draft` (no tasks yet), `todo` (tasks written, none checked), `in_progress`, `done` (every task checked but not archived, so ready to archive), `archived`. On the board `draft` is Planning, `todo` is Ready to apply (or Planning while an artifact in `applyRequires` is missing), `done` is Complete.
- `artifacts[]`, in the schema's order: `{id, outputPath, status, requires, missingDeps}` with `status` `done` (written), `skipped` (not needed, e.g. `skip_specs`), `ready` (can be written next) or `blocked` (waiting on `missingDeps`). Same values as `openspec status --json`.
- `error` is set when OpenSpec itself cannot read the change (bad `.openspec.yaml`, unknown schema); `artifacts` is then empty.
- `GET /api/changes/{id}` adds the text: `proposal`, `design`, `tasks` (`{"raw": markdown, "stats": {...}}`), `specs[]` (`{path, content}`), and `documents[]` (`{artifactId, files[]}` for every artifact, custom schemas included).
- `GET /api/specs` lists specs (`id`, `sourceId`, `path`); `GET /api/specs/{id}` adds `content`. `GET /api/ideas` lists `{id, sourceId, title, description, createdAt}`. `GET /api/sources` lists repos; `GET /api/info` repeats the start JSON.

Example, closest to done across all repos:

```sh
curl -s "$URL/api/changes" | jq -r '.changes[] | select(.status=="in_progress") | [.id, "\(.taskStats.done)/\(.taskStats.total)"] | @tsv'
# mobile-app/biometric-login  9/13 ... sort by done/total and report the highest
```

Example, what can be written next: `curl -s "$URL/api/changes" | jq -c '.changes[] | select(.status!="archived") | {id, next: [.artifacts[] | select(.status=="ready") | .id]}'`.

Example, one change in detail: `curl -s "$URL/api/changes/storefront%2Fadd-saved-addresses" | jq -r .tasks.raw` prints the checklist, so you can name the unchecked tasks.

No `jq`? Parse with `python3 -c` or `node -e`. Re-query for a fresh answer; the data is live. Always answer with counts and names from the API, not guesses.

## 3. Other uses

- Phone or other device on the same network: stop the running server (`kill <pid>`), start it again with `--host 0.0.0.0` added, and give the user `lanUrl` from the JSON (`url` stays the local address). Without the kill, a second server starts on another port. Open it by that IP address; a host name (`my-pc.local`, a reverse proxy) needs `--allowed-host NAME` or `OPENSPEC_UI_ALLOWED_HOSTS`, otherwise the server answers 403 and says so. There is no login: anyone on that network can read the board and add/edit/delete ideas (the project list can be changed only from this machine). Warn the user and only do this when they ask. Default is localhost only.
- Stop it: `kill <pid>` (from the JSON, or from `GET /api/info`). Stop it when the user is done.
- Read-only: do not edit `openspec/` files, the server config or ideas unless the user asks for that change. Do not create `openspec-ui.json` or other config files on your own; the folder arguments are enough.
