# Security

## Reporting a vulnerability

Please report it privately through GitHub: **Security → Report a vulnerability** on this repository ([private advisory form](https://github.com/ToruAI/openspec-ui/security/advisories/new)). Do not open a public issue. Include the version (`openspec-ui --version`), how you run it, and the steps to reproduce.

Only the latest release is supported.

## Trust model

- openspec-ui has **no login**. Anyone who can reach the port can read every change, spec and idea it serves, and add, edit or delete ideas. Changing the project list is accepted only from a browser on the machine it runs on.
- It listens on **127.0.0.1 by default**. Only expose it (`--host 0.0.0.0`, Docker `-p`) on networks you trust, and never directly on the internet.
- **Websites you visit cannot use it** (DNS rebinding, cross-site requests). In every mode it answers only to a `Host` that is localhost, an IP address, or a name allowed with `--allowed-host` / `OPENSPEC_UI_ALLOWED_HOSTS`; an IP address cannot be rebound. Writes that carry an `Origin` must come from a page of the board itself (or an origin in `CORS_ALLOWED_ORIGINS`).
- **It reads only inside the projects it shows.** Spec names and idea ids from requests are checked, and a file or symlink that resolves outside a project's `openspec/` folder counts as absent, so a cloned repo cannot make it show or change files elsewhere.
- It never writes to OpenSpec specs or changes. Its only writes are idea notes under `openspec/ideas/` (never through a symlink) and, when you use one, the `openspec-ui.json` config file. Release binaries are built without a shared build cache and checked against `SHA256SUMS` by `install.sh` and the npm launcher.
