# Spec Delta

## Purpose
Describes what the pipeline does on every pull request and merge, including preview environments.

## ADDED Requirements

### Requirement: Preview environment per pull request
The pipeline SHALL deploy every open pull request of a service to its own namespace and post the URL on the pull request.

#### Scenario: PR opened
- **WHEN** a developer opens a pull request
- **THEN** a preview URL is commented within 10 minutes of the first successful build

### Requirement: Preview cleanup
Preview environments MUST be deleted when their pull request closes, and no later than 7 days after the last push.

#### Scenario: PR merged
- **WHEN** a pull request is merged
- **THEN** its namespace and database are deleted
