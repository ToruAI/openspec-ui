## ADDED Requirements

### Requirement: Settings Dialog Access
The application SHALL provide a settings dialog accessible from the main header.

#### Scenario: Accessing Settings
- **Given** I am on any view (Kanban or Specs),
- **When** I click the "Settings" (gear) icon in the Header,
- **Then** a modal dialog opens showing the "Sources" configuration tab.

### Requirement: Source Management
The application SHALL allow users to manage OpenSpec sources within the settings dialog.

#### Scenario: Listing Sources
- **Given** the Settings modal is open,
- **Then** I see a list of currently configured sources with their Names and Paths.
- **And** invalid sources (paths that don't exist) are visually highlighted (e.g., red border/text).

#### Scenario: Adding a Source
- **Given** the Settings modal is open,
- **When** I click "Add Source",
- **Then** a new empty row or form appears.
- **When** I enter a Name and a Path and click "Save",
- **Then** the source is added to the configuration.
- **And** the UI updates to show the new source data immediately (hot-reload).

#### Scenario: Removing a Source
- **Given** I have multiple sources configured,
- **When** I click "Remove/Delete" next to a source,
- **Then** the source is removed from the list and configuration.

#### Scenario: Validation Error
- **Given** I try to add a source with a non-existent path,
- **When** I submit the form,
- **Then** the UI displays an error message returned by the backend (e.g., "Path not found").
