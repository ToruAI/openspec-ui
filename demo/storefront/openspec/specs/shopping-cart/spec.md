# shopping-cart Specification

## Purpose
Defines how the cart is stored, merged and expired so shoppers do not lose items.

## Requirements

### Requirement: Persistent cart
The storefront SHALL keep cart contents across page reloads and browser restarts for 30 days.

#### Scenario: Reload keeps items
- **WHEN** a visitor with two items in the cart reloads the page
- **THEN** the cart still shows both items with current prices

### Requirement: Cart merge on login
When an anonymous visitor signs in, the system MUST merge the anonymous cart into the account cart and sum quantities of identical items.

#### Scenario: Merge duplicates
- **WHEN** the anonymous cart has 1 fern and the account cart has 2 ferns
- **THEN** after login the cart has 3 ferns
