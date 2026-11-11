# Proposal

## Why

Visitors can only browse by category, and about a third of sessions end on a category page with no click. Customers who know what they want ("monstera", "stoneware mug") have no way to say so.

## What Changes

- Add a search box to the header with typeahead suggestions
- Add a `/search` results page with category and price filters
- Index product titles, plant species names and tags in Postgres full-text search

## Capabilities

### New Capabilities
- `search`: Typeahead and results page for catalog search

### Modified Capabilities


## Impact

- New `search` API route and `/search` page
- Migration adding a `tsvector` column and GIN index on `products`
