## ADDED Requirements

### Requirement: Idea Capture Interface
The system SHALL provide a UI for quickly capturing raw ideas with minimal friction.

#### Scenario: Quick idea input
- **WHEN** a user clicks "New Idea" in the header
- **THEN** a dialog appears with title and description fields

#### Scenario: Idea creation
- **WHEN** a user submits the idea capture form
- **THEN** the idea is saved and the dialog closes

### Requirement: Ideas View
The system SHALL provide a dedicated view for managing raw ideas.

#### Scenario: Ideas list display
- **WHEN** a user navigates to the Ideas tab
- **THEN** a list of all ideas is displayed with title, description preview, and creation date

#### Scenario: Ideas navigation
- **WHEN** a user switches between Kanban, Specs, and Ideas views
- **THEN** the current view preference is persisted in localStorage

### Requirement: Idea Actions
The system SHALL provide quick actions for managing ideas in the list view.

#### Scenario: Delete idea
- **WHEN** a user clicks delete on an idea
- **THEN** a confirmation dialog appears before deletion

#### Scenario: Real-time idea updates
- **WHEN** an idea is created or deleted (via SSE)
- **THEN** the ideas list automatically refreshes to reflect changes

### Requirement: Idea Metadata Display
The system SHALL show metadata about ideas to help users prioritize.

#### Scenario: Created timestamp
- **WHEN** viewing the ideas list
- **THEN** each idea shows when it was created (relative time or formatted date)

#### Scenario: Empty state
- **WHEN** no ideas exist
- **THEN** an empty state message is displayed with a call-to-action to create the first idea
