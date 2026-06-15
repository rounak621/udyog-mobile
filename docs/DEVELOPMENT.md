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
| Manage Users | app/settings/users.tsx | ✅ Done |

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





