---
name: openspec-ui
description: Start the OpenSpec board (openspec-ui), a live read-only kanban of OpenSpec changes, specs and ideas, and answer project-status questions from its API. Use when the user wants to see, open or share the board or dashboard, asks "show me the board", "what's the status across my repos", "what's in progress / blocked / closest to done / ready to archive", "which changes are open", "how far along is change X", or wants to check OpenSpec progress from their phone, in a repo with an openspec/ folder.
---

# OpenSpec board

`openspec-ui` serves a kanban board (Draft, Todo, In progress, Done, Archived) for every `openspec/` folder it finds, plus specs and ideas. It reads the files live and never edits specs or changes.

## 1. Start it (or reuse it)

Run from the folder to show (a repo, or a parent of several repos), or pass folders as arguments. A server is long-running, so background it and read the URL from its output. Use this exact shape (adjust nothing but optional folder arguments):

```sh
OUT=$(mktemp); nohup npx -y openspec-ui --json </dev/null >"$OUT" 2>"$OUT.err" &
for i in $(seq 90); do [ -s "$OUT" ] && break; sleep 1; done; cat "$OUT" "$OUT.err"
```

The first run downloads the binary and can take a while. Prints one JSON line: `url`, `pid`, `version`, `sources` (the repos found), `reused`. Tell the user the `url`; keep `pid` for stopping.

- `"reused": true` means a server for the same folders is already running; use its `url`. Never start a second one.
- Do not pass `--port` unless asked; the default picks a free port (the URL is not always :3000).
- No output: report what is in `$OUT.err`. `"sources": []` means no `openspec/` folder was found (it searches 3 levels deep; `--depth N` goes deeper, or name the repo folders explicitly).
- Without a browser the user opens the URL themselves; do not try to open one.

## 2. Answer status questions from the API

Use `curl` on the `url` yourself; the user does not need to look at the board. Ids look like `repo/change-name`; URL-encode the slash (`%2F`) in paths.

- `GET /api/changes` returns `{"changes":[...]}` including archived ones. Each has `id`, `sourceId` (repo), `status`, `taskStats` (`{"total":13,"done":9}` or `null` before tasks exist), `artifacts[]` (`{id,state}` with `state` complete | ready | blocked, `missingDeps`).
- `status`: `draft` (no tasks yet; check `artifacts` for what is missing or blocked), `todo` (tasks written, none done), `in_progress`, `done` (all tasks checked, not yet archived, so ready to archive), `archived`.
- `GET /api/changes/{id}` adds the text: `proposal`, `design`, `tasks` (`{"raw": markdown}`), `specs`.
- `GET /api/specs` lists specs (`id`, `sourceId`); `GET /api/specs/{id}` has `content`. `GET /api/ideas` lists `{title, description, sourceId}`. `GET /api/sources` lists repos; `GET /api/info` repeats the start JSON.

Example, closest to done across all repos:

```sh
curl -s "$URL/api/changes" | jq -r '.changes[] | select(.status=="in_progress") | [.id, "\(.taskStats.done)/\(.taskStats.total)"] | @tsv'
# biometric-login 9/13 ... sort by done/total and report the highest
```

Example, one change in detail: `curl -s "$URL/api/changes/storefront%2Fadd-saved-addresses"` gives `status` and the `tasks.raw` checklist, so you can name the unchecked tasks.

No `jq`? Parse with `python3 -c` or `node -e`. Re-query for a fresh answer; the data is live. Always answer with counts and names from the API, not guesses.

## 3. Other uses

- Phone or other device on the same network: restart with `--host 0.0.0.0` and give the user the machine's LAN IP with the port. There is no login: anyone on that network can read the board, and the page can also add/delete ideas and change the project list. Warn the user and only do this when they ask. Default is localhost only.
- Stop it: `kill <pid>` (from the JSON, or from `GET /api/info`). Stop it when the user is done.
- Read-only: do not edit `openspec/` files, the server config or ideas unless the user asks for that change. Do not create `openspec-ui.json` or other config files on your own; the folder arguments are enough.
