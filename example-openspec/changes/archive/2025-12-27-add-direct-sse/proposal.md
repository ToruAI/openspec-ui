# Change: Direct SSE Connection to OpenCode

**Supersedes**: `add-streaming-chat` (abandoned due to SSE proxy complexity)

## Why
The current approach of proxying SSE events through the Rust backend is causing `ERR_INCOMPLETE_CHUNKED_ENCODING` errors after ~30 seconds of inactivity. The proxy implementation requires complex keepalive logic that has proven difficult to implement correctly in async Rust.

A simpler architecture connects the React frontend directly to OpenCode's SSE endpoint, eliminating the proxy layer entirely for real-time events.

## What Changes

### Frontend
- **UPDATE**: Add `VITE_OPENCODE_URL` environment variable for direct OpenCode connection.
- **UPDATE**: `useMyRuntime` SSE listener connects to OpenCode directly (`${OPENCODE_URL}/event`) instead of backend proxy.
- **REMOVE**: SSE connection to `/api/events` (backend proxy).

### Backend
- **REMOVE**: `GET /api/events` SSE proxy endpoint.
- **REMOVE**: `OpenCodeClient::subscribe_events` function.
- **KEEP**: REST API endpoints (`/api/sessions/*`, message sending via `prompt_async`).

### Configuration
- **UPDATE**: `.env.example` to include `VITE_OPENCODE_URL`.
- **UPDATE**: `src/lib/config.ts` to export OpenCode URL getter.

## Impact
- **Specs**: `chat` (SSE source), `configuration` (new env var).
- **Code**: `src/runtime.tsx`, `src/lib/config.ts`, `backend/src/handlers.rs`, `backend/src/opencode.rs`.
- **Simplification**: ~100 lines of complex async Rust code removed.

## Architecture

### Before (Proxied)
```
React (browser)
    ↓ SSE + REST
Rust Backend (:8080)
    ↓ proxies everything
OpenCode (:4096)
```

### After (Direct SSE)
```
React (browser)
    ├── SSE events ──────→ OpenCode (:4096) directly
    │
    └── REST API ────────→ Rust Backend (:8080)
                                ↓
                          OpenCode (:4096)
```

## Prerequisites
- OpenCode must have CORS enabled for browser origins.

## Security Considerations

### CORS Configuration
OpenCode defaults to `Access-Control-Allow-Origin: *` which allows any origin to connect. This is a security concern for public deployments.

**Deployment Options (choose one):**

| Option | When to Use | Action Required |
|--------|-------------|-----------------|
| **Same-origin** | Production | Deploy frontend at same domain as OpenCode (e.g., both at `brain-gate.example.com`). No CORS needed. |
| **Reverse proxy** | Production with separate domains | Nginx/Caddy proxies `/event` to OpenCode, frontend only talks to proxy. |
| **VPN/Private network** | Internal/dev use | Access OpenCode only via VPN. Wildcard CORS acceptable since network is trusted. |
| **Explicit origin** | Production without proxy | Configure OpenCode's CORS settings (if supported) to allow only your frontend origin. |

**This implementation assumes:** VPN/private network deployment. For public deployment, choose same-origin or reverse proxy approach before shipping.

**Verification:** `curl -I http://localhost:4096/event` shows `Access-Control-Allow-Origin: *`. If this header exposes OpenCode publicly, reconfigure deployment.

### SSE Event Filtering
The frontend already filters SSE events by `sessionID` (L112, L171 in `runtime.tsx`), so even with wildcard CORS, other users cannot inject events into your session.

## Relationship to add-streaming-chat

`add-streaming-chat` (16/29 tasks complete) implemented:
- SSE proxy in Rust backend (the code being removed)
- `prompt_async` integration (keeping this)
- Frontend SSE event handlers (keeping this, just changing URL)

This change **supersedes** the proxy approach while **preserving** the working parts. The completed SSE event handling logic in `runtime.tsx` stays intact - only the connection URL changes.

## Risk Assessment
- **Low risk**: OpenCode already supports direct browser connections.
- **Rollback**: Can revert to proxy approach if CORS issues arise in production.
