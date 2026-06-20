# Udyog Mobile App — Development Documentation

## Project Overview
React Native + Expo mobile app for Udyog GST Billing SaaS.
Android first. Same backend as web app (api.udyogbook.in).

## Tech Stack
- React Native + Expo (SDK 51+)
- Expo Router (file-based routing)
- Clerk (authentication — same as web)
- Axios (API calls to api.udyogbook.in)
- TypeScript

## Repo
github.com/rounak621/udyog-mobile

## Architecture
- Backend: Shared with web app (api.udyogbook.in) — no changes needed
- Auth: Clerk React Native SDK
- Navigation: Expo Router with tab + stack navigation
- State: React hooks + Context (no Redux)

## Infrastructure Notes
- Production database is AWS RDS PostgreSQL (`udyog-prod.c7smismgi9rk.ap-south-1.rds.amazonaws.com`, db: `udyog_prod`), connection string in `~/billmitra-backend/.env.production` on EC2 — NOT Neon. Any references to Neon as the production database elsewhere are outdated.
- Backend already runs two other APScheduler jobs in-process (rental reminders at 00:05, subscription expiry checks at 00:10) prior to the notifications scheduler (00:15) — this is an established pattern in this codebase, not a new architecture introduced solely for notifications.

## Screens
| Screen | Path | Status |
|--------|------|--------|
| Login | app/(auth)/login.tsx | ✅ Done |
| Signup | app/(auth)/signup.tsx | ✅ Done |
| Dashboard | app/(tabs)/index.tsx | ✅ Done |
| Bills List | app/(tabs)/bills.tsx | ✅ Done |
| Parties List | app/(tabs)/parties.tsx | ✅ Done |
| More | app/(tabs)/more.tsx | ✅ Done |
| Create Invoice | app/invoice/create.tsx | ✅ Done |
| Invoice Detail | app/invoice/[id].tsx | ✅ Done |
| Party Detail | app/party/[id].tsx | ✅ Done |
| Create Party | app/party/create.tsx | ✅ Done |
| Maya AI | app/(tabs)/maya.tsx | ✅ Done |
| Reports | app/reports.tsx | ✅ Done |
| Business Settings | app/settings/business.tsx | ✅ Done |
| Invoice Settings | app/settings/invoice.tsx | ✅ Done |
| Subscription | app/settings/subscription.tsx | ✅ Done |
| Tally Export | app/settings/exports.tsx | ✅ Done |
| Profile | app/profile/index.tsx | ✅ Done |
| Help & Support | app/help/index.tsx | ✅ Done |
| Notifications | app/notifications/index.tsx | ✅ Done |

> Note: Some screens above were marked Done in earlier docs but may need re-verification against current backend/web app parity — see backlog discussion in project chat history.

## Color Theme
- Primary: #F97316 (orange)
- Background: #F1F5F9
- Card: #FFFFFF
- Text: #0F172A
- Secondary Text: #64748B

## API Endpoints Used
- GET /api/v1/businesses/me — current business info
- GET /api/v1/invoices — invoice list
- POST /api/v1/invoices — create invoice
- GET /api/v1/customers — parties list
- GET /api/v1/items — inventory

## Environment Variables
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=<clerk_key>
EXPO_PUBLIC_API_URL=https://api.udyogbook.in/api/v1

## Run Locally
npm install
npx expo start
Scan QR with Expo Go app on Android

## Build for Android
npx expo build:android
OR
eas build --platform android

## Changelog
### v0.1.0 — Project initialized
- Expo project setup
- Folder structure created
- Theme constants defined
- API service configured
- Documentation initialized

### v0.2.0 — Auth + Dashboard
- Clerk auth fully integrated (login, signup, email verification)
- Root layout with AuthGuard — auto redirects based on auth state
- Tab navigation with Maya FAB button
- Dashboard screen with stat cards and recent transactions
- Pull to refresh on dashboard
- New Invoice FAB button on dashboard

