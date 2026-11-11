# Spec Delta

## ADDED Requirements

### Requirement: Saved address selection
A signed-in customer with saved addresses SHALL see the default address preselected at checkout and MUST be able to choose another saved address or enter a new one.

#### Scenario: Default preselected
- **WHEN** a signed-in customer with two saved addresses opens checkout
- **THEN** the default address is selected and the other is one tap away

#### Scenario: Save after order
- **WHEN** a customer pays with a new address and has fewer than 5 saved
- **THEN** the confirmation page offers to save the address

## MODIFIED Requirements

### Requirement: Guest checkout
The storefront SHALL allow a visitor to place an order with an email address and a shipping address, without creating an account. Guests MUST NOT see saved addresses and are offered account creation only after payment.

#### Scenario: Guest completes order
- **WHEN** a visitor without an account fills in email, address and payment
- **THEN** the order is created and a confirmation page is shown

#### Scenario: Invalid email
- **WHEN** the visitor enters an email without an @ sign
- **THEN** the form shows an inline error and does not continue

#### Scenario: Guests see no saved addresses
- **WHEN** a visitor is not signed in
- **THEN** the checkout address step shows an empty form
