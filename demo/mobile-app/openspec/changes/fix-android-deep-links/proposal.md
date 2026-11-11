# Proposal

## Why

On Android, tapping an order email or a push notification opens the app on the home screen, or the browser, instead of the order. The assetlinks file is missing the release signing key and two routes are not registered.

## What Changes

- Publish a correct `assetlinks.json` including the Play App Signing key
- Register the `/orders/{id}` and `/products/{slug}` routes for links
- Handle links when the app is cold-started and when it is already running

## Capabilities

### New Capabilities
- `deep-links`: Opening app screens from web links and notifications

### Modified Capabilities


## Impact

- Android manifest intent filters
- Well-known file on the storefront domain
- Navigation linking config shared with iOS
