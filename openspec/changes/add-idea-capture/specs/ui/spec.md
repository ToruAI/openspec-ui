## ADDED Requirements

### Requirement: Idea Capture Interface
The system SHALL provide a UI for quickly capturing raw ideas with minimal friction.

#### Scenario: Quick idea input
- **WHEN** a user clicks "New Idea" in the header
- **THEN** a dialog appears with title, optional project selection, and description fields

#### Scenario: Idea creation
- **WHEN** a user submits idea capture form
- **THEN** the idea is saved and dialog closes
- **AND** the new idea appears in the Ideas column of Kanban board

### Requirement: Ideas Column in Kanban Board
The system SHALL display ideas as the first column in the Kanban board.

#### Scenario: Ideas column display
- **WHEN** viewing the Kanban board
- **THEN** the first column displays all ideas from all sources (or filtered by selected source)
- **AND** each idea is shown as a card with title, description preview, and creation timestamp

#### Scenario: Ideas column layout
- **WHEN** the Kanban board is displayed
- **THEN** columns are ordered: Ideas, Todo, In Progress, Done, Archived
- **AND** the Draft column is no longer present

#### Scenario: Idea card display
- **WHEN** viewing an idea in the Ideas column
- **THEN** the card shows: title (truncated), description preview (max 2-3 lines), and relative creation time
- **AND** the card indicates which source/project the idea belongs to (via badge or icon)

### Requirement: Idea Detail View
The system SHALL provide a detail view for viewing and editing ideas.

#### Scenario: View idea details
- **WHEN** a user clicks on an idea card
- **THEN** a modal opens showing full idea content with title, description, and metadata
- **AND** the modal includes actions: Edit and Delete

#### Scenario: Edit idea
- **WHEN** a user clicks Edit on an idea
- **THEN** a form appears with pre-filled title and description
- **AND** user can modify these fields and save changes
- **AND** the modal closes and the idea card updates in the Ideas column

#### Scenario: Delete idea
- **WHEN** a user clicks Delete on an idea
- **THEN** a confirmation dialog appears before deletion
- **AND** upon confirmation, the idea is removed and card disappears from Ideas column

### Requirement: Idea Actions in Detail Modal
The system SHALL provide actions for managing ideas from the detail view.

#### Scenario: Edit action
- **WHEN** a user opens idea detail modal
- **THEN** an Edit button is available that opens the idea capture form in edit mode

#### Scenario: Delete action
- **WHEN** a user opens idea detail modal
- **THEN** a Delete button is available that requires confirmation before deletion

### Requirement: Real-time Idea Updates
The system SHALL reflect idea changes in real-time.

#### Scenario: Idea appears after creation
- **WHEN** an idea is created (by user or agent)
- **THEN** the idea card immediately appears in the Ideas column without page refresh

#### Scenario: Idea updates after edit
- **WHEN** an idea is edited
- **THEN** the idea card content updates to reflect changes in real-time

#### Scenario: Idea disappears after deletion
- **WHEN** an idea is deleted
- **THEN** the idea card immediately disappears from the Ideas column

### Requirement: Idea Filtering
The system SHALL filter ideas based on selected project source.

#### Scenario: Filter ideas by source
- **WHEN** a user selects a specific project from the source dropdown
- **THEN** only ideas from that source are displayed in the Ideas column

#### Scenario: Show all ideas
- **WHEN** a user selects "All Projects" from the source dropdown
- **THEN** all ideas from all sources are displayed in the Ideas column

## REMOVED Requirements

### Requirement: Ideas View
This requirement has been removed as ideas are now integrated into the Kanban board.

### Requirement: Ideas Navigation
This requirement has been removed as there is no longer a separate Ideas view or tab.

### Requirement: View Preference Persistence
This requirement has been removed as there is no longer an Ideas view to persist separately from Kanban and Specs views.
