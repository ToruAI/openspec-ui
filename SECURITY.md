# Security

## Reporting a vulnerability

Please report it privately through GitHub: **Security → Report a vulnerability** on this repository ([private advisory form](https://github.com/ToruAI/openspec-ui/security/advisories/new)). Do not open a public issue. Include the version (`openspec-ui --version`), how you run it, and the steps to reproduce.

Only the latest release is supported.

## Trust model

- openspec-ui has **no login**. Anyone who can reach the port can read every change, spec and idea it serves, add or delete ideas, and change the project list for the running server.
- It listens on **127.0.0.1 by default**. On localhost it refuses requests with a foreign `Host` header (DNS rebinding), and it refuses cross-origin writes everywhere. Only expose it (`--host 0.0.0.0`, Docker `-p`) on networks you trust, and never directly on the internet.
- It never writes to OpenSpec specs or changes. Its only writes are idea notes under `openspec/ideas/` and, when you use one, the `openspec-ui.json` config file. Release binaries are checked against `SHA256SUMS` by `install.sh` and the npm launcher.
