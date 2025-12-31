# Design: Settings UI & Dynamic Configuration

## Backend Architecture

### State Management
- Currently, `AppState` holds `sources: Arc<Vec<Source>>`, which is immutable.
- **Change**: Wrap config/sources in a `RwLock` (e.g., `Arc<RwLock<AppStateInner>>`) to allow runtime mutation.
- **Persistence**: When configuration changes via API, serialize and write back to `openspec-ui.json` immediately.

### File Watching Strategy
- The file watcher is currently spawned once in `main`.
- **Change**:
    - The watcher needs to be re-configurable or we need to manage a map of active watchers.
    - *Approach*: Maintain a `HashMap<SourceId, RecommendedWatcher>`. When sources change:
        - Identify added sources -> Spawn new watchers.
        - Identify removed sources -> Drop existing watchers.
        - Identify modified paths -> Drop old, spawn new.
    - *Alternative (Simpler)*: Restart the entire watcher task with the new list of sources upon config update. Given the low frequency of config changes, this is acceptable.

## Frontend Architecture

### Settings Dialog
- Located in `components/SettingsModal.tsx`.
- Uses `shadcn/ui` Dialog component.
- **State**: Local state for the form, initialized from `useSources`.
- **Validation**:
    - Client-side: Basic format checks.
    - Server-side: `PUT` request will return validation errors (e.g., "Path does not exist") which must be displayed inline.

## API Design

### `GET /api/config`
Returns full configuration (sources + port).

### `PUT /api/config/sources`
Updates the sources list.
- **Body**: `{ "sources": [{ "name": "...", "path": "..." }] }`
- **Behavior**:
    1. Validates all paths.
    2. Updates in-memory state.
    3. Updates file watchers.
    4. Writes to disk.
    5. Triggers an SSE `update` event to refresh clients.

