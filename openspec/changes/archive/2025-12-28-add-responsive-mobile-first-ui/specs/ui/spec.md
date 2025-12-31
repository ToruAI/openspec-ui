# Delta for UI

## MODIFIED Requirements

### Requirement: Kanban Board Display
The system SHALL display changes in a Kanban board with columns for each status (Draft, Todo, In Progress, Done). On mobile viewports, the system SHALL display one column at a time with swipe navigation between columns.

#### Scenario: Desktop kanban view
- **WHEN** viewport width is 768px or greater
- **THEN** all four columns are displayed horizontally

#### Scenario: Mobile kanban view
- **WHEN** viewport width is less than 768px
- **THEN** one column is displayed at full width
- **AND** user can swipe left/right to navigate between columns
- **AND** status dots indicate current column position

### Requirement: Specs Browser
The system SHALL display specs in a sidebar navigation with content area. On mobile viewports, the sidebar SHALL be hidden and accessible via a drawer.

#### Scenario: Desktop specs view
- **WHEN** viewport width is 768px or greater
- **THEN** sidebar is visible alongside content area

#### Scenario: Mobile specs view
- **WHEN** viewport width is less than 768px
- **THEN** sidebar is hidden by default
- **AND** a menu button reveals the sidebar as a slide-in drawer

### Requirement: Detail Modal
The system SHALL display change details in a modal dialog. On mobile viewports, the modal SHALL expand to full-screen.

#### Scenario: Desktop modal
- **WHEN** viewport width is 768px or greater
- **THEN** modal is centered with max-width constraint

#### Scenario: Mobile modal
- **WHEN** viewport width is less than 768px
- **THEN** modal expands to full viewport height and width

## ADDED Requirements

### Requirement: Plugin Mode
The system SHALL support embedding as a plugin with configurable UI chrome.

#### Scenario: Hide view toggle
- **WHEN** `showViewToggle` prop is false
- **THEN** the Kanban/Specs toggle buttons are not rendered

#### Scenario: Single view mode
- **WHEN** `defaultView` prop is set and `showViewToggle` is false
- **THEN** only the specified view is rendered without navigation
