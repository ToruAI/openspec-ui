# Reference

Everything the [README](../README.md) leaves out: command line, config file, environment variables, HTTP API, Docker, and how it works.

## Command line

```text
openspec-ui [OPTIONS] [PATH]...

  [PATH]...            Folders to search for OpenSpec projects. A repo with an openspec/
                       folder is shown as is; any other folder is searched below.
                       Default: the current folder
  -c, --config <FILE>  Read projects from a JSON config file instead of searching folders
  -p, --port <PORT>    Port. Without it: 3000, or the next free port if 3000 is taken  [env: PORT]
      --host <ADDR>    Address to listen on. Default 127.0.0.1; 0.0.0.0 for other devices  [env: OPENSPEC_UI_HOST]
      --depth <N>      Folder levels below each PATH to search for repos (default 3)
      --no-open        Do not open the browser  [env: OPENSPEC_UI_NO_OPEN]
      --json           Print one JSON line instead of the banner; never opens the browser
  -v, --verbose        Logs on stderr (-vv for debug). RUST_LOG overrides this
  -V, --version
```

**Where the project list comes from** (first match wins):

1. `--config FILE`
2. `PATH` arguments, searched for repos with `openspec/`
3. `$OPENSPEC_UI_CONFIG`
4. `./openspec-ui.json` in the current folder
5. the current folder, searched like a `PATH`

The search skips hidden folders, heavy folders such as `node_modules` and `target`, and linked git worktrees, does not follow symlinks, stops inside a repo once it finds `openspec/`, and gives up after 20,000 folders. Repos are named after their folder; clashes get the parent's name in brackets.

**Port.** `--port` / `PORT`, then the config file's `port`, then 3000. Only the default moves to the next free port (up to 20 tries); an explicit port that is taken is an error.

**Browser.** Opens only from an interactive terminal on your machine: not with `--json`, `--no-open`, in CI, over SSH, or in a container.

**Reuse.** If an openspec-ui of the same version already serves the same folders on the same host, the command prints that server's address (`"reused": true` with `--json`) and exits 0.

**Output.** The first line on stdout is always `openspec-ui <version> running at <url>`, or with `--json` one JSON object:

```json
{"name":"openspec-ui","version":"…","url":"http://127.0.0.1:3000","host":"127.0.0.1","port":3000,
 "pid":12345,"mode":"discovered","configPath":null,"roots":["/home/you/code"],
 "sources":[{"name":"storefront","path":"/home/you/code/storefront/openspec","valid":true}],
 "changelog":"https://github.com/ToruAI/openspec-ui/blob/main/CHANGELOG.md","lanUrl":null,"reused":false}
```

`lanUrl` is the address for other devices when the server listens on every interface (outside a container), else `null`. Logs go to stderr.

## Config file

Optional. Use it when you want a fixed list of repos, or Settings edits that survive a restart.

```json
{
  "sources": [
    { "name": "api", "path": "/home/you/code/api/openspec" },
    { "name": "web", "path": "../web/openspec" }
  ],
  "port": 3000
}
```

| Field | Meaning |
|---|---|
| `sources[].name` | Name shown on the board |
| `sources[].path` | The repo's `openspec/` directory. Paths starting with `./` or `../` are relative to the config file |
| `port` | Optional. A fixed port; without it the default port rules apply |

The Settings dialog writes the source list back to this file. Without a config file, Settings edits last until the server stops; openspec-ui never creates a config file itself.

## Environment variables

| Variable | Used by | Meaning |
|---|---|---|
| `PORT` | server | Same as `--port` |
| `OPENSPEC_UI_HOST` | server | Same as `--host` |
| `OPENSPEC_UI_NO_OPEN` | server | `1` / `true` / `yes`: same as `--no-open` |
| `OPENSPEC_UI_CONFIG` | server | Config file to use when no `--config` or `PATH` is given |
| `CORS_ALLOWED_ORIGINS` | server | Comma-separated origins allowed to call the API from a browser. Default: the server's own origin only |
| `RUST_LOG` | server | Log filter, e.g. `debug` |
| `FRONTEND_DIR` | server | Serve the UI from this folder instead of the embedded build (development) |
| `OPENSPEC_UI_BIN` | npx launcher | Run this local binary instead of downloading one |
| `OPENSPEC_UI_CACHE_DIR` | npx launcher | Where downloaded binaries are cached |
| `OPENSPEC_UI_DOWNLOAD_BASE` | npx launcher, install.sh | Mirror of the GitHub release downloads |
| `HTTPS_PROXY`, `NO_PROXY` | npx launcher | Respected for the download |
| `OPENSPEC_UI_VERSION` | install.sh | Version to install, e.g. `0.3.0` (default: latest release) |
| `OPENSPEC_UI_INSTALL_DIR` | install.sh | Install folder (default `~/.local/bin`) |

