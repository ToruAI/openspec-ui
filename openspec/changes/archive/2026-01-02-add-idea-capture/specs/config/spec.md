## ADDED Requirements

### Requirement: Idea Monitoring
The system SHALL monitor the `ideas/` directory in each source for changes.

- **Validation**: Warn if `ideas/` directory cannot be accessed.
- **Hot Reload**: Changes to files in `ideas/` (creation, update, deletion) are detected automatically via file watchers.
- **Parsing**: Valid markdown files in `ideas/` are parsed as ideas.
