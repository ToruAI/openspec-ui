# Proposal

## Why

Category pages have an LCP of 4.1 s on mid-range phones (field data, p75), the worst in the shop and the page type with the most organic traffic. Slow listings directly reduce clicks into product pages.

## What Changes

- Server-render the first 12 products and stream the rest
- Serve listing thumbnails at 320 px instead of 800 px
- Move filter state to the URL so filtered pages can be cached at the edge

## Capabilities

### New Capabilities


### Modified Capabilities


## Impact

- No spec-level behaviour change, so this change carries no spec deltas
- Edge cache rules added for `/c/*`
