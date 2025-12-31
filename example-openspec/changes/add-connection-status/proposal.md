# Change: Add Connection Status Indicator

## Why
Users have no way to know if the backend or OpenCode server is connected. When services are down, users send messages into the void with no feedback until the request times out. A connection status indicator would show system health at a glance.

## What Changes
- Add `/api/health` endpoint to backend that checks OpenCode connectivity
- Add status indicator in frontend header/sidebar
- Show connected/disconnected/checking states
- Poll health periodically or on user action

## Impact
- Affected specs: `chat` (ADDED - connection status)
- Affected code:
  - `backend/src/handlers.rs` (new health endpoint)
  - `backend/src/opencode.rs` (health check method)
  - `src/App.tsx` (status indicator component)