## HTTP API

JSON over HTTP on the same port as the board. Ids are `repo/name`; encode the slash as `%2F` in paths.

| Endpoint | Returns |
|---|---|
| `GET /api/info` | The same object as `--json` |
| `GET /api/health` | `ok` |
| `GET /api/sources` | `{"sources":[{id, name, path, valid, planning}]}`. `planning.kind` is `local`, or a store checkout / store pointer (beta) |
| `GET /api/changes` | `{"changes":[…]}`, archived included. Per change: `id`, `name`, `sourceId`, `status`, `title`, `summary`, `taskStats`, `schema`, `artifacts[]`, `isPlanningComplete`, `applyRequires`, `error`, `warnings` |
| `GET /api/changes/{id}` | Adds `proposal`, `design`, `specs[]` (`{path, content}`), `tasks` (`{raw, stats}`), `documents[]` (`{artifactId, files[]}`) |
| `GET /api/specs` | `{"specs":[{id, sourceId, path}]}` |
| `GET /api/specs/{id}` | Adds `content` |
| `GET /api/ideas` | `{"ideas":[{id, sourceId, title, description, createdAt, updatedAt}]}` |
| `POST /api/ideas`, `PUT` / `DELETE /api/ideas/{id}` | Create, edit, delete an idea note under `openspec/ideas/` |
| `GET /api/config`, `PUT /api/config/sources` | The project list and how it was chosen; replace it |
| `GET /api/events` | Server-Sent Events: a message whenever watched files change |

**Change `status`** follows the task checkboxes, as `openspec list` counts them: `draft` (no tasks yet), `todo` (none checked), `in_progress`, `done` (all checked, not archived), `archived`. The board shows these as Planning, Ready to apply, In progress, Complete and Archived; a `todo` change stays in Planning while an artifact listed in `applyRequires` is missing.

**`artifacts[]`** lists the schema's artifacts in build order: `{id, outputPath, status, requires, missingDeps}`, with `status` one of `done`, `skipped`, `ready`, `blocked`, the same values `openspec status --json` reports. `error` is set when OpenSpec cannot read the change (invalid `.openspec.yaml`, unknown schema); `artifacts` is then empty.

Writes (`POST`, `PUT`, `DELETE`) from another origin are refused. There is no authentication; see [SECURITY.md](../SECURITY.md).

## Docker

```sh
docker run -p 3000:3000 -v ~/code:/repos ghcr.io/toruai/openspec-ui
```

- The image searches `/repos` for repos with `openspec/` (three levels deep). Mount one parent folder, or several repos under it: `-v ~/code/api:/repos/api -v ~/code/web:/repos/web`.
- Tags: `latest`, `X.Y.Z`, `X.Y`. Images for linux/amd64 and linux/arm64, built from the same static binaries as the release.
- Inside the container the server listens on `0.0.0.0:3000` and never opens a browser. Choose what the host exposes with `-p`; `-p 127.0.0.1:3000:3000` keeps it on your machine.
- The process runs as uid 10001; mounted folders must be readable by it. Mount read-only (`:ro`) if you do not need idea notes or Settings edits saved.
- For a fixed list, mount a config as `/repos/openspec-ui.json`, or set `OPENSPEC_UI_CONFIG` to its path inside the container. Paths in it are container paths.
- `docker build .` builds the image from source.

## How it works

A single Rust (Axum) binary with the React frontend embedded at compile time. On start it resolves the list of OpenSpec directories, then reads them the way the OpenSpec CLI does: every folder under `openspec/changes/` is a change; its workflow schema comes from `.openspec.yaml`, then `openspec/config.yaml`, then the built-in `spec-driven` (project, user-level and built-in schemas are resolved in OpenSpec's order); an artifact is done when its output files exist and ready or blocked by its `requires`; tasks are counted with OpenSpec's checkbox rules. `conformance/` holds projects generated by the real CLI with its recorded `openspec list` / `openspec status` answers, and `cargo test` compares the scan against them. A file watcher (500 ms debounce) pushes an event to the browser over SSE, which refetches. Nothing is cached on disk and nothing in `openspec/` is written except idea notes.
