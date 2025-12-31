# Tasks: Add Connection Status Indicator

## 1. Backend Health Endpoint
- [ ] 1.1 Add `GET /api/health` endpoint
- [ ] 1.2 Check backend database connectivity
- [ ] 1.3 Check OpenCode server connectivity (simple GET request)
- [ ] 1.4 Return JSON with status for each service
- **Validation**: `curl localhost:8080/api/health` returns status

## 2. Frontend Status Indicator
- [ ] 2.1 Create ConnectionStatus component
- [ ] 2.2 Add indicator to sidebar header (green/yellow/red dot)
- [ ] 2.3 Fetch health on initial load
- [ ] 2.4 Poll health every 30 seconds (configurable)
- [ ] 2.5 Show tooltip with detailed status on hover
- **Validation**: Status indicator visible and updates

## 3. Error State Handling
- [ ] 3.1 Disable send button when disconnected
- [ ] 3.2 Show warning banner when OpenCode is unreachable
- [ ] 3.3 Add manual "Retry Connection" button
- **Validation**: Clear feedback when system is down

## 4. Unit Tests
- [ ] 4.1 Backend: Test health endpoint returns correct JSON structure
- [ ] 4.2 Backend: Test health endpoint handles DB connection failure gracefully
- [ ] 4.3 Backend: Test health endpoint handles OpenCode unreachable
- [ ] 4.4 Frontend: Test ConnectionStatus component renders correct states
- [ ] 4.5 Frontend: Test polling interval configuration
- **Validation**: `cargo test` and `npm test` pass with health check tests

## Order of Execution
1. Backend (task 1) - foundation
2. Frontend indicator (task 2) - depends on backend
3. Error handling (task 3) - enhancement after basic indicator works
4. Unit tests (task 4) - after implementation
