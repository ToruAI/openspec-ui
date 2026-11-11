# Proposal

## Why

We can only reach app users by email, and delivery updates arrive after the parcel does. Push would close that gap, but asking for permission on first launch gets about 30% acceptance.

## What Changes

- Ask for push permission after the first completed order, with a short explanation
- Register the device token with the backend
- Send "shipped" and "delivered" notifications

## Capabilities

### New Capabilities
- `push-notifications`: Permission, registration and delivery of push messages

### Modified Capabilities


## Impact

- New device token endpoint
- Notification service sends via APNs and FCM
