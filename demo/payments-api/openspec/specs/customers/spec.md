# customers Specification

## Purpose
Stores customer references and saved payment method tokens, never raw card data.

## Requirements

### Requirement: Saved payment methods
The API SHALL let an authenticated customer list, attach and detach payment methods, exposing only brand, last4 and expiry.

#### Scenario: List methods
- **WHEN** a customer with two saved cards calls the list endpoint
- **THEN** the response contains brand, last4 and expiry for each and no card numbers

### Requirement: Pay with saved method
The API MUST accept a saved payment method id when confirming an intent for the same customer and reject it for any other customer.

#### Scenario: Foreign method
- **WHEN** customer A confirms with a method that belongs to customer B
- **THEN** the response is 403 with error code payment_method_not_owned