### v0.3.0 — Bills + Invoice Screens
- Bills list with search and filter chips (All/Unpaid/Paid/Draft)
- Pull to refresh on bills list
- Invoice detail screen with items, GST breakdown, share button
- Mark as Paid action on invoice detail
- Create Invoice screen with party selector, line items, GST calculation
- Auto-calculates total with GST per line item

### v0.4.0 — Auth Flow Redesign
- Welcome/splash screen with feature highlights
- Login/signup redesigned with wave header, Udyog branding
- Google OAuth (Continue with Google) on both login and signup
- Onboarding screen — Business Owner vs CA selector
- CA users shown notice to use web app with redirect link
- Password show/hide toggle
- Improved error handling on all auth screens

### v0.5.0 — Parties + More Screen
- Parties list with search, filter (All/Customers/Suppliers), pull to refresh
- Party detail with contact info, outstanding amount, recent bills
- Create party screen (customer or supplier)
- More screen with profile, settings menu, logout
- Logout with confirmation alert

### v0.6.0 — All Screens Complete
- Maya AI screen with text input, example prompts, result preview
- Reports screen with summary cards and report grid
- Business settings — edit name, GSTIN, phone, address
- Invoice settings — prefix, numbering, terms & conditions
- Subscription screen — plan status, days remaining, upgrade link
- Tally export screen — one-tap XML export with share sheet
- User management — redirects to web app

### v0.7.0 — Auth UI Redesign
- Welcome screen: full orange background, Udyog logo, hero illustration, Get Started + Sign In buttons
- Login screen: compact orange header with logo, white form card, Google OAuth, email/password
- Signup screen: same design as login, email verification OTP step
- Real Udyog logo image used instead of text placeholder
- Back button on login and signup

### v0.8.0 — Mobile App Fixes
- Switched Clerk publishable key to production
- Reduced topbar paddingTop to 16 on all tab screens for status bar alignment
- Fixed filter chip text truncation on Bills screen by increasing horizontal padding to 16
- Centered empty state vertically and horizontally on Bills and Parties screens
- Fixed stats text truncation on Welcome screen using adjustsFontSizeToFit
- Shifted Dashboard New Invoice FAB position to bottom: 90 to float properly above the tab bar
- Added Clerk `needs_second_factor` OTP verification flow on Login screen to support MFA/new client challenges

### v0.9.0 — API, FAB & Layout Fixes
- Bills screen: fetch business_id from `/businesses/me` before loading invoices with `business_id` query param
- Parties screen: fetch business_id from `/businesses/me` before loading customers with `business_id` query param
- Dashboard FAB: converted to 56×56 circular icon-only button (bottom: 90, elevation: 8, shadow)
- Bills filter chips: restyled with `borderWidth: 1.5`, `fontSize: 13`, `fontWeight: '500'/'600'`, `marginRight: 8`
- Bills & Parties empty state: replaced `minHeight: 300` with `paddingVertical: 80` for proper centering

### v1.0.0 — Final UI Polish Pass
- Dashboard FAB: Restored "+ New Invoice" pill-shaped text button at bottom right
- Bills & Parties: Replaced filter chips with horizontal ScrollView and premium styled chips
- Bills & Parties: Redesigned and centered empty states using inline styling and custom icons
- All Tabs: Set header titles to a consistent `fontSize: 22`, `fontWeight: '700'`, and color `#0f172a`

### v1.0.1 — FAB & Centering Refinements
- Dashboard FAB: Updated styles exactly (`bottom: 100`, `backgroundColor: '#F97316'`, `paddingHorizontal: 20`, `paddingVertical: 14`, `gap: 8`, and `fontSize: 15`), adding Metro bundling bypass comment
- Bills & Parties: Fixed empty state vertical centering by setting `flexGrow: 1` explicitly on ScrollView `contentContainerStyle` and removing `marginTop: 80`

