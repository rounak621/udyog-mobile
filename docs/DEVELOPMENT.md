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
