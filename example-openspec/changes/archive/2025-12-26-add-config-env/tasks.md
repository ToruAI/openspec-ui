# Tasks: Add Environment-Based Configuration

## 1. Backend Configuration
- [x] 1.1 Add `OPENCODE_URL` environment variable support in `main.rs`
- [x] 1.2 Default to `http://127.0.0.1:4096` if not set
- [x] 1.3 Log the configured OpenCode URL on startup
- **Validation**: Backend starts and logs correct URL from env

## 2. Frontend Configuration
- [x] 2.1 Add `VITE_API_URL` environment variable support
- [x] 2.2 Update `App.tsx` to use configured API URL
- [x] 2.3 Update `runtime.tsx` to use configured API URL
- [x] 2.4 Default to `http://localhost:8080` for development
- **Validation**: Frontend connects to configured backend URL

## 3. Documentation
- [x] 3.1 Create `.env.example` with all configuration options
- [x] 3.2 Update README with configuration section
- **Validation**: New developer can configure URLs following docs

## 4. Unit Tests
- [x] 4.1 Backend: Test config loads from environment variable
- [x] 4.2 Backend: Test default URL fallback when env not set
- [x] 4.3 Frontend: Test API URL configuration hook/utility
- **Validation**: `cargo test` and `npm test` pass with config tests

## Order of Execution
1. Backend configuration (task 1) - independent
2. Frontend configuration (task 2) - independent
3. Documentation (task 3) - after 1 and 2
4. Unit tests (task 4) - after implementation

## Parallel Work
- Tasks 1 and 2 can be done in parallel
- Task 4 can be done in parallel for backend/frontend
