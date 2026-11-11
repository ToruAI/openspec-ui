# product-catalog Specification

## Purpose
Defines what the catalog shows about each product on listing and detail pages.

## Requirements

### Requirement: Plant care badges
The product page SHALL display light needs, watering frequency and pet safety for every product in the "Plants" category.

#### Scenario: Badges shown
- **WHEN** a visitor opens a plant product page
- **THEN** three badges for light, watering and pet safety appear above the description

### Requirement: Care guide
The product page MUST include a collapsible care guide for plants, collapsed by default on mobile.

#### Scenario: Guide collapsed on mobile
- **WHEN** a visitor opens a plant page on a 390 px wide screen
- **THEN** the care guide is collapsed and expands on tap