### v1.0.2 — Filter & FAB Polish
- Bills & Parties: Constrained horizontal ScrollView height with `maxHeight: 44`, `marginBottom: 12`, and `alignItems: 'center'` to prevent vertical stretching
- Dashboard FAB: Moved FAB lower by changing bottom offset from `100` to `80`

### v1.1.0 — Mobile App Fixes
- Bills: Swapped `party_name` with `customer_name` for types, search filtering, and card rendering to fix "Unknown Party" issue
- Invoice Detail: Enabled mapping line items from `line_items || items || []`, mapping item amounts from `line_total || amount || total`, rendering subtotal from `taxable_amount || subtotal`, and wrapped tax/total labels with `numberOfLines={1}` and appropriate widths to prevent CGST/SGST label truncation
- Party Detail: Fetched active business ID using `/businesses/me` first and appended `business_id` query parameters to GET calls, and centered the empty state components
- Filter Chips: Adjusted ScrollView constraint height from `maxHeight: 44` to `height: 48` on Bills and Parties screens to prevent truncation of chips

### v1.2.0 — Navigation, Dashboard and Invoice Detail Actions
- Navigation: Created `app/party/_layout.tsx` and `app/invoice/_layout.tsx` layout stack configurations to prevent app reloads when navigating to details
- Dashboard: Replaced `party_name` with `customer_name` on recent transactions to fix the "Unknown Party" display issue
- Invoice Detail: Added action buttons ("Share" and "Download PDF") using native Share sheet and browser Linking, styled to match the app theme

### v1.3.0 — Dashboard Redesign
- Stat Cards: Reduced padding from 14 to 10, font size from 18 to 16, and grid gap from 10 to 8 for a compact layout
- Quick Actions: Added horizontal row with "New Sale", "New Party", and "Reports" shortcuts between stats and recent transactions
- Recent Transactions: Limited API fetch from 5 to 3 invoices for a cleaner view
- FAB: Replaced pill-shaped text button with compact 56×56 circular icon-only button (`bottom: 90`, `right: 20`)
- ScrollView: Updated content `paddingBottom` to 80 to accommodate circular FAB

### v1.4.0 — Invoice Creation Fixes
- Create Invoice screen: Fetch business ID and load customer/item data in parallel
- Searchable Item Modal: Tap item name to open search modal and auto-fill price, unit, and GST details
- Save Payload standardisation: Match backend line items structure and pass `business_id` query param
- Read-only invoice number field added
- Improved GST calculations to calculate per line item subtotal, GST, and grand total

### v1.5.1 — Create Invoice Screen Refinements
- Fixed payload: Removed `business_id` from POST request body, keeping it only in the query parameters
- Fixed payload: Removed unused `unit` field from `line_items` array in payload
- Added support for warning responses: Parses warning structures (e.g. stock warnings) returned by the backend post-creation and triggers a native stock warning alert
- Service invoice enhancement: Allowed typing a custom service name via TextInput instead of forcing selection from the item list
- Non-GST compliance: Hides the GST rate input field and sets the line items' `gst_rate` to 0 automatically when Non-GST type is selected
- Invoice sequence synchronization: Restructured invoice sequence hook to reload the next invoice number preview cleanly when the invoice type changes

### v1.6.0 — Premium Create Invoice UI Redesign
- Redesigned the header with safe area insets integration, displaying auto-saved draft indicator and a borderless outline Save button
- Swapped simple tabs for an elegant, rounded tab selector displaying custom toggle styles with shadow effects
- Refactored invoice metadata section: Invoice Number and Date are now displayed side-by-side in distinct card blocks
- Replaced basic Bill To text selector with an interactive card featuring initials avatar generation (auto-computing split letters from customer names)
- Enhanced Items grid: Re-styled items container card with custom list separators, displaying full calculation sums, inline Qty/Rate input boxes, and clean trash action icons
- Updated invoice summary layout to use orange-tinted background card displaying Subtotal, CGST+SGST/IGST tax, and an extra-bold grand Total
- Converted Create Invoice button to a full-width themed button embedded directly below notes input card

