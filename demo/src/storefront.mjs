// Fernhill Goods web storefront (Next.js). Fictional.
export default {
  context: `
Fernhill Goods sells houseplants and ceramics in the EU. This is the customer-facing web storefront.
Next.js (App Router) with TypeScript; product data in Postgres, payments delegated to payments-api.
Prices are stored in cents and rendered in EUR. Every user-facing string goes through the i18n catalog.
Pages must stay within the performance budget: LCP under 2.5 s on a mid-range phone over 4G.
`,
  changes: [
    // ---------------------------------------------------------------- archived
    {
      name: 'add-product-search',
      created: '2026-08-04',
      archivedOn: '2026-08-19',
      proposal: {
        why: 'Visitors can only browse by category, and about a third of sessions end on a category page with no click. Customers who know what they want ("monstera", "stoneware mug") have no way to say so.',
        what: [
          'Add a search box to the header with typeahead suggestions',
          'Add a `/search` results page with category and price filters',
          'Index product titles, plant species names and tags in Postgres full-text search',
        ],
        newCaps: [['search', 'Typeahead and results page for catalog search']],
        impact: ['New `search` API route and `/search` page', 'Migration adding a `tsvector` column and GIN index on `products`'],
      },
      specs: {
        search: {
          purpose: 'Lets shoppers find products by name, species or tag from anywhere in the storefront.',
          added: [
            [
              'Typeahead suggestions',
              'The storefront SHALL show up to 6 product suggestions while the visitor types, starting at the second character.',
              [
                ['Suggestions appear', 'the visitor types "mons" in the search box', 'a dropdown lists matching products, with "Monstera deliciosa" first'],
                ['No match', 'the visitor types a term with no matches', 'the dropdown shows a "No products found" message and a link to all categories'],
              ],
            ],
            [
              'Results page filters',
              'The results page MUST let the visitor narrow results by category and price range without losing the query.',
              [['Filter by category', 'the visitor selects the "Ceramics" category on the results page', 'only ceramic products matching the query remain and the query stays in the box']],
            ],
          ],
        },
      },
      tasks: {
        'Database': ['Add tsvector column and GIN index to products', 'Backfill the index for existing products'],
        'API and UI': ['Implement the typeahead endpoint with a 150 ms debounce', 'Build the results page with filters', 'Add search box to the header on mobile and desktop'],
      },
      done: 'all',
    },
    {
      name: 'add-cart-persistence',
      created: '2026-08-25',
      archivedOn: '2026-09-04',
      proposal: {
        why: 'Carts live in React state, so a refresh or a switch from phone to laptop empties them. Support reported 40 tickets last month from customers who lost a cart.',
        what: ['Persist the cart server-side, keyed by an anonymous cart cookie', 'Merge the anonymous cart into the account cart on login', 'Expire carts after 30 days of inactivity'],
        newCaps: [['shopping-cart', 'Cart contents that survive reloads, devices and login']],
        impact: ['New `carts` and `cart_items` tables', 'Cart API replaces the client-side store'],
      },
      design: {
        context: 'The current cart is a Zustand store seeded from localStorage. Prices are re-read from the catalog on every render, so a stored cart never holds stale prices.',
        goals: ['Cart survives refresh, new tab and login', 'No visible flicker on first paint'],
        nonGoals: ['Cross-device sync for anonymous visitors', 'Reserving stock while an item is in a cart'],
        decisions: [
          ['Server-side storage over localStorage', 'localStorage cannot follow a customer to a second device, and merge-on-login needs the server anyway.'],
          ['Cart cookie is httpOnly', 'The cart id is opaque and only the API reads it, which keeps it out of reach of third-party scripts.'],
        ],
        risks: ['Extra round trip on first paint; mitigated by inlining the cart summary in the layout response'],
      },
      specs: {
        'shopping-cart': {
          purpose: 'Defines how the cart is stored, merged and expired so shoppers do not lose items.',
          added: [
            [
              'Persistent cart',
              'The storefront SHALL keep cart contents across page reloads and browser restarts for 30 days.',
              [['Reload keeps items', 'a visitor with two items in the cart reloads the page', 'the cart still shows both items with current prices']],
            ],
            [
              'Cart merge on login',
              'When an anonymous visitor signs in, the system MUST merge the anonymous cart into the account cart and sum quantities of identical items.',
              [['Merge duplicates', 'the anonymous cart has 1 fern and the account cart has 2 ferns', 'after login the cart has 3 ferns']],
            ],
          ],
        },
      },
      tasks: {
        'Backend': ['Create carts and cart_items tables', 'Implement cart API (get, add, update, remove)', 'Implement merge-on-login'],
        'Frontend': ['Replace Zustand persistence with the cart API', 'Inline the cart summary in the layout response'],
      },
      done: 'all',
    },
    {
      name: 'add-guest-checkout',
      created: '2026-09-14',
      archivedOn: '2026-09-30',
      proposal: {
        why: 'Checkout requires an account. Analytics show 58% of carts are abandoned at the "Create account" step.',
        what: ['Let visitors check out with only an email address', 'Send an order confirmation email with a tracking link', 'Offer account creation after payment instead of before'],
        newCaps: [['checkout', 'Collect shipping details, pay and confirm an order']],
        impact: ['Checkout flow reduced from 4 steps to 3', '`orders.customer_id` becomes nullable; guest orders store the email'],
      },
      specs: {
        checkout: {
          purpose: 'Describes the steps and guarantees of placing an order, for guests and signed-in customers.',
          added: [
            [
              'Guest checkout',
              'The storefront SHALL allow a visitor to place an order with an email address and a shipping address, without creating an account.',
              [
                ['Guest completes order', 'a visitor without an account fills in email, address and payment', 'the order is created and a confirmation page is shown'],
                ['Invalid email', 'the visitor enters an email without an @ sign', 'the form shows an inline error and does not continue'],
              ],
            ],
            [
              'Order confirmation email',
              'The system MUST send a confirmation email within one minute of a successful payment, including the order number and a tracking link.',
              [['Email sent', 'a payment succeeds', 'an email with the order number is queued for the buyer']],
            ],
          ],
        },
      },
      tasks: {
        'Checkout flow': ['Make orders.customer_id nullable', 'Collapse account and address steps into one form', 'Add post-payment account creation prompt'],
        'Email': ['Build the confirmation email template', 'Queue the email on payment success'],
      },
      done: 'all',
    },
    {
      name: 'add-plant-care-guides',
      created: '2026-10-06',
      archivedOn: '2026-10-21',
      proposal: {
        why: 'Plant returns are our largest refund reason ("it died"), and most could be avoided with basic care guidance that today only exists in the packaging insert.',
        what: ['Show light, water and pet-safety badges on every plant product page', 'Add a collapsible care guide with watering schedule', 'Link the guide from the shipping email'],
        newCaps: [['product-catalog', 'Product attributes and detail page content']],
        impact: ['`products` gains structured care attributes', 'Content team fills in care data for ~140 plants'],
      },
      specs: {
        'product-catalog': {
          purpose: 'Defines what the catalog shows about each product on listing and detail pages.',
          added: [
            [
              'Plant care badges',
              'The product page SHALL display light needs, watering frequency and pet safety for every product in the "Plants" category.',
              [['Badges shown', 'a visitor opens a plant product page', 'three badges for light, watering and pet safety appear above the description']],
            ],
            [
              'Care guide',
              'The product page MUST include a collapsible care guide for plants, collapsed by default on mobile.',
              [['Guide collapsed on mobile', 'a visitor opens a plant page on a 390 px wide screen', 'the care guide is collapsed and expands on tap']],
            ],
          ],
        },
      },
      tasks: {
        'Data': ['Add care attributes to products', 'Import care data from the content spreadsheet'],
        'UI': ['Build care badge component', 'Build collapsible care guide', 'Add care guide link to shipping email'],
      },
      done: 'all',
    },

    // ------------------------------------------------------------------ active
    {
      name: 'add-wishlist-sharing',
      created: '2026-11-10',
      goal: 'Let shoppers share a wishlist by link so gift buyers can see what someone actually wants.',
    },
    {
      name: 'redesign-product-gallery',
      created: '2026-11-06',
      goal: 'Make product photos load faster and feel better on mobile.',
      proposal: {
        why: 'The product gallery is a 2019-era slider that downloads every image up front and cannot be swiped smoothly on phones. Photos drive purchase decisions for ceramics, and the gallery accounts for 60% of page weight on product pages.',
        what: [
          'Replace the slider with a scroll-snap carousel and a thumbnail strip',
          'Load only the first image eagerly and lazy-load the rest',
          'Add pinch-to-zoom on mobile and a lightbox on desktop',
        ],
        modCaps: [['product-catalog', 'Gallery behaviour on the product detail page']],
        impact: ['`ProductGallery` component rewritten; slider dependency removed', 'Image CDN presets for 3 widths added'],
      },
    },
    {
      name: 'speed-up-category-pages',
      created: '2026-10-30',
      touched: '2026-11-09',
      skipSpecs: true,
      goal: 'Bring category page LCP under 2.5 s on 4G without changing behaviour.',
      proposal: {
        why: 'Category pages have an LCP of 4.1 s on mid-range phones (field data, p75), the worst in the shop and the page type with the most organic traffic. Slow listings directly reduce clicks into product pages.',
        what: [
          'Server-render the first 12 products and stream the rest',
          'Serve listing thumbnails at 320 px instead of 800 px',
          'Move filter state to the URL so filtered pages can be cached at the edge',
        ],
        impact: ['No spec-level behaviour change, so this change carries no spec deltas', 'Edge cache rules added for `/c/*`'],
      },
      design: {
        context: 'Category pages are client-rendered: the shell loads, then the product grid is fetched from the API. Filter state lives in React state, so every filtered view is a cache miss.',
        goals: ['p75 LCP under 2.5 s', 'Filtered category URLs are cacheable and shareable'],
        nonGoals: ['Redesigning the product card', 'Infinite scroll'],
        decisions: [
          ['Stream the grid, do not paginate it', 'The first 12 products are in the initial HTML; the rest arrive via a suspense boundary, so the LCP element is never behind a fetch.'],
          ['Filters in the query string', 'Sorted, normalised query params give a small set of cacheable URLs; unknown params are dropped at the edge.'],
        ],
        risks: ['Stale prices for up to 60 s at the edge; acceptable because the cart re-reads prices', 'More cache keys; watch hit rate after rollout'],
      },
      tasks: {
        'Rendering': ['Convert category page to a server component', 'Stream products beyond the first 12', 'Add skeleton cards matching final dimensions'],
        'Images': ['Generate 320 px thumbnail preset', 'Switch product cards to srcset', 'Preload the first row of images'],
        'Caching': ['Normalise and sort filter query params', 'Add edge cache rule for /c/*', 'Purge category cache on product publish'],
        'Rollout': ['Compare LCP before and after in field data', 'Remove the old client-side fetch path', 'Document the performance budget in the repo'],
      },
      done: 3,
    },
    {
      name: 'add-saved-addresses',
      created: '2026-10-24',
      touched: '2026-11-10',
      goal: 'Returning customers should not retype their address at every checkout.',
      proposal: {
        why: 'Signed-in customers retype their shipping address on every order. Repeat buyers are 38% of revenue, and address entry is the slowest step of checkout.',
        what: ['Let customers save up to 5 addresses in their account', 'Preselect the default address at checkout', 'Offer to save a new address after a successful order'],
        modCaps: [['checkout', 'Guest checkout stays as is; signed-in checkout gains saved addresses']],
        impact: ['New `addresses` table', 'Account page gains an "Addresses" section', 'Checkout address step reads from saved addresses'],
      },
      design: {
        context: 'Orders copy the address into the order row, so editing a saved address never changes past orders. Address validation already exists in the checkout form and should be reused.',
        goals: ['One-tap checkout address for returning customers', 'Reuse the existing validation rules'],
        nonGoals: ['Address autocomplete from a third-party service', 'Multiple recipients per order'],
        decisions: [
          ['Snapshot addresses onto orders', 'Orders keep their own copy so deleting a saved address cannot break order history or invoices.'],
          ['Hard limit of 5 addresses', 'Keeps the picker usable without a search box; revisit if support hears otherwise.'],
        ],
        risks: ['Customers with a stale default address ship to the wrong place; the confirm step always shows the address in full'],
      },
      specs: {
        checkout: {
          added: [
            [
              'Saved address selection',
              'A signed-in customer with saved addresses SHALL see the default address preselected at checkout and MUST be able to choose another saved address or enter a new one.',
              [
                ['Default preselected', 'a signed-in customer with two saved addresses opens checkout', 'the default address is selected and the other is one tap away'],
                ['Save after order', 'a customer pays with a new address and has fewer than 5 saved', 'the confirmation page offers to save the address'],
              ],
            ],
          ],
          modified: [
            [
              'Guest checkout',
              'The storefront SHALL allow a visitor to place an order with an email address and a shipping address, without creating an account. Guests MUST NOT see saved addresses and are offered account creation only after payment.',
              [
                ['Guest completes order', 'a visitor without an account fills in email, address and payment', 'the order is created and a confirmation page is shown'],
                ['Invalid email', 'the visitor enters an email without an @ sign', 'the form shows an inline error and does not continue'],
                ['Guests see no saved addresses', 'a visitor is not signed in', 'the checkout address step shows an empty form'],
              ],
            ],
          ],
        },
      },
      tasks: {
        'Data model': ['Create addresses table with default flag', 'Enforce the 5 address limit in the API', 'Add CRUD endpoints for addresses'],
        'Account UI': ['Build the Addresses section in the account page', 'Add set-as-default action'],
        'Checkout': ['Preselect default address in checkout', 'Add address picker for signed-in customers', 'Offer to save a new address after order', 'Snapshot the chosen address onto the order'],
      },
      done: 7,
    },
  ],
  ideas: [
    { createdAt: '2026-10-28T09:14:00Z', title: 'Gift wrapping option at checkout', body: 'Offer paper wrap and a handwritten card for a flat fee. Ceramics are a popular gift and the support inbox gets "can you wrap this?" every week in November.' },
    { createdAt: '2026-11-03T15:40:00Z', title: 'Back-in-stock email alerts', body: 'Rare plants sell out within hours. A "notify me" button on out-of-stock products would turn lost visits into purchases and tell purchasing what to reorder.' },
    { createdAt: '2026-11-08T11:05:00Z', title: 'Bundle discounts for plant and pot', body: 'Show a matching pot under every plant and discount the pair by 10%. Needs a compatibility attribute (pot diameter vs plant size) in the catalog first.' },
  ],
};
