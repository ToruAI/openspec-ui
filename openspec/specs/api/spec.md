# API Specification

## Purpose
Rust backend provides JSON API for reading OpenSpec data and SSE for real-time updates.

## Endpoints

### 1. List Sources
`GET /api/sources`

Returns configured OpenSpec sources.

**Response:**
```json
{
  "sources": [
    { "id": "brain-gate", "name": "brain-gate", "path": "/path/to/openspec", "valid": true },
    { "id": "megg", "name": "megg", "path": "/path/to/openspec", "valid": true }
  ]
}
```

### 2. List Changes
`GET /api/changes`

Returns all changes across sources with computed status.

**Status Logic:**
- **Draft**: Only `proposal.md` exists.
- **Todo**: `tasks.md` exists, 0 tasks completed.
- **In Progress**: `tasks.md` exists, >0 tasks completed.
- **Done**: Change is located in `archive/` folder.

**Response:**
```json
{
  "changes": [
    {
      "id": "brain-gate/add-auth",
      "name": "add-auth",
      "sourceId": "brain-gate",
      "status": "in_progress",
      "hasProposal": true,
      "hasSpecs": true,
      "hasTasks": true,
      "hasDesign": false,
      "taskStats": { "total": 12, "done": 3 }
    }
  ]
}
```

### 3. Get Change Detail
`GET /api/changes/:id`

Returns full change content including raw markdown content for artifacts.

**Response:**
```json
{
  "id": "brain-gate/add-auth",
  "name": "add-auth",
  "sourceId": "brain-gate",
  "status": "in_progress",
  "proposal": "# Change: Add Auth\n...",
  "design": null,
  "specs": [
    { "path": "auth/spec.md", "content": "# Auth Spec\n..." }
  ],
  "tasks": {
    "raw": "# Tasks\n- [x] 1.1 ...",
    "stats": { "total": 12, "done": 3 }
  }
}
```
*Note: `design` content comes from `design.md` if present.*

### 4. List Specs
`GET /api/specs`

Returns all source-of-truth specs from `specs/` directories.

**Response:**
```json
{
  "specs": [
    { "id": "brain-gate/chat", "sourceId": "brain-gate", "path": "chat/spec.md" },
    { "id": "brain-gate/config", "sourceId": "brain-gate", "path": "configuration/spec.md" }
  ]
}
```

### 5. Get Spec Content
`GET /api/specs/:id`

Returns single spec content.

**Response:**
```json
{
  "id": "brain-gate/chat",
  "sourceId": "brain-gate",
  "path": "chat/spec.md",
  "content": "# Chat Specification\n..."
}
```

### 6. Real-time Events
`SSE /api/events`

Pushes a generic update event when any file in the watched paths changes.

**Event:** `update`
**Data:** `{"type": "update"}`

*Client strategy: On receiving `update`, re-fetch lists and current details.*

### 7. Get Configuration
`GET /api/config`

Returns the current application configuration.

**Response:**
```json
{
  "sources": [
    { "name": "brain-gate", "path": "/path/to/openspec" },
    { "name": "megg", "path": "/path/to/openspec" }
  ],
  "port": 3000
}
```

### 8. Update Sources
`PUT /api/config/sources`

Updates the source list at runtime with hot-reload support.

**Request Body:**
```json
{
  "sources": [
    { "name": "brain-gate", "path": "/path/to/openspec" },
    { "name": "megg", "path": "/path/to/openspec" }
  ]
}
```

**Behavior:**
1. Validates that all source paths exist and are directories.
2. If valid:
   - Updates in-memory configuration.
   - Persists changes to `openspec-ui.json`.
   - Restarts file watchers to monitor new paths.
   - Triggers SSE `update` event.
   - Returns `200 OK` with updated configuration.
3. If invalid:
   - Returns `400 Bad Request` with error message indicating which path is invalid.
   - Does not update configuration or watchers.

**Response (Success):**
```json
{
  "sources": [
    { "name": "brain-gate", "path": "/path/to/openspec" }
  ],
  "port": 3000
}
```

**Response (Error):**
```json
{
  "error": "Path does not exist: /invalid/path"
}
```
### 9. List Ideas
`GET /api/ideas`

Returns all ideas across all sources.

**Response:**
```json
{
  "ideas": [
    {
      "id": "brain-gate/idea-123",
      "sourceId": "brain-gate",
      "title": "Add Dark Mode",
      "description": "We should support dark mode.",
      "createdAt": "2024-01-01T12:00:00Z",
      "updatedAt": "2024-01-01T12:00:00Z"
    }
  ]
}
```

### 10. Create Idea
`POST /api/ideas`

Creates a new idea in the specified source's `ideas/` directory.

**Request Body:**
```json
{
  "sourceId": "brain-gate",
  "title": "New Feature",
  "description": "Description here"
}
```

**Response:**
Returns the created idea object.

### 11. Update Idea
`PUT /api/ideas/:id`

Updates an existing idea's title or description.

**Request Body:**
```json
{
  "title": "Updated Title",
  "description": "Updated Description"
}
```

**Response:**
Returns the updated idea object.

### 12. Delete Idea
`DELETE /api/ideas/:id`

Permanently deletes an idea file from the source directory.

**Response:**
Returns 200 OK on success.


