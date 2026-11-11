# Spec Delta

## ADDED Requirements

### Requirement: Offline access
The app SHALL display the most recently loaded orders and shipment statuses when the device has no connectivity, and MUST label them with the time they were last updated.

#### Scenario: Airplane mode
- **WHEN** a customer opens the Orders tab in airplane mode after having loaded it earlier
- **THEN** the cached orders appear with an "Offline, last updated" banner

#### Scenario: Cache cleared on sign-out
- **WHEN** a customer signs out
- **THEN** cached order data is removed from the device
