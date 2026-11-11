# Demo workspace

Four small repositories of a fictional company, Fernhill Goods (houseplants and ceramics), each with an `openspec/` directory, so the board shows real work in every stage. Nothing here is a real product.

```sh
openspec-ui --config demo/openspec-ui.json
# or, from a source checkout
backend/target/debug/openspec-ui --config demo/openspec-ui.json
```

| Repo | What it is | Active | Archived | Specs | Ideas |
|---|---|---|---|---|---|
| `storefront` | Next.js web shop | 4 | 4 | 4 | 3 |
| `payments-api` | Go payments service | 4 | 5 | 4 | 2 |
| `mobile-app` | React Native app | 4 | 4 | 4 | 3 |
| `platform-infra` | CI, database, observability, secrets | 3 | 4 | 4 | 2 |

Active changes cover every state: marker only (`add-wishlist-sharing`), proposal only, proposal and specs without a design, proposal, design and specs without tasks, tasks at 0%, 3/12, 5/11, 7/9, 9/13, 11/14, all tasks checked but not archived, and two `skip_specs: true` changes.

## How it was produced

`generate.mjs` drives the real OpenSpec CLI (pinned to **1.17.0**, installed into the gitignored `demo/.cache/`):

1. `openspec init --tools none` creates `openspec/config.yaml` and the directory layout. No agent scaffolding is generated. The generator then adds a `context:` block to the config.
2. `openspec new change <name> [--goal ...]` creates each change with its `.openspec.yaml` marker.
3. The prose (proposal, design, tasks, spec deltas) is written from `src/<repo>.mjs`, rendered by `src/lib.mjs` into the schema's section layout. Task checkboxes come from a `done` count.
4. Archived changes are run through `openspec archive --yes`, oldest first, so the living specs under `openspec/specs/` are merged by the CLI itself. The archive folders and the `created:` dates are then rewritten to the scenario dates.
5. `ideas/*.md` files (a dashboard concept, not OpenSpec) are written with the frontmatter `backend/src/parser.rs` reads.
6. `openspec validate --all` runs at the end. The two changes still being drafted (marker only, proposal only) fail with "must have at least one delta" on purpose: they have no specs yet.

## Regenerate or refresh

```sh
node demo/generate.mjs                      # everything, OpenSpec 1.17.0
node demo/generate.mjs storefront           # one repo
OPENSPEC_VERSION=latest node demo/generate.mjs   # try a newer CLI
OPENSPEC_BIN=/path/to/openspec node demo/generate.mjs
```

The script deletes and rebuilds each `demo/<repo>/` directory, so edit the content in `src/`, not in the generated files. When OpenSpec changes its format, run it with the new version, read the `validate` output, and adjust `lib.mjs` if the artifact layout moved. Commit the regenerated output together with the version bump in `generate.mjs`.

Dates are fixed in the scenario (August to November 2026). Idea cards show relative times ("3d ago") that age as time passes; edit the `createdAt` values in `src/*.mjs` before taking new screenshots.

`screenshots/` holds a reference capture of the board served from this workspace.
