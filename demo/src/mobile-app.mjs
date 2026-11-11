// Fernhill Goods mobile app (React Native, iOS and Android). Fictional.
export default {
  context: `
Fernhill Goods mobile app for iOS and Android, built with React Native and TypeScript.
Talks to the same backend as the web storefront; payments go through payments-api.
Minimum supported: iOS 16 and Android 9. All screens must work with system font scaling at 200% and with VoiceOver / TalkBack.
Release train: one store release every two weeks, features behind remote flags until the following release.
`,
  changes: [
    // ---------------------------------------------------------------- archived
    {
      name: 'add-email-login',
      created: '2026-07-27',
      archivedOn: '2026-08-12',
      proposal: {
        why: 'The first app release shipped with guest browsing only. Customers cannot see their orders or saved items in the app, which is the most requested feature in store reviews.',
        what: ['Add email and password sign-in and sign-up screens', 'Store the session token in the platform keychain', 'Add password reset via the existing web flow'],
        newCaps: [['authentication', 'Signing in, staying signed in and signing out']],
        impact: ['New auth stack and navigation guard', 'Backend session endpoint reused from the web storefront'],
      },
      specs: {
        authentication: {
          purpose: 'Defines how customers sign in to the app and how the session is kept and ended.',
          added: [
            [
              'Email sign-in',
              'The app SHALL let a customer sign in with email and password and land on the screen they were trying to open.',
              [
                ['Valid credentials', 'a customer enters a correct email and password', 'the app stores the session and opens the originally requested screen'],
                ['Wrong password', 'a customer enters a wrong password', 'an inline error is shown and the password field is cleared'],
              ],
            ],
            [
              'Secure session storage',
              'The app MUST store the session token only in the iOS Keychain or Android Keystore-backed storage.',
              [['Token location', 'a customer signs in', 'no session token is written to AsyncStorage or application logs']],
            ],
          ],
        },
      },
      tasks: {
        'Screens': ['Sign-in screen', 'Sign-up screen', 'Password reset link'],
        'Session': ['Keychain-backed token storage', 'Navigation guard for signed-in screens', 'Sign-out clears all cached account data'],
      },
      done: 'all',
    },
    {
      name: 'add-order-tracking-screen',
      created: '2026-08-18',
      archivedOn: '2026-09-02',
      proposal: {
        why: '"Where is my order?" is our top support topic. Customers must open an email to find the tracking link, which the app could show directly.',
        what: ['Add an Orders tab listing recent orders with status', 'Add an order detail screen with a delivery timeline', 'Open the carrier tracking page from the detail screen'],
        newCaps: [['order-tracking', 'Order list, status timeline and carrier tracking']],
        impact: ['New Orders tab in the bottom navigation', 'Uses existing `/orders` and `/orders/{id}/shipments` endpoints'],
      },
      design: {
        context: 'Shipment status comes from the carrier via the fulfilment service and can lag by hours. The web storefront already normalises carrier statuses into five states.',
        goals: ['Show the same five states as the web', 'Make "delivered today" obvious at a glance'],
        nonGoals: ['Live map tracking', 'Changing the delivery address from the app'],
        decisions: [
          ['Pull on focus, no polling', 'The list refreshes when the tab gains focus or on pull-to-refresh; polling would drain battery for little gain with hourly carrier updates.'],
          ['Timeline as a vertical stepper', 'Matches the web layout and reads well with large fonts and screen readers.'],
        ],
        risks: ['Carrier delays make status look stale; the screen shows "last updated" time to set expectations'],
      },
      specs: {
        'order-tracking': {
          purpose: 'Shows signed-in customers their orders and where each shipment is.',
          added: [
            [
              'Order list',
              'The Orders tab SHALL list the customer\'s orders from the last 12 months, newest first, each with its current status.',
              [['Orders listed', 'a signed-in customer opens the Orders tab', 'orders appear newest first with status badges']],
            ],
            [
              'Delivery timeline',
              'The order detail screen MUST show the five delivery states with the current one highlighted and the time of the last update.',
              [['In transit', 'a shipment is in transit', 'the timeline highlights "In transit" and shows when it was last updated']],
            ],
          ],
        },
      },
      tasks: {
        'List': ['Orders tab and navigation entry', 'Order list with pull-to-refresh', 'Empty state for customers without orders'],
        'Detail': ['Delivery timeline component', 'Open carrier tracking page in the in-app browser'],
      },
      done: 'all',
    },
    {
      name: 'add-push-notification-opt-in',
      created: '2026-09-09',
      archivedOn: '2026-09-23',
      proposal: {
        why: 'We can only reach app users by email, and delivery updates arrive after the parcel does. Push would close that gap, but asking for permission on first launch gets about 30% acceptance.',
        what: ['Ask for push permission after the first completed order, with a short explanation', 'Register the device token with the backend', 'Send "shipped" and "delivered" notifications'],
        newCaps: [['push-notifications', 'Permission, registration and delivery of push messages']],
        impact: ['New device token endpoint', 'Notification service sends via APNs and FCM'],
      },
      specs: {
        'push-notifications': {
          purpose: 'Defines when the app asks for push permission and which notifications customers receive.',
          added: [
            [
              'Contextual permission prompt',
              'The app SHALL NOT request notification permission before the customer has completed an order, and MUST explain the benefit before showing the system dialog.',
              [['After first order', 'a customer completes their first order', 'a pre-prompt explains delivery updates before the system dialog appears']],
            ],
            [
              'Delivery notifications',
              'The system SHALL send a push notification when an order ships and when it is delivered, to every registered device of the customer who opted in.',
              [['Order shipped', 'an order moves to shipped for an opted-in customer', 'each registered device receives a "Your order is on its way" notification']],
            ],
          ],
        },
      },
      tasks: {
        'App': ['Pre-prompt screen', 'Request permission and register token', 'Deep link notification taps to the order detail'],
        'Backend': ['Device token endpoint', 'Send shipped and delivered notifications'],
      },
      done: 'all',
    },
    {
      name: 'add-dark-mode',
      created: '2026-10-08',
      archivedOn: '2026-10-20',
      proposal: {
        why: 'Android and iOS users have had system dark mode for years; the app ignores it and flashes white at night. It is the second most mentioned complaint in reviews.',
        what: ['Introduce semantic color tokens instead of hard-coded hex values', 'Follow the system appearance by default', 'Add a manual override in Settings'],
        newCaps: [['appearance', 'Light and dark themes and the user override']],
        impact: ['Every screen moves from raw colors to theme tokens', 'Product photos keep a neutral background in both themes'],
      },
      specs: {
        appearance: {
          purpose: 'Controls the app theme: follows the system by default and can be overridden by the customer.',
          added: [
            [
              'Follow system appearance',
              'By default the app SHALL use the light or dark theme that matches the device setting and switch immediately when the setting changes.',
              [['System switches to dark', 'the device switches to dark mode while the app is open', 'the app re-renders in the dark theme without a restart']],
            ],
            [
              'Manual override',
              'The Settings screen MUST offer System, Light and Dark options and the choice SHALL persist across launches.',
              [['Forced light', 'a customer selects Light on a device in dark mode', 'the app stays light after restart']],
            ],
          ],
        },
      },
      tasks: {
        'Foundation': ['Define semantic color tokens', 'ThemeProvider following system appearance'],
        'Screens': ['Migrate shared components to tokens', 'Migrate all screens', 'Settings screen option and persistence'],
      },
      done: 'all',
    },

    // ------------------------------------------------------------------ active
    {
      name: 'biometric-login',
      created: '2026-10-22',
      touched: '2026-11-10',
      goal: 'Reopen the app signed in with Face ID or fingerprint instead of typing a password.',
      proposal: {
        why: 'Customers who sign in on a phone retype a password they barely remember every time the session expires, and 22% of failed sign-ins end in a reset email. Both platforms offer biometric unlock that the app ignores.',
        what: [
          'Offer to enable Face ID, Touch ID or fingerprint after the next successful password sign-in',
          'Unlock a stored refresh token with biometrics instead of asking for the password',
          'Fall back to password after 3 failed biometric attempts or when enrollment changes',
        ],
        modCaps: [['authentication', 'Adds biometric unlock as a way to resume a session']],
        impact: ['Native module for biometric prompts on both platforms', 'Backend issues a device-bound refresh token', 'Settings gains a "Biometric unlock" toggle'],
      },
      design: {
        context: 'The session token currently lives in the keychain and expires after 30 days. When it expires the customer has to sign in with email and password.',
        goals: ['One-touch resume after the session token expires', 'No weaker than password sign-in'],
        nonGoals: ['Biometrics for payments', 'Passkeys (considered for a later change)'],
        decisions: [
          ['Biometric-protected keychain item', 'The refresh token is stored with access control that requires biometric presence, so the OS enforces the check rather than app code.'],
          ['Invalidate on enrollment change', 'If someone adds a fingerprint to the device, the stored token becomes unreadable and the customer signs in with a password again.'],
          ['Use the platform library', 'A maintained wrapper around LocalAuthentication and BiometricPrompt, instead of custom native code.'],
        ],
        risks: ['Android devices with weak biometrics; only Class 3 (strong) biometrics are accepted', 'Support load from customers locked out after a new phone; the password path always remains'],
      },
      specs: {
        authentication: {
          added: [
            [
              'Biometric unlock',
              'The app SHALL let a signed-in customer enable biometric unlock, and MUST then require a successful biometric check to resume an expired session.',
              [
                ['Offer after sign-in', 'a customer signs in with a password on a device with enrolled biometrics', 'the app offers to enable biometric unlock'],
                ['Enrollment changed', 'the customer adds a new fingerprint to the device', 'biometric unlock is disabled and the next sign-in uses the password'],
                ['Three failures', 'biometric verification fails three times', 'the app falls back to the password screen'],
              ],
            ],
          ],
        },
      },
      tasks: {
        'Backend': ['Issue device-bound refresh tokens', 'Revoke refresh token on sign-out', 'Rate limit refresh endpoint'],
        'Native': ['Integrate biometric library on iOS', 'Integrate biometric library on Android', 'Biometric-protected keychain storage'],
        'App flow': ['Opt-in prompt after password sign-in', 'Resume screen with biometric prompt', 'Fallback to password after 3 failures', 'Invalidate token on enrollment change'],
        'Settings and QA': ['Biometric unlock toggle in Settings', 'Test on 6 device models', 'Accessibility check with VoiceOver and TalkBack'],
      },
      done: 9,
    },
    {
      name: 'fix-android-deep-links',
      created: '2026-10-26',
      touched: '2026-11-06',
      goal: 'Links from emails and push notifications open the right screen on Android.',
      proposal: {
        why: 'On Android, tapping an order email or a push notification opens the app on the home screen, or the browser, instead of the order. The assetlinks file is missing the release signing key and two routes are not registered.',
        what: ['Publish a correct `assetlinks.json` including the Play App Signing key', 'Register the `/orders/{id}` and `/products/{slug}` routes for links', 'Handle links when the app is cold-started and when it is already running'],
        newCaps: [['deep-links', 'Opening app screens from web links and notifications']],
        impact: ['Android manifest intent filters', 'Well-known file on the storefront domain', 'Navigation linking config shared with iOS'],
      },
      design: {
        context: 'iOS universal links already work. On Android, App Links verification fails silently when the signing certificate in assetlinks.json does not match the installed build, and Play App Signing re-signs releases with a different key than our upload key.',
        goals: ['Verified App Links on Android 9 and newer', 'One linking config for both platforms'],
        nonGoals: ['Deferred deep links for fresh installs', 'Custom URL schemes'],
        decisions: [
          ['List both the upload key and the Play signing key', 'Debug and internal builds use the upload key, store builds use the Play key; listing both keeps testing and production working.'],
          ['Shared route table', 'Routes are declared once in the navigation linking config and used for both web links and notification payloads.'],
        ],
        risks: ['The well-known file is cached by the OS for days; verify with a fresh install after changes'],
      },
      specs: {
        'deep-links': {
          purpose: 'Specifies which web links open the app and which screen each one leads to.',
          added: [
            [
              'Order and product links',
              'The app SHALL open the order detail screen for links under /orders/{id} and the product screen for links under /products/{slug}, signing the customer in first if needed.',
              [
                ['Order link, signed in', 'a signed-in customer taps an order link in an email', 'the order detail screen opens directly'],
                ['Order link, signed out', 'a signed-out customer taps an order link', 'the sign-in screen opens and returns to the order after sign-in'],
              ],
            ],
            [
              'Cold start and warm start',
              'Links MUST work both when the app is launched by the link and when it is already running in the background.',
              [['App in background', 'the app is in the background and the customer taps a product link', 'the app comes to the foreground on that product']],
            ],
          ],
        },
      },
      tasks: {
        'Android': ['Add release signing key to assetlinks.json', 'Intent filters for /orders and /products', 'Verify links with adb on Android 9, 12 and 14'],
        'Navigation': ['Linking config for order and product routes', 'Return-to-link after sign-in', 'Warm-start handling'],
      },
      done: 'all',
    },
    {
      name: 'push-notification-preferences',
      created: '2026-10-29',
      touched: '2026-11-05',
      goal: 'Let customers choose which notifications they get instead of all or nothing.',
      proposal: {
        why: 'Push is currently on or off. Since we added back-in-stock and sale alerts to the roadmap, customers who only want delivery updates would have to turn off everything.',
        what: ['Add a Notifications screen in Settings with one switch per category', 'Categories: delivery updates, back in stock, offers', 'Store preferences per customer on the server so web emails respect them too'],
        modCaps: [['push-notifications', 'Per-category preferences, delivery updates always on by default']],
        impact: ['New `notification_preferences` endpoint', 'Notification service filters by category before sending'],
      },
      design: {
        context: 'The notification service sends to every registered device of an opted-in customer. There is no category on a message today; the "shipped" and "delivered" senders call it directly.',
        goals: ['A category on every message', 'One preference store for push and email'],
        nonGoals: ['Quiet hours', 'Per-device settings'],
        decisions: [
          ['Server-side preferences', 'Preferences live in the backend, not on the device, so reinstalling the app or switching phones keeps them.'],
          ['Transactional messages ignore marketing opt-out', 'Delivery updates are tied to an order the customer placed, so they stay on unless the customer switches that category off.'],
        ],
        risks: ['Legal review needed for the offers category copy and default state (off until opted in)'],
      },
      specs: {
        'push-notifications': {
          added: [
            [
              'Notification categories',
              'The app SHALL let a customer enable or disable delivery updates, back-in-stock alerts and offers independently, and the system MUST NOT send a push in a disabled category.',
              [
                ['Offers off by default', 'a customer opts in to push for the first time', 'delivery updates are on and offers are off'],
                ['Disabled category', 'a customer disables back-in-stock alerts and an item is restocked', 'no push is sent to that customer for the restock'],
              ],
            ],
          ],
        },
      },
      tasks: {
        'Backend': ['notification_preferences table and endpoint', 'Add a category to every outgoing message', 'Filter by preference before sending'],
        'App': ['Notifications screen in Settings', 'Sync switches with the server', 'Offline state: show last known values'],
        'QA': ['Test category matrix on iOS and Android', 'Copy review for offers category', 'Update release notes'],
      },
      done: 0,
    },
    {
      name: 'offline-order-history',
      created: '2026-11-04',
      goal: 'Customers can see their orders and tracking on a train with no signal.',
      proposal: {
        why: 'The Orders tab shows a spinner and then an error without a connection, even though the same data was on screen minutes earlier. Customers check delivery status on the move, often with poor signal, and reviews mention it.',
        what: ['Cache the last 20 orders and their shipments in local storage', 'Show cached data immediately and refresh in the background', 'Show an "Offline, last updated 14:05" banner when the refresh fails'],
        modCaps: [['order-tracking', 'Order list and detail remain usable without connectivity']],
        impact: ['Local database (SQLite) added for order data', 'Cache is cleared on sign-out', 'No change to server APIs'],
      },
      specs: {
        'order-tracking': {
          added: [
            [
              'Offline access',
              'The app SHALL display the most recently loaded orders and shipment statuses when the device has no connectivity, and MUST label them with the time they were last updated.',
              [
                ['Airplane mode', 'a customer opens the Orders tab in airplane mode after having loaded it earlier', 'the cached orders appear with an "Offline, last updated" banner'],
                ['Cache cleared on sign-out', 'a customer signs out', 'cached order data is removed from the device'],
              ],
            ],
          ],
        },
      },
    },
  ],
  ideas: [
    { createdAt: '2026-10-31T16:30:00Z', title: 'Scan a plant to find care instructions', body: 'Use the camera to identify the plant a customer already owns and open its care guide. Needs an on-device model or a recognition API; evaluate accuracy on our 140 species first.' },
    { createdAt: '2026-11-05T10:12:00Z', title: 'Home screen widget for delivery status', body: 'A small widget showing the next parcel and its ETA. iOS WidgetKit first, Android later; depends on the offline order cache.' },
    { createdAt: '2026-11-09T18:45:00Z', title: 'Apple Pay and Google Pay in the app', body: 'Wallet payments avoid typing card details on a phone. Requires payments-api to accept wallet tokens on payment intents.' },
  ],
};
