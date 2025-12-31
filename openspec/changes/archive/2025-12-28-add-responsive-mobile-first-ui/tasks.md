# Tasks: Add Responsive Mobile-First UI

## 1. Design System Cleanup
- [x] 1.1 Audit and replace `var(--color-*)` with shadcn semantic tokens
- [x] 1.2 Remove unused CSS variables from `index.css`

## 2. Kanban View - Mobile First
- [x] 2.1 Create swipeable tab component for mobile column navigation
- [x] 2.2 Add status dots indicator showing current column position
- [x] 2.3 Refactor KanbanBoard to detect viewport and switch layouts
- [x] 2.4 Remove hardcoded `calc()` heights, use flex layout
- [x] 2.5 Make cards full-width on mobile

## 3. Specs View - Responsive Sidebar
- [x] 3.1 Add Sheet component for mobile sidebar drawer
- [x] 3.2 Refactor SpecsView to toggle between sidebar and drawer based on viewport
- [x] 3.3 Add trigger button to open drawer on mobile
- [x] 3.4 Remove hardcoded heights, use flex layout

## 4. Header - Plugin Ready
- [x] 4.1 Add `showViewToggle` prop to Header component
- [x] 4.2 Refactor Header layout for mobile (hamburger menu with Sheet)
- [x] 4.3 Use shadcn Button component for navigation

## 5. Detail Modal - Mobile Optimization
- [x] 5.1 Make modal full-screen on mobile viewports (Drawer component)
- [x] 5.2 Improve tab navigation for touch targets
- [x] 5.3 Ensure scroll areas work properly on mobile

## 6. Testing & Polish
- [x] 6.1 TypeScript compilation passes
- [x] 6.2 Vite build succeeds
- [x] 6.3 Manual testing on mobile viewport (375px - 428px)
- [x] 6.4 Manual testing on tablet viewport (768px - 1024px)
- [x] 6.5 Manual testing on desktop viewport (1280px+)
