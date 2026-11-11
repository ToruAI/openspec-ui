# Proposal

## Why

Android and iOS users have had system dark mode for years; the app ignores it and flashes white at night. It is the second most mentioned complaint in reviews.

## What Changes

- Introduce semantic color tokens instead of hard-coded hex values
- Follow the system appearance by default
- Add a manual override in Settings

## Capabilities

### New Capabilities
- `appearance`: Light and dark themes and the user override

### Modified Capabilities


## Impact

- Every screen moves from raw colors to theme tokens
- Product photos keep a neutral background in both themes
