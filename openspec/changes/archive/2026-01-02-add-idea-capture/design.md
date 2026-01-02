# Design: Idea Capture Integration

## Overview
This document describes the design decisions and architectural approach for integrating idea capture into OpenSpec UI.

## Key Design Decisions

### 1. Ideas as Kanban Column (Not Separate View)
**Decision**: Ideas are displayed as the first column in the Kanban board, not as a separate view.

**Rationale**:
- **Workflow Continuity**: Ideas are the starting point for all changes, so they belong at the beginning of the main workflow (Kanban)
- **Mental Model**: Users think of the progression as: Idea → Proposal → Implementation, which maps to the column layout
- **Reduced Context Switching**: No need to navigate between separate screens; everything happens in one cohesive view
- **Consistent UI Patterns**: Ideas follow the same card-based interaction pattern as changes

**Trade-offs**:
- **Pros**: Simpler navigation, clearer workflow, less code to maintain
- **Cons**: Ideas share space with changes; could get crowded if there are many ideas (but this is acceptable for raw ideas that should be converted quickly)

### 2. No Draft Column
**Decision**: Removed Draft column from Kanban board entirely.

**Rationale**:
- **Draft Redundancy**: Draft proposals (proposal.md only) are conceptually similar to ideas - both are incomplete and need work
- **Clarity**: Having both Ideas and Draft columns would be confusing - where should a user put a raw thought?
- **Simplification**: AI agents create proposals directly from ideas using `/openspec-proposal`, which creates proposal.md and tasks.md together (no Draft state)

**Column Flow**:
```
Ideas (raw thoughts) → Todo (has tasks, 0 done) → In Progress → Done → Archived
```

### 3. Agent-Driven Proposal Conversion
**Decision**: AI agents (using `/openspec-proposal` command) convert ideas to proposals. No UI conversion workflow.

**Rationale**:
- **Separation of Concerns**: Users capture raw thoughts; agents handle proposal structure and requirements
- **Expert Workflow**: Proposal creation requires understanding OpenSpec conventions, specs structure, and task breakdown - better suited for AI
- **Flexible Workflows**: Agents can ask clarifying questions, generate tasks, and create spec deltas in a way that's hard to encode in UI
- **Tooling Integration**: OpenSpec already has tooling (commands) for proposal creation; we leverage existing infrastructure

**Workflow**:
1. User creates idea via UI (title + description)
2. User optionally provides clarifying details in description
3. AI agent reads idea and runs `/openspec-proposal`
4. Agent creates `changes/xxx/` directory with proposal.md, tasks.md, and specs/
5. Agent marks tasks in tasks.md
6. Idea remains in Ideas column for reference (or user can delete)

### 4. Minimal Idea Editing
**Decision**: Users can only edit title and description. No editing of id, timestamps, or other metadata.

**Rationale**:
- **Immutability**: ID and timestamps should be system-managed to ensure consistency
- **Simple Mental Model**: Edit what you see (title and content), let system handle metadata
- **Prevent Corruption**: Prevent users from accidentally breaking YAML frontmatter or creating invalid states
- **Audit Trail**: Updated timestamps accurately reflect when changes were made

**Edit Flow**:
1. User clicks idea card → IdeaDetailModal opens
2. User clicks Edit → form appears with pre-filled title and description
3. User modifies fields and saves
4. System updates file with new content and updated timestamp

### 5. Markdown with YAML Frontmatter Storage
**Decision**: Ideas stored as Markdown files with YAML frontmatter in `ideas/` directory.

**Rationale**:
- **Consistency**: Matches OpenSpec's existing file format (proposal.md, tasks.md, etc.)
- **Human-Readable**: Ideas can be read and edited directly in code editor
- **Version Control**: Git tracks changes naturally (diff-friendly)
- **Future Extensibility**: Easy to add new fields to frontmatter (tags, priority, etc.) without breaking
- **Agent Compatibility**: AI tools can easily parse and modify YAML + Markdown

**File Format**:
```markdown
---
id: idea-1234567890
projectId: openspec-ui
createdAt: 2026-01-01T12:00:00Z
updatedAt: 2026-01-01T12:00:00Z
---

# Idea Title

Idea description in plain text...
```

### 6. Multi-Source Idea Support
**Decision**: Ideas stored per-source in `ideas/` directory, similar to `changes/` and `specs/`.

**Rationale**:
- **Consistency**: Matches existing multi-source architecture
- **Scoping**: Ideas belong to specific projects; filtering by source is natural
- **Scalability**: Works with any number of sources
- **Clear Ownership**: Each source manages its own ideas

## Architecture

### Backend Components

**Parser Module (`parser.rs`)**:
- `scan_ideas()`: Read all .md files from `ideas/` directories across sources
- `save_idea()`: Create new idea file with proper YAML frontmatter
- `update_idea()`: Modify existing idea file, update timestamp
- `delete_idea()`: Remove idea file
- `parse_idea_frontmatter()`: Extract metadata from YAML
- `extract_idea_title_and_description()`: Parse content sections

