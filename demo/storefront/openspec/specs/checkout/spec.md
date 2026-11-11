# checkout Specification

## Purpose
Describes the steps and guarantees of placing an order, for guests and signed-in customers.

## Requirements

### Requirement: Guest checkout
The storefront SHALL allow a visitor to place an order with an email address and a shipping address, without creating an account.

#### Scenario: Guest completes order
- **WHEN** a visitor without an account fills in email, address and payment
- **THEN** the order is created and a confirmation page is shown

#### Scenario: Invalid email
- **WHEN** the visitor enters an email without an @ sign
- **THEN** the form shows an inline error and does not continue

### Requirement: Order confirmation email
The system MUST send a confirmation email within one minute of a successful payment, including the order number and a tracking link.

#### Scenario: Email sent
- **WHEN** a payment succeeds
- **THEN** an email with the order number is queued for the buyer
