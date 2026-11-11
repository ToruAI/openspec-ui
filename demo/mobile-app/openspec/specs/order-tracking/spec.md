# order-tracking Specification

## Purpose
Shows signed-in customers their orders and where each shipment is.

## Requirements

### Requirement: Order list
The Orders tab SHALL list the customer's orders from the last 12 months, newest first, each with its current status.

#### Scenario: Orders listed
- **WHEN** a signed-in customer opens the Orders tab
- **THEN** orders appear newest first with status badges

### Requirement: Delivery timeline
The order detail screen MUST show the five delivery states with the current one highlighted and the time of the last update.

#### Scenario: In transit
- **WHEN** a shipment is in transit
- **THEN** the timeline highlights "In transit" and shows when it was last updated
