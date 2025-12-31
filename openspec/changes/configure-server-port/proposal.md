# Change: Configure Server Port

## Summary
Add a "Port" configuration field to the Settings UI, allowing users to change the server port.

## Why
Users may need to run OpenSpec UI on a different port to avoid conflicts or to fit their local development environment. Currently, this requires manual config editing or CLI flags.

## Solution
1.  **Frontend**: Add a "Port" input field to the Settings modal (created in `add-settings-ui`).
2.  **Frontend**: Display a warning that changing the port requires a manual server restart.
3.  **Backend**: Update the config endpoints to handle port updates.
