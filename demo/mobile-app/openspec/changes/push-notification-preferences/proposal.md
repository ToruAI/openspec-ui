# Proposal

## Why

Push is currently on or off. Since we added back-in-stock and sale alerts to the roadmap, customers who only want delivery updates would have to turn off everything.

## What Changes

- Add a Notifications screen in Settings with one switch per category
- Categories: delivery updates, back in stock, offers
- Store preferences per customer on the server so web emails respect them too

## Capabilities

### New Capabilities


### Modified Capabilities
- `push-notifications`: Per-category preferences, delivery updates always on by default

## Impact

- New `notification_preferences` endpoint
- Notification service filters by category before sending