### v1.6.1 — Invoice Date Picker, Custom Items & Customer Creation
- Fixed deprecated import: Replaced standard `expo-file-system` import with `expo-file-system/legacy` to resolve deprecation warnings
- Date Selector: Integrated `@react-native-community/datetimepicker` to replace manual text date entry with a native calendar modal interface
- Custom Items: Added a "Custom Item" selector trigger at the top of the Item Picker modal. Tapping it sets `isCustom: true` on the line item, enabling a text input field for manual item naming
- Custom Customer Creation: Added an "Add New Customer" shortcut at the top of the Customer Picker modal that redirects to the Create Customer screen
- Editable GST: Converted the GST badge label to an editable `TextInput` field, permitting custom tax percentage modifications per item
- UI Label truncation fix: Replaced `GST · CGST + SGST` with `GST (CGST + SGST)` to prevent clipping issues

### v1.6.2 — Keyboard & Inline Combobox Fixes
- Keyboard Dismissal Fix: Added key props to TextInputs and stabilized state callbacks using `useCallback` in `app/party/create.tsx` to prevent keyboard focus loss during typing.
- Searchable Inline Combobox: Replaced the separate Item Picker Modal in `app/invoice/create.tsx` with an inline text-searchable combobox/dropdown list for each line item, featuring auto-fill on select, support for custom typed items, and a footer link to navigate to item creation.
- GST Label Update: Shortened `GST (CGST + SGST)` label to `Tax (GST)` to prevent layout truncation.
- Qty & Rate Widths: Adjusted line item field widths so Qty is wider (to show up to 6 digits) and Rate occupies remaining space flexibly.

### v1.6.3 — GST Slabs, Item Selection UX & Inter-State Detection
- GST Rate Selector: Replaced free-form GST % text input with predefined tap-to-select pill buttons (0%, 5%, 18%, 40%) styled with orange theme matching the app brand.
- Item Selection UX: Default line item shows a "Select item..." tap button instead of a text input. Tapping opens an inline dropdown with "Custom Item" at the top, existing items in the middle, and "+ Add New Item" at the bottom. Selecting "Custom Item" switches to a text input for manual entry.
- Dynamic CGST+SGST vs IGST: Added `businessState` tracking from `/businesses/me` API response. When a customer is selected, compares business state vs customer state to determine inter-state trade. Summary card now dynamically displays "IGST" or "CGST + SGST" accordingly.

### v1.6.4 — Party Creation Alignment with Web App
- Web-aligned Form Fields: Standardized party creation fields to match the web app. Kept Name (required), Phone, Email, GSTIN (optional, max 15 characters), State (required), and Address (optional, multiline text input). Removed the redundant City and Pincode fields.
- 3-Option Party Type Selector: Added "Both" option to the Customer / Supplier toggle, allowing a party to be designated as both.
- Modal-based State Picker: Replaced free-form State text input with a searchable modal list containing all 36 Indian States and Union Territories. Enforced GST compliance check that makes state selection required.
- Refined UI Theme: Redesigned layout to utilize card components with shadows (no borders), orange primary color accentuation, and section labels styled in uppercase with letter spacing matching the Invoice creation screen styling.

### v1.6.5 — Keyboard Aware Scroll & Item Detail UX
- Keyboard Avoidance: Integrated `react-native-keyboard-aware-scroll-view` and replaced traditional `KeyboardAvoidingView` + `ScrollView` wrappers with `KeyboardAwareScrollView` in both `app/party/create.tsx` and `app/invoice/create.tsx` to prevent the software keyboard from obscuring address and other form inputs.
- Selected Item Detail & Change UX: For already selected line items in `app/invoice/create.tsx`, replaced the plain "Select item..." button with a detailed row showing the selected item's name, rate, and tax rate alongside a pencil icon and "Change" action to reopen the dropdown.
- Custom Item Revert Action: Added a clear/remove circle icon next to the custom item text input in `app/invoice/create.tsx`, permitting the user to reset a line item back to selector mode.

