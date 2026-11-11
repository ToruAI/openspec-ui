# push-notifications Specification

## Purpose
Defines when the app asks for push permission and which notifications customers receive.

## Requirements

### Requirement: Contextual permission prompt
The app SHALL NOT request notification permission before the customer has completed an order, and MUST explain the benefit before showing the system dialog.

#### Scenario: After first order
- **WHEN** a customer completes their first order
- **THEN** a pre-prompt explains delivery updates before the system dialog appears

### Requirement: Delivery notifications
The system SHALL send a push notification when an order ships and when it is delivered, to every registered device of the customer who opted in.

#### Scenario: Order shipped
- **WHEN** an order moves to shipped for an opted-in customer
- **THEN** each registered device receives a "Your order is on its way" notification
