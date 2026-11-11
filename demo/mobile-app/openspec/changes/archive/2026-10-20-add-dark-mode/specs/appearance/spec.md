# Spec Delta

## Purpose
Controls the app theme: follows the system by default and can be overridden by the customer.

## ADDED Requirements

### Requirement: Follow system appearance
By default the app SHALL use the light or dark theme that matches the device setting and switch immediately when the setting changes.

#### Scenario: System switches to dark
- **WHEN** the device switches to dark mode while the app is open
- **THEN** the app re-renders in the dark theme without a restart

### Requirement: Manual override
The Settings screen MUST offer System, Light and Dark options and the choice SHALL persist across launches.

#### Scenario: Forced light
- **WHEN** a customer selects Light on a device in dark mode
- **THEN** the app stays light after restart
