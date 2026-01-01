## ADDED Requirements

### Requirement: Idea Management API
The system SHALL provide REST API endpoints for managing raw ideas before they become full proposals.

#### Scenario: List all ideas
- **WHEN** a client requests GET /api/ideas
- **THEN** the server returns an array of all ideas with id, title, description, createdAt, and updatedAt fields

#### Scenario: Create new idea
- **WHEN** a client posts to POST /api/ideas with title and description
- **THEN** the server creates a new idea in the ideas/ directory and returns the created idea

#### Scenario: Delete idea
- **WHEN** a client sends DELETE /api/ideas/:id
- **THEN** the server removes the idea file from the ideas/ directory

### Requirement: Idea Storage Format
The system SHALL store ideas in a dedicated `ideas/` directory at the root of each OpenSpec source.

#### Scenario: Idea file creation
- **WHEN** a new idea is created
- **THEN** a Markdown file is created at `ideas/[idea-id].md` with YAML frontmatter for metadata

#### Scenario: Idea file format
- **WHEN** storing an idea as Markdown
- **THEN** the file contains YAML frontmatter (id, createdAt, updatedAt) followed by title and description content

#### Scenario: Idea file listing
- **WHEN** listing ideas
- **THEN** the system reads all .md files from the `ideas/` directory

### Requirement: Real-time Idea Updates
The system SHALL broadcast SSE events when ideas are created, modified, or deleted.

#### Scenario: Idea created event
- **WHEN** an idea is created via API
- **THEN** an SSE `update` event is broadcast to all connected clients

#### Scenario: Idea deleted event
- **WHEN** an idea is deleted via API
- **THEN** an SSE `update` event is broadcast to all connected clients
