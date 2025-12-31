# Change: Add Responsive Mobile-First UI

## Why
The current UI is desktop-first with hardcoded widths and heights. On mobile:
- Kanban columns overflow horizontally (unusable)
- Specs sidebar doesn't collapse (broken layout)
- Header controls clash on small screens
- Modal is too large for mobile viewports

Users need a responsive experience that works seamlessly from phone to desktop.

## What Changes

### Kanban View
- **Mobile**: Swipeable tabs — one column at a time with status dots indicator
- **Desktop**: Horizontal columns (current behavior, refined)
- Remove hardcoded `calc()` heights in favor of flex-based layout

### Specs View
- **Mobile**: Sidebar becomes a slide-in drawer (sheet component)
- **Desktop**: Fixed sidebar (current behavior)

### Header
- Make view toggle optional via props (plugin-ready)
- **Mobile**: Collapse to essential controls, hamburger menu if needed
- **Desktop**: Full controls visible

### Modal (DetailModal)
- **Mobile**: Full-screen or near-full-screen sheet
- **Desktop**: Centered dialog (current behavior, sized appropriately)

### Design System Cleanup
- Standardize on Tailwind semantic tokens (`text-muted-foreground`)
- Remove mixed `var(--color-*)` usage where shadcn tokens exist

## Goals
- **Mobile-first**: Design for smallest screen, enhance for larger
- **Plugin-ready**: Header can hide view toggle when embedded
- **Consistent**: One design token system throughout

## Non-Goals
- Adding new features
- Changing functionality
- Restructuring component hierarchy (beyond necessary)

## Impact
- Affected specs: `ui/spec.md`
- Affected code: All components in `frontend/src/components/`
- No backend changes