**API Handlers (`main.rs`)**:
- `GET /api/ideas`: List all ideas across all sources
- `POST /api/ideas`: Create new idea
- `PUT /api/ideas/:id`: Update idea (title/description)
- `DELETE /api/ideas/:id`: Delete idea

**SSE Integration**:
- Idea changes trigger `update` event (same as changes/specs)
- Clients refresh ideas list on event

### Frontend Components

**KanbanBoard**:
- Updated columns: Ideas, Todo, In Progress, Done, Archived
- Ideas column renders IdeaCard components
- Filters ideas by selected source (same as changes)

**IdeaCard**:
- Card-based UI showing title, description preview, timestamp
- Click to open IdeaDetailModal

**IdeaDetailModal**:
- Read-only view of full idea content
- Edit mode reuses IdeaCapture component
- Delete confirmation dialog
- Edit button triggers IdeaCapture with pre-filled data

**IdeaCapture**:
- Reused for both create and edit
- Controlled component (open/onOpenChange props)
- Optional `idea` prop for edit mode (pre-fills form)

**Header**:
- "New Idea" button opens IdeaCapture in create mode
- No longer has Ideas navigation tab

### Data Flow

**Create Idea**:
```
User clicks "New Idea"
  → IdeaCapture opens (empty form)
  → User submits title/description
  → POST /api/ideas
  → Backend creates ideas/idea-xxx.md file
  → SSE "update" event broadcast
  → KanbanBoard refreshes (via useIdeas hook)
  → New idea appears in Ideas column
```

**Edit Idea**:
```
User clicks idea card
  → IdeaDetailModal opens (read-only)
  → User clicks Edit
  → IdeaCapture opens (pre-filled with idea data)
  → User modifies fields and submits
  → PUT /api/ideas/:id
  → Backend updates ideas/idea-xxx.md file
  → SSE "update" event broadcast
  → KanbanBoard refreshes
  → Idea card shows updated content
```

**Delete Idea**:
```
User clicks idea card
  → IdeaDetailModal opens
  → User clicks Delete
  → Confirmation dialog appears
  → User confirms
  → DELETE /api/ideas/:id
  → Backend removes ideas/idea-xxx.md file
  → SSE "update" event broadcast
  → KanbanBoard refreshes
  → Idea card disappears
```

## Future Enhancements (Out of Scope)

These are NOT included in current implementation but could be added later:

1. **Idea Status/Tags**: Add fields for "Raw", "Refining", "Ready" or custom tags
2. **Rich Text Description**: Allow formatted text, links, code blocks in idea description
3. **Idea Prioritization**: Add priority field, drag-and-drop reordering in Ideas column
4. **Bulk Actions**: Select multiple ideas to archive or delete
5. **Idea Templates**: Pre-defined templates for common idea types
6. **AI-Assisted Clarification**: Button to ask AI to expand on idea details (creates proposal for review)
7. **Idea to Proposal Preview**: Show what the generated proposal would look like before agent commits
8. **Idea History**: Track edits over time (version control already handles this, but UI could show diff)
9. **Idea Collaboration**: Multiple users editing same idea (would need real-time collaboration features)

## Implementation Notes

### Task Priorities

**High Priority (Core functionality)**:
1. Backend PUT endpoint for updating ideas
2. KanbanBoard Ideas column integration
3. IdeaDetailModal edit mode
4. Cleanup of unused IdeasView code

**Medium Priority (UX improvements)**:
5. Better source/project display on idea cards
6. Loading states for idea operations
7. Error handling and user feedback

**Low Priority (Polish)**:
8. Empty state illustration for Ideas column
9. Keyboard shortcuts for idea actions
10. Analytics/telemetry for idea conversion rates

### Testing Considerations

**Backend**:
- Test idea file format (YAML frontmatter parsing)
- Test timestamp updates on edit
- Test SSE events for all CRUD operations
- Test multi-source idea filtering

**Frontend**:
- Test Ideas column rendering with various idea counts
- Test edit mode pre-filling and saving
- Test delete confirmation flow
- Test real-time updates when ideas change from other clients

### Migration Path

Since this is already partially implemented:
1. Keep existing working code (idea storage, GET/POST/DELETE endpoints)
2. Add missing PUT endpoint
3. Refactor UI to use Kanban column instead of separate view
4. Remove obsolete code (IdeasView, Ideas navigation)
5. Update documentation (this design doc)

No data migration needed - existing ideas in `ideas/` directories work as-is.

## Conclusion

This design integrates ideas naturally into the OpenSpec workflow, keeping the UI simple while providing powerful agent-driven proposal creation. The Kanban board provides a clear visual representation of the entire development lifecycle from raw idea to archived change.