### v1.7.0 — Android Hardware Back Button Fix
- Fixed Android hardware back button incorrectly navigating to Home instead of previous screen from nested route groups (settings, legal)
- Root cause: root app/_layout.tsx uses <Slot /> with no shared native stack across route groups, so nested stacks had no parent to pop into on hardware back
- Fix: added BackHandler listener in app/settings/_layout.tsx and app/legal/_layout.tsx using router.replace('/(tabs)/more') instead of router.back() (no JS history existed to pop to)

### v1.8.0 — Bills & Parties Filter and Layout Fixes
- Replaced "Draft" filter with "Partial" on Bills screen; Unpaid filter now excludes partially-paid invoices
- Added combined "Outstanding" filter state (Unpaid + Partial) reachable only via Home screen's "View Outstanding" button deep link, not a visible chip
- Fixed excess empty space on Bills/Parties when filtered results are few (removed redundant flexGrow: 1 double-application)
- Fixed chip text rendering corruption caused by overly-tight chip height; restored safe padding/lineHeight values
- Locked searchBox and chips row heights to prevent visual jump/shift on render
- Restructured loading state to render header/search/chips immediately on mount instead of swapping full layouts, eliminating load-transition jump

### v1.9.0 — Party Detail Bug Fix
- Fixed Party Detail screen showing ₹0 outstanding and empty Recent Bills despite party having real invoices
- Root cause: invoice list extraction only checked invData.invoices, missed backend's actual InvoicePaginatedResponse.items key
- Fix: added items as a checked key in the extraction fallback chain

### v2.0.0 — Manage Users Removed
- Removed "Manage Users" menu item and app/settings/users.tsx entirely — app uses shared full-access accounts, no per-user role system exists

### v2.1.0 — Native Profile Screen
- Added app/profile/index.tsx using Clerk useUser() hooks: edit name, email list with primary badge, add-email OTP verification flow, password change (or "Signed in with [provider]" for SSO accounts)
- Wired Home screen avatar and More tab's edit (pencil) button to navigate to /profile

### v2.2.0 — Receivables Hero Card Graphic
- Added decorative ascending bar-chart graphic as absolutely-positioned background layer on Home screen's Receivables card, behind existing text/button content

### v2.3.0 — Help & Support Screen
- Added app/help/index.tsx: email/WhatsApp contact links, FAQ accordion, app version display, Report a Problem mailto link, link to existing Terms & Privacy screen
- Wired More tab's "Help & Support" menu item to navigate to /help

### v2.4.0 — Notifications System (Backend + Mobile)
- Backend: new `notifications` and `device_tokens` tables (migration 5849710769fb) on production RDS database
- Backend: GET /notifications, POST /notifications/{id}/mark-read, POST /device-tokens endpoints
- Backend: push delivery service via Expo Push API, with per-token error isolation
- Backend: Razorpay webhook now triggers subscription_renewed and payment_failed notifications (wrapped in try/except for webhook safety)
- Backend: daily APScheduler job (00:15) checks trial_ending, subscription_expiring, subscription_expired, inactivity_nudge with 7-day dedup per business+type
- Mobile: app/notifications/index.tsx — list, mark-read, deep-link navigation, pull-to-refresh, empty state
- Mobile: bell icon + unread badge on Home screen, refetches on focus
- Mobile: push token registration on sign-in, guarded against Expo Go (which removed remote push support in SDK 53) via dynamic import — registration only runs in real dev/production builds
- Note: actual push delivery to device is untestable until production APK build exists; in-app notification list/badge fully functional in Expo Go
