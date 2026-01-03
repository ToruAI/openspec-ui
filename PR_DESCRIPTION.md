# Add Idea Capture

## Summary
This PR introduces the "Idea Capture" feature, allowing users to quickly jot down raw ideas before developing them into full proposals.

## Changes
- **Backend**:
  - Added REST API endpoints for Ideas (GET, POST, PUT, DELETE).
  - Implemented file-based storage for ideas (`ideas/` directory with Markdown + YAML frontmatter).
  - Added real-time updates via SSE.
- **Frontend**:
  - Added "Ideas" column to the Kanban board (replacing "Draft").
  - Added "New Idea" button to the header.
  - Created `IdeaCapture` modal for creating and editing ideas.
  - Created `IdeaCard` and `IdeaDetailModal` components.
- **Specs**:
  - Documented new requirements and API endpoints in OpenSpec.

## Impact
- Users can now capture thoughts immediately without creating full proposal artifacts.
- The Kanban workflow now starts with "Ideas".

