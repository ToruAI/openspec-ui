# Change: Add Settings UI & Source Management

## Summary
Introduce a "Settings" dialog in the UI allowing users to dynamically add, edit, and remove OpenSpec sources without restarting the server.

## Why
Currently, configuring sources requires manually editing `openspec-ui.json` and restarting the backend. This friction discourages users from adding new repos or fixing paths. A hot-reloadable settings UI will make the tool significantly more user-friendly.

## Solution
1.  **Frontend**: Add a "Settings" icon/button to the header opening a modal.
2.  **Frontend**: Implement a form to list current sources, add new ones, and remove existing ones.
3.  **Backend**: Expose endpoints to read/write config.
4.  **Backend**: Refactor source management to support runtime updates (hot-reload) of file watchers and state.
