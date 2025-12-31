# chat Specification Delta

## ADDED Requirements

### Requirement: Model Selection
The system SHALL allow users to select which AI model to use for chat messages.

#### Scenario: User views available models
- **GIVEN** the user opens the application
- **WHEN** the sidebar loads
- **THEN** the sidebar footer displays a model selector
- **AND** the selector shows the current model name
- **AND** connected providers are fetched from OpenCode

#### Scenario: User changes model
- **GIVEN** the user clicks the model selector
- **WHEN** the dropdown opens
- **THEN** available models are grouped by provider
- **AND** only connected providers are shown
- **AND** the user can select a different model

#### Scenario: Selected model is used for messages
- **GIVEN** the user has selected a model
- **WHEN** the user sends a message
- **THEN** the message is sent with the selected model
- **AND** the response uses that model

#### Scenario: Model selection persists in session
- **GIVEN** the user selected a model
- **WHEN** the user switches sessions and returns
- **THEN** the model selection is preserved
- **AND** the selector shows the previously selected model

### Requirement: Provider API Proxy
The backend SHALL proxy provider information from OpenCode.

#### Scenario: GET providers returns connected models
- **GIVEN** OpenCode has connected providers
- **WHEN** the frontend calls GET /api/providers
- **THEN** the backend fetches from OpenCode GET /provider
- **AND** returns the provider list with connected status
- **AND** includes available models per provider

#### Scenario: No providers connected
- **GIVEN** OpenCode has no connected providers
- **WHEN** the frontend calls GET /api/providers
- **THEN** the backend returns an empty connected list
- **AND** the frontend shows a "No models available" message
