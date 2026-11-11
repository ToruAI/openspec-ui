# Design

## Context

Category pages are client-rendered: the shell loads, then the product grid is fetched from the API. Filter state lives in React state, so every filtered view is a cache miss.

## Goals / Non-Goals

**Goals:**
- p75 LCP under 2.5 s
- Filtered category URLs are cacheable and shareable

**Non-Goals:**
- Redesigning the product card
- Infinite scroll

## Decisions

**Stream the grid, do not paginate it.** The first 12 products are in the initial HTML; the rest arrive via a suspense boundary, so the LCP element is never behind a fetch.

**Filters in the query string.** Sorted, normalised query params give a small set of cacheable URLs; unknown params are dropped at the edge.

## Risks / Trade-offs

- Stale prices for up to 60 s at the edge; acceptable because the cart re-reads prices
- More cache keys; watch hit rate after rollout
