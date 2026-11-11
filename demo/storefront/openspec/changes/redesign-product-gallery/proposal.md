# Proposal

## Why

The product gallery is a 2019-era slider that downloads every image up front and cannot be swiped smoothly on phones. Photos drive purchase decisions for ceramics, and the gallery accounts for 60% of page weight on product pages.

## What Changes

- Replace the slider with a scroll-snap carousel and a thumbnail strip
- Load only the first image eagerly and lazy-load the rest
- Add pinch-to-zoom on mobile and a lightbox on desktop

## Capabilities

### New Capabilities


### Modified Capabilities
- `product-catalog`: Gallery behaviour on the product detail page

## Impact

- `ProductGallery` component rewritten; slider dependency removed
- Image CDN presets for 3 widths added
