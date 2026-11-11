# Spec Delta

## Purpose
Specifies which web links open the app and which screen each one leads to.

## ADDED Requirements

### Requirement: Order and product links
The app SHALL open the order detail screen for links under /orders/{id} and the product screen for links under /products/{slug}, signing the customer in first if needed.

#### Scenario: Order link, signed in
- **WHEN** a signed-in customer taps an order link in an email
- **THEN** the order detail screen opens directly

#### Scenario: Order link, signed out
- **WHEN** a signed-out customer taps an order link
- **THEN** the sign-in screen opens and returns to the order after sign-in

### Requirement: Cold start and warm start
Links MUST work both when the app is launched by the link and when it is already running in the background.

#### Scenario: App in background
- **WHEN** the app is in the background and the customer taps a product link
- **THEN** the app comes to the foreground on that product
