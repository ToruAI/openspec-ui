# Spec Delta

## ADDED Requirements

### Requirement: Notification categories
The app SHALL let a customer enable or disable delivery updates, back-in-stock alerts and offers independently, and the system MUST NOT send a push in a disabled category.

#### Scenario: Offers off by default
- **WHEN** a customer opts in to push for the first time
- **THEN** delivery updates are on and offers are off

#### Scenario: Disabled category
- **WHEN** a customer disables back-in-stock alerts and an item is restocked
- **THEN** no push is sent to that customer for the restock
