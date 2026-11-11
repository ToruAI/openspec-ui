# Spec Delta

## Purpose
Lets shoppers find products by name, species or tag from anywhere in the storefront.

## ADDED Requirements

### Requirement: Typeahead suggestions
The storefront SHALL show up to 6 product suggestions while the visitor types, starting at the second character.

#### Scenario: Suggestions appear
- **WHEN** the visitor types "mons" in the search box
- **THEN** a dropdown lists matching products, with "Monstera deliciosa" first

#### Scenario: No match
- **WHEN** the visitor types a term with no matches
- **THEN** the dropdown shows a "No products found" message and a link to all categories

### Requirement: Results page filters
The results page MUST let the visitor narrow results by category and price range without losing the query.

#### Scenario: Filter by category
- **WHEN** the visitor selects the "Ceramics" category on the results page
- **THEN** only ceramic products matching the query remain and the query stays in the box
