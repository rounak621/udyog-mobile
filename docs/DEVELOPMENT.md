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
- Backend: Shared with web app (api.udyogbook.in) — single source of truth for business logic
- Auth: Clerk React Native SDK
- Navigation: Expo Router with tab + stack navigation
- State: React hooks + Context (no Redux)

### Single Source of Truth & Business Logic Isolation
* **Backend as Single Source of Truth**: The FastAPI backend (`api.udyogbook.in/api/v1`) is the single source of truth for all business logic, financial calculations (GST breakdown, tax slabs, round-off), auto-numbering sequences, inventory stock tracking, and user authorization/subscription enforcement. Both web (`app.udyogbook.in`) and mobile (`udyog-mobile`) consume identical API endpoints.
* **Platform Separation**: Mobile-specific code covers UI rendering, layout responsiveness, user interaction workflows, and native device hardware integrations (microphone, Storage Access Framework, share sheet, camera). Zero business calculation or validation rules are independently invented or duplicated on the mobile client.

### 1. Maya AI Voice & Text Assistant Architecture
* **Two-Step Architecture**: Maya utilizes a decoupled two-step processing pipeline:
  1. `/ai/transcribe`: Fast Speech-To-Text (STT) endpoint utilizing OpenAI Whisper for rapid audio-to-text conversion.
  2. `/ai/maya-chat`: Reasoning and intent-parsing endpoint utilizing Gemini LLM models. Accepts natural language text, user conversation history, and business context, returning structured JSON containing reply text, intent actions, and bill/rental drafts.
* **Session Registration Pattern**: Implemented via `MayaRecordingContext` exposing `registerSession` and `clearSession` methods. Allows cross-screen mic access and background audio processing across tab switches while managing audio recording streams cleanly without memory leaks or race conditions.
* **Tail-Buffer Delay Pattern**: Audio capture uses a mandatory tail-buffer delay (~300-500ms) before executing `safeUnloadRecording()`. This ensures trailing audio words/silence cutoffs are fully captured before the native audio encoder unloads.
* **Supported Action Types & Generated UI**:
  * `draft_invoice`: Renders an Interactive Invoice Draft Card displaying customer details, itemized breakdown, CGST/SGST/IGST breakdown, grand total, and action buttons (`Create Invoice`, `Edit`, `Cancel`).
  * `draft_rental`: Renders an Interactive Rental Draft Card displaying rental products, duration/dates, customer details, and actions (`Create Rental`, `Edit`, `Cancel`).
  * `edit_draft`: Dynamically updates active draft state and re-renders draft cards with updated quantities, rates, or items.
  * `create_customer`: Renders a Customer Creation Confirmation Card pre-filling customer name, phone, GSTIN, and state with a single-tap save button.
  * `create_item`: Renders an Item Creation Confirmation Card pre-filling item name, sale price, and GST slab with a single-tap save button.
  * `check_balance`: Renders a Financial Balance Summary Card highlighting cash-in-hand, bank balances, and pending receivables.
  * `show_bills_summary`: Renders a Bills Summary Card with sales totals, paid/unpaid counts, and overdue figures.
  * `show_purchase_summary`: Renders a Purchase Summary Card with total vendor purchases, payables, and recent purchase bills.
  * `navigate`: Triggers programmatic Expo Router navigation (e.g., `router.push('/invoices')`, `/reports`, `/party/create`).
  * `ask_question`: Renders a conversational assistant text response card without any invoice draft UI.
* **TTS Removal Decision**: Text-To-Speech (TTS) audio playback was explicitly removed for v1. Maya v1 operates strictly with text and visual UI cards. TTS playback was deferred to v2 to eliminate audio playback latency (~2-4 seconds), eliminate `expo-av` sound player locking issues, and reduce bandwidth/memory overhead on low-end Android devices.

### 2. Payment System Architecture
* **Sales Invoices & Purchase Bills Parity**: Both Sales Invoices and Purchase Bills share identical payment capability:
  * **Partial Payments**: Record multiple partial payments against an unpaid or partially paid document until fully settled.
  * **Payment Timeline**: Detailed chronological payment timeline modal rendering transaction date, payment mode (Cash, UPI, Net Banking, Cheque), reference number, and amount.
  * **Payment Revert**: Supports reversing/deleting any individual payment entry. Automatically recalculates document status back to `PARTIAL` or `UNPAID` and updates outstanding balance ledger totals on the backend.
* **Safe Audio Unload Pattern (`safeUnloadRecording`)**: Reusable pattern applied during audio capture to prevent native thread crashes or lockups during rapid microphone toggle interactions.

### 3. Report Exports & Storage Access Framework (SAF)
* **CSV Export**: Client-side string generation building standard RFC 4180 CSV streams for Sales Registers, Purchase Registers, Day Book, and Party Ledgers.
* **PDF Export**: Uses `expo-print` to compile dynamic HTML templates into vector PDF files locally on the device.
* **Shared Storage Helper (`safHelper.ts`)**:
  * **Android SAF Integration**: Uses Android's Storage Access Framework (SAF) to save exported files directly into user-designated local storage folders (e.g., `Documents/Udyog`).
  * **Persistent Directory Permission**: Folder permissions granted by the user are stored securely using `expo-secure-store`. Subsequent exports re-use this saved permission uri without prompting the user repeatedly.
  * **Filename De-duplication**: Automatically checks target directory contents and appends sequence tags (`(1)`, `(2)`) or timestamps if a file with the same name already exists.
  * **Selective Permission-Error Handling**: Gracefully traps SAF permission revocations or user-cancellation exceptions (`E_USER_CANCELLED`), falling back to Expo's native share sheet (`expo-sharing`) so export never fails silently.

### 4. Subscription System Architecture
* **Dual Database Sync (`businesses` + `users` tables)**:
  * Subscription columns (`subscription_plan`, `subscription_expires_at`, `plan_status`, `is_trial`) exist on BOTH the `businesses` table and the `users` table in PostgreSQL.
  * **CRITICAL INVARIANT**: Any subscription update, renewal, or manual restore MUST update both `businesses` and `users` tables simultaneously. (Confirmed production bug: restoring subscription on `businesses` while leaving `users` out of sync caused access-gating inconsistencies).
* **Handover-Token Web-Checkout Pattern**:
  * Mobile application initiates plan upgrades by fetching a short-lived auth handover token from `/auth/handover-token`.
  * The mobile app opens web checkout (`https://app.udyogbook.in/checkout?token=...`) in browser/WebBrowser.
  * Payment is completed securely via Razorpay on web, after which subscription state syncs across both tables and reflects in mobile upon refocusing the app.
* **Platform-Restricted Plans & Interface Filtering (Option C)**:
  * Plan Tiers:
    * `Saral` & `Vistaar`: Mobile-only plans.
    * `Basic` & `Pro`: Web-only plans.
    * `Premium` & `Enterprise`: Dual-platform plans (Web + Mobile access).
  * **Interface-Level Enforcement (Option C)**: Because mobile checkout redirects users to a web-based payment flow where HTTP requests become indistinguishable from standard web traffic, plan restriction is enforced purely via UI/interface-level filtering (hiding web-only plans on mobile and mobile-only plans on web) rather than rigid backend blocking.

### 5. PDF Preview Architecture
* **PDF.js WebView Renderer**: Standardized on a custom PDF.js HTML renderer embedded inside `<WebView>`, replacing the previous Google Docs Viewer (`https://docs.google.com/gview?embedded=true&url=...`). Google Docs Viewer was removed due to severe fixed-scale zoom bugging, text letterboxing, and intermittent HTTP 204 loading failures on mobile screens.
* **Backend Inlining Requirement**: Requires backend endpoints to accept the `?mode=inline` query parameter, instructing the server to return PDF binaries with `Content-Disposition: inline` instead of `Content-Disposition: attachment`.
* **CORS Origin Allowance**: Backend CORS policy explicitly allows `"null"` origins to permit local WebView fetch operations (`file://` or `about:blank` origins) to retrieve PDF binary streams cleanly.

### 6. Native Rebuild Requirements vs. JS Reload
* **EAS Native Build (`eas build`) vs. Dev Client Reload (`expo start --dev-client`)**:
  * **JS Reload Sufficient**: Modifying React Native components, styling, hooks, state management, screen navigation, or pure JS utility functions.
  * **Fresh Native Build Required**: Any modification to `app.json` (Android permissions, scheme, plugins, deep links, `google-services.json`), OR installing/updating any native module dependency containing C++/Java/Kotlin native code (e.g. `expo-print`, `expo-av`, `expo-secure-store`, `@react-native-firebase/app`).
* **Real Production Incident Lessons**:
  1. *Firebase Push Notifications*: Adding `google-services.json` and `@react-native-firebase/app` to JS code failed silently until a fresh EAS build produced a native APK containing the Firebase Android SDK initialization hooks.
  2. *Maya Microphone Permissions*: Updating `app.json` to request `RECORD_AUDIO` permission had no effect under JS reload until a new native binary compiled the permission string into `AndroidManifest.xml`.
  3. *PDF Printing (`expo-print`)*: Installing `expo-print` crashed the JS bundle on reload because the native Java print service bridge was missing from the running dev client binary.

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

## API Endpoints — Full Reference
All mobile API interactions are routed through the shared Axios client instance exported from [services/api.ts](file:///Users/rounak/Projects/BillMitra/udyog-mobile/services/api.ts). The following is the comprehensive reference of endpoints consumed by the mobile application:

### Auth & User Onboarding
*   **`PUT /users/me/role`**
    *   **HTTP Method:** PUT
    *   **Calling File:** [app/onboarding.tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/onboarding.tsx)
    *   **Description:** Updates the onboarding role status of the user on the server (e.g., setting role to `USER` upon completing onboarding).

### Business Settings
*   **`GET /businesses/me`**
    *   **HTTP Method:** GET
    *   **Calling Files:**
        *   [app/_layout.tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/_layout.tsx)
        *   [app/(tabs)/index.tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/(tabs)/index.tsx)
        *   [app/(tabs)/bills.tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/(tabs)/bills.tsx)
        *   [app/(tabs)/parties.tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/(tabs)/parties.tsx)
        *   [app/party/create.tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/party/create.tsx)
        *   [app/party/[id].tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/party/[id].tsx)
        *   [app/invoice/create.tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/invoice/create.tsx)
        *   [app/settings/business.tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/settings/business.tsx)
        *   [app/settings/invoice.tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/settings/invoice.tsx)
        *   [app/settings/subscription.tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/settings/subscription.tsx)
        *   [app/notifications/index.tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/notifications/index.tsx)
    *   **Description:** Fetches details of the currently active business profile, configuration, and subscription status.
*   **`PUT /businesses/settings`**
    *   **HTTP Method:** PUT
    *   **Calling Files:**
        *   [app/settings/business.tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/settings/business.tsx)
        *   [app/settings/invoice.tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/settings/invoice.tsx)
    *   **Description:** Updates core business settings (name, address, GSTIN, phone) and invoice preferences (theme, declaration, terms & conditions).

### Invoices
*   **`GET /invoices/`**
    *   **HTTP Method:** GET
    *   **Calling Files:**
        *   [app/(tabs)/bills.tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/(tabs)/bills.tsx)
        *   [app/(tabs)/index.tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/(tabs)/index.tsx)
        *   [app/party/[id].tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/party/[id].tsx)
    *   **Description:** Retrieves a list of invoices filtered by `business_id` with support for pagination (`limit`, `offset`), sorting, and optional filtering by customer/party.
*   **`GET /invoices/{id}`**
    *   **HTTP Method:** GET
    *   **Calling File:** [app/invoice/[id].tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/invoice/[id].tsx)
    *   **Description:** Fetches detailed info for a specific invoice by its database ID.
*   **`POST /invoices/?business_id={businessId}`**
    *   **HTTP Method:** POST
    *   **Calling File:** [app/invoice/create.tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/invoice/create.tsx)
    *   **Description:** Creates a new invoice (GST, Service, or Non-GST) under the specified business.
*   **`DELETE /invoices/{id}?business_id={businessId}`**
    *   **HTTP Method:** DELETE
    *   **Calling File:** [app/invoice/[id].tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/invoice/[id].tsx)
    *   **Description:** Deletes a specific invoice record.
*   **`POST /invoices/{id}/mark-paid`**
    *   **HTTP Method:** POST
    *   **Calling File:** [app/invoice/[id].tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/invoice/[id].tsx)
    *   **Description:** Records a payment for an invoice and updates its status to Paid.
*   **`GET /invoices/numbering-config?business_id={businessId}`**
    *   **HTTP Method:** GET
    *   **Calling File:** [app/settings/invoice.tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/settings/invoice.tsx)
    *   **Description:** Retrieves the invoice numbering configuration (prefix, suffix, padding, next number) for the business.
*   **`POST /invoices/configure-numbering?business_id={businessId}`**
    *   **HTTP Method:** POST
    *   **Calling File:** [app/settings/invoice.tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/settings/invoice.tsx)
    *   **Description:** Saves numbering configuration changes (prefix, suffix, padding, next number) for the business.
*   **`GET /invoices/next-number?business_id={businessId}&invoice_type={invoiceType}`**
    *   **HTTP Method:** GET
    *   **Calling File:** [app/invoice/create.tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/invoice/create.tsx)
    *   **Description:** Previews the next sequence invoice number for the selected invoice type.

### Parties (Customers & Suppliers)
*   **`GET /customers/?business_id={businessId}`**
    *   **HTTP Method:** GET
    *   **Calling Files:**
        *   [app/(tabs)/parties.tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/(tabs)/parties.tsx)
        *   [app/invoice/create.tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/invoice/create.tsx)
    *   **Description:** Fetches a list of customers and suppliers associated with the active business.
*   **`GET /customers/{id}?business_id={businessId}`**
    *   **HTTP Method:** GET
    *   **Calling File:** [app/party/[id].tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/party/[id].tsx)
    *   **Description:** Fetches profile details, GSTIN, state, and ledger balances for a specific customer or supplier.
*   **`POST /customers/?business_id={businessId}`**
    *   **HTTP Method:** POST
    *   **Calling File:** [app/party/create.tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/party/create.tsx)
    *   **Description:** Creates a new customer/supplier profile under the active business.

### Items & Inventory
*   **`GET /items/?business_id={businessId}&limit=100`**
    *   **HTTP Method:** GET
    *   **Calling File:** [app/invoice/create.tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/invoice/create.tsx)
    *   **Description:** Retrieves inventory items (products/services) for selection during invoice creation.

### Reports & Exports
*   **`GET /reports/dashboard-stats?business_id={businessId}`**
    *   **HTTP Method:** GET
    *   **Calling File:** [app/(tabs)/index.tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/(tabs)/index.tsx)
    *   **Description:** Fetches dashboard statistics (sales totals, unpaid count, receivables, payables) for the active business.
*   **`GET /reports/summary`**
    *   **HTTP Method:** GET
    *   **Calling File:** [app/reports.tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/reports.tsx)
    *   **Description:** Fetches summarized metrics and report categories.
*   **`GET /data-integration/tally/{type}`**
    *   **HTTP Method:** GET
    *   **Calling File:** [app/settings/exports.tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/settings/exports.tsx)
    *   **Description:** Downloads Tally-compatible XML data formats (sales, receipts, vouchers).

### Notifications & Device Tokens
*   **`GET /notifications?business_id={businessId}&limit=50`**
    *   **HTTP Method:** GET
    *   **Calling Files:**
        *   [app/(tabs)/index.tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/(tabs)/index.tsx)
        *   [app/notifications/index.tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/notifications/index.tsx)
    *   **Description:** Retrieves recent push/in-app notifications for the active business.
*   **`POST /notifications/{id}/mark-read`**
    *   **HTTP Method:** POST
    *   **Calling File:** [app/notifications/index.tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/notifications/index.tsx)
    *   **Description:** Marks a specific notification record as read.
*   **`POST /device-tokens`**
    *   **HTTP Method:** POST
    *   **Calling File:** [services/notifications.ts](file:///Users/rounak/Projects/BillMitra/udyog-mobile/services/notifications.ts)
    *   **Description:** Registers a physical device's Expo Push Token with the backend for sending push notifications.

### Maya AI Assistant
*   **`POST /ai/maya-chat`**
    *   **HTTP Method:** POST (multipart/form-data)
    *   **Calling File:** [app/(tabs)/maya.tsx](file:///Users/rounak/Projects/BillMitra/udyog-mobile/app/(tabs)/maya.tsx)
    *   **Description:** Submits natural language text prompts to Maya AI for text-based billing commands. Requires `business_id` (Form), `conversation_history` (Form, JSON string), and `text` (Form). Returns `current_draft` (invoice draft object), `action_type`, `reply_text`, `user_transcript`, and `audio_b64` (TTS reply audio). Response follows the `MayaChatResponse` schema — draft data arrives in `current_draft`, not `extracted_data` (that field belongs to the separate voice-only `/ai/maya-command` endpoint, which requires an audio file and is not usable in Expo Go).
    *   **Timeout:** 60000ms (Gemini response latency ~30s+).

## Known Backend Quirks
Mobile developers interacting with the Udyog API should keep the following backend behaviors in mind:

*   **Business Settings Resolution:** The `PUT /businesses/settings` endpoint resolves the business target using the user's `active_business_id` (routed through the shared `resolve_current_business()` helper as of backend commit [7021f11](file:///Users/rounak/Projects/BillMitra/billmitra-backend/app/api/businesses.py#L7)). Previously, settings updates target resolved the "first" business query return, causing inconsistent data saves on multi-business accounts compared to the `GET /businesses/me` resolution path.
*   **GSTIN Snapshotting on Invoices:** The `customer_gstin` field stored on invoices is a hard snapshot copied from the party record at the exact moment of invoice creation. If a customer's GSTIN is corrected or updated on their party record later, this change **does not** retroactively update the `customer_gstin` on past invoices. Retroactive corrections require running target data-fix scripts directly on the production database.
*   **Optional Fields and `exclude_unset=True`:** The customer edit endpoint (`PUT /customers/{id}`) processes request data using Pydantic's `.model_dump(exclude_unset=True)`. This means fields omitted from the PUT request payload are left unchanged. To explicitly clear/nullify an optional field (e.g., Phone, Email, GSTIN, Address), it **must** be sent in the payload with a value of `null` or an empty string, rather than being excluded from the payload altogether.
*   **Non-GST Auto-Numbering Sequence:** Non-GST invoices automatically use a distinct hardcoded prefix/sequence (`NONGST-XXX`) that is managed independently by the server. This numbering sequence is **not** configurable via the invoice numbering settings page (which only manages prefixes and next numbers for GST sales and Service invoice types).


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
- Mobile: Implemented unread notifications count query parallelized alongside dashboard stats/invoices, using `useFocusEffect` to ensure the badge updates in real time whenever the user returns to the Home/Dashboard tab.
- Note: actual push delivery to device is untestable until production APK build exists; in-app notification list/badge fully functional in Expo Go

### v2.5.0 — Invoice Settings Rebuild & Multi-Business Fix
- **Invoice Settings Full Rebuild**: Overhauled the invoice settings screen (`app/settings/invoice.tsx`) to manage the complete invoice numbering configuration (prefix, suffix, next number, padding) calling the new `/invoices/numbering-config` (GET) and `/invoices/configure-numbering` (POST) endpoints, as well as general preferences (invoice theme, declaration toggle, and terms & conditions).
- **Settings Endpoint Corrections**: Fixed a bug where both `app/settings/business.tsx` and `app/settings/invoice.tsx` attempted to save configurations using a non-existent `PUT /businesses/me` endpoint. Corrected both to target the `PUT /businesses/settings` endpoint.
- **Backend Multi-Business Resolution Fix**: Resolved a critical backend bug where settings updates via `PUT /businesses/settings` resolved the target business using the first business query result in multi-business accounts. Standardized the backend to use the unified `resolve_current_business()` helper (referencing the active user's `active_business_id`) to match the `GET /businesses/me` resolution.

### v2.6.0 — Keyboard Avoidance, Template Repair & Customer Edit Patches
- **Android Keyboard Avoidance**: Replaced the traditional `KeyboardAvoidingView` + `ScrollView` layout wrapper in `app/settings/invoice.tsx` with `KeyboardAwareScrollView` from `react-native-keyboard-aware-scroll-view` to prevent the software keyboard on Android from covering the lower Terms & Conditions and Declaration inputs. Set `extraScrollHeight={180}` and `enableAutomaticScroll={true}` to ensure the focused input scrolls into view.
- **Rental Invoice Template Fix**: Restored production availability of rental order previews and PDF downloads by resolving a `TemplateSyntaxError` at line 611 in `app/templates/invoices/rental_invoice.html`. Removed a corrupted duplicate block containing a mangled `</tr>ass="tax-row">` fragment and orphan `{% endif %}` tags, and restored the unclosed `{% endif %}` on the ghost-row condition block.
- **Customer Form Field Clear Fix**: Updated `CustomerForm.tsx` (web, but relevant to shared endpoints) to explicitly include empty optional fields (phone, email, gstin, address) as `null` in the PUT payload. Previously, the backend's `exclude_unset=True` logic left empty fields untouched, preventing users from clearing previously set values.
- **Production CI/CD Fix**: Configured the deployment workflow in `.github/workflows/deploy.yml` to run `docker-compose down --remove-orphans` and `docker system prune -f || true` before rebuilding to prevent deployment failures caused by stale container orphans or running out of disk space on the EC2 host.
- **Database GSTIN Snap Correction**: Conducted a database data-correction script (`scratch/fix_gstin.py`) to update the snapshot `customer_gstin` field from the invalid value `27AAFP57531R1ZV` to `27AAFPS7531R1ZV` on historical invoices #19 and #32 for customer "Sweet Lady".

### v2.7.0 — Maya Text Chat Fix (Web Parity)
- Fixed Maya screen calling nonexistent `/maya/parse` endpoint (404); switched to the correct working endpoint `/ai/maya-chat` with proper multipart/form-data request (business_id, conversation_history, text)
- Rebuilt response parsing to match real backend schema: reads draft from `current_draft` (customer_name, items[], total_amount) instead of the old incorrect flat shape
- Added TTS playback via `expo-av`: decodes and plays `audio_b64` from Maya's response
- Fixed `app/invoice/create.tsx` silently discarding the `maya_data` route param — draft was previously lost entirely on "Create Invoice →" tap; now parses and pre-fills customer (name match against parties) and line items (catalog match, falls back to custom item with Maya-provided rate/qty/unit/GST)
- Backend fix required and shipped separately (`billmitra-backend`, `ai_billing.py`): `current_draft` was being silently dropped by `MayaChatResponse` serialization — the raw dict's `extracted_data` was never mapped to the `current_draft` field. One-line fix added to remap before response construction.
- Known limitation: voice input still blocked in Expo Go (unchanged, requires production APK) — this fix covers text-input Maya only
- Status: mobile-side code complete and reviewed via diff; backend fix verified live on production via direct API test; mobile branch (`fix/maya-text-endpoint`) not yet tested on-device or merged to `dev`

### v2.8.0 — Maya Screen Redesign & Layout Fixes
- Removed duplicate top mic button; press-and-hold recording now lives on the tab bar Maya icon and a bottom composer mic button (both call the same `MayaRecordingContext`)
- Fixed dead empty space appearing below chat messages — was caused by a status area unconditionally rendering even during active conversations
- Added aesthetic empty-state illustration (orange icon circle + "Bolo aur Bill Banao!" heading) replacing the removed mic block
- Added close (X) button in header, navigates to Home tab
- Fixed Android 3-button navigation bar overlapping the custom tab bar on some devices — added dynamic `useSafeAreaInsets()` bottom padding to `app/(tabs)/_layout.tsx`, matching the pattern already used in other screens
- Redesigned bill draft card to match Claude Design mockup: avatar initials, DRAFT badge, itemized rows, Cancel/Edit/Create Bill button row (Cancel clears the draft from that message; Edit is a placeholder, not yet wired)
- Fixed text truncation and message bubble wrapping (`flexShrink: 1` on `msgBubble`)
- Suggestion chips moved from a separate "Try saying" card to a horizontal scroll row directly above the composer
- Status: implemented on branch `fix/maya-text-endpoint`, most changes visually confirmed on-device; close button and nav-bar-overlap fix pending final on-device confirmation

### v2.9.0 — Purchase Bills Edit/Delete + UX Fixes
- Added native edit mode to `app/purchase-bills/create.tsx` via `?id=` param (unlike invoices, which still deep-link to web for editing) — pre-fills supplier, line items, round-off from `GET /purchase-bills/{id}`
- Edit/delete restricted to UNPAID bills only, matching backend enforcement; clear warning shown for paid bills
- Added Edit/Delete actions to `app/purchase-bills/[id].tsx` detail header
- Fixed GST rate chip not highlighting on edit load — root cause was string/number mismatch (`"18.00" !== "18"`); normalized via `String(Math.round(Number(item.gst_percent || 0)))`
- Fixed summary card order: Subtotal → Tax → Round Off (input) → Total Amount, with increased `KeyboardAwareScrollView` padding/scroll height so both Round Off and Total stay visible above the keyboard
- Status: all changes committed (`5b7d225`, `5ff186e`, `e6ace08`) and confirmed working on-device

### v3.0.0 — Inventory, Reports, CA Management, Full Rental Management, Navigation Fix
- **Inventory**: Item Master CRUD + stock view with manual +/- adjustments (`app/items/`, `app/inventory/`), stat strip/filter pills/status badges, missing back button fixed, Android modal bottom-gap fixed (`statusBarTranslucent`)
- **Reports**: Sales Register, Purchase Register, P&L, Day Book, Party Ledger (list+detail with tap-through to source invoice/bill), GSTR-1 w/ JSON export via `expo-sharing`; GSTR-3B removed; sub-tab nav with dedicated back-to-More handling on both header and hardware back
- **CA Management**: add/list/remove CA (`app/settings/ca-management.tsx`), plan-based limits enforced both frontend and backend (Saral: 0, Vistaar: 2) — backend `PLAN_CA_LIMITS` added to `assign-ca` endpoint, previously unenforced
- **Backend fix**: removed dead `business.mode` ('simple'/'pro') gating on inventory tracking, stock locking, COGS, and MAC cost calculation — this legacy field was blocking stock tracking for all 40 production businesses; deployed to production
- **Rental Management** (full 6-phase system, branch `fix/maya-text-endpoint`):
  - Phase 1: Sales/Rental mode toggle via `expo-secure-store`, persists across restarts, swaps entire tab bar
  - Phase 2: Overview (financial/operational stat strips, top active orders) + Active Orders list
  - Phase 3: Overdue + History (with Mark Paid quick action)
  - Phase 4: Products (CRUD + bulk-add grid with paste-list/auto-generate modes)
  - Phase 5: Assets (grid view w/ utilization %, per-asset status transitions, bulk-add)
  - Phase 6: Order creation (customer/product/asset picker, live availability check, invoice date, success modal with native animated checkmark + Share WhatsApp/Download PDF/View Order) + Order Detail (return/cancel/mark-paid w/ partial payment/waive-fee/PDF download+inline preview via WebView/Payment Timeline/Download Statement)
  - Order/Product/Asset detail screens relocated from `app/(rental)/` to top-level `app/rental-order/`, `app/rental-product/`, `app/rental-asset/` folders with their own `<Stack>` — required to fix back-navigation (see below)
- **App-wide back navigation fix**: root `app/_layout.tsx` now renders `<Stack screenOptions={{ headerShown: false }}>` instead of a bare `<Slot />` — previously hardware/header back always returned to dashboard regardless of navigation depth, across every screen in the app. Added missing `_layout.tsx` (`<Stack>`) to `app/items/` and `app/purchase-bills/`, which previously had zero stack management.
- **Invoice creation**: added round-off calculation (subtotal/CGST/SGST/IGST/round-off) to the live preview, matching web's exact rounding logic — backend was already correct, this was a preview-accuracy-only fix
- **UI consistency**: Home screen FAB relabeled "+ New Invoice", third quick-action changed "Rental" → "Inventory"; Recent Activity, Bills list, and Top Customers now use identical light-peach/orange-initials avatar styling; Add Item button on invoice/rental-order creation moved below the item list with auto-scroll-to-new-item (via `onLayout` position tracking, not `measureLayout`, which crashed)
- **Known limitation**: testing is happening in Expo Go, so file downloads (Udyog folder) are invisible in the OS Files app, and PDF preview via Google-Docs-viewer-in-WebView shows letterboxing — both are Expo-Go-only limitations expected to resolve once a production APK/build exists
- Status: all changes committed on `fix/maya-text-endpoint`, none deployed to `dev`/`main`/production yet (except the backend `business.mode` fix, which is live)

### v3.1.0 — Nav Bar & Keyboard Standardization, IDOR Security Fix, Search/Pagination, Referral Tracking
- **App-wide edge-to-edge nav bar fix**: root cause was a missing `SafeAreaProvider` at the app root, combined with Android's `enforceNavigationBarContrast` forcing the OS to draw a contrast scrim over content near the nav bar even with correct padding. Fixed by adding `SafeAreaProvider` in `app/_layout.tsx`, removing `enforceNavigationBarContrast` from `android/app/src/main/res/values/styles.xml`, and adding `react-native-edge-to-edge`'s `SystemBars` component. Applied across ~52 screens using the existing `SafeScrollView`/`FixedBottomBar` pattern from `components/ui/SafeLayout.tsx`.
- **Established keyboard-handling standard for the whole app**: any screen or modal with a scrollable form and a bottom action button must use `KeyboardAwareScrollView` (from `react-native-keyboard-aware-scroll-view`) as the scroll container, with the action button/footer as a plain `View` sibling OUTSIDE the scroll view — never wrapped in `KeyboardAvoidingView`. `KeyboardAvoidingView`'s `behavior="height"` conflicts with `app.json`'s `softwareKeyboardLayoutMode: "resize"` (both try to resize the layout on keyboard open, causing double-shift bugs and stale gaps after the keyboard closes). This pattern was retrofitted across `business-setup.tsx`, `party/create.tsx`, `items/create.tsx`, `items/index.tsx` (Bulk Add modal), `inventory/index.tsx` (Adjust Stock modal), `rental-order/[id]/index.tsx` (Record Return modal), and the 3 record-payment screens (invoice/purchase-bill/rental-order).
- **Modal `flex: 1` gotcha discovered**: a `Modal`'s content container using `maxHeight: 'X%'` (not `height`) WITHOUT `flex: 1` or `flexShrink: 1` causes a child element styled `flex: 1` (e.g. `KeyboardAwareScrollView`, `FlatList`) to collapse to 0 height and render nothing — hit and fixed in `items/index.tsx`, `inventory/index.tsx`, and `rental-order/[id]/index.tsx`. `height: 'X%'` (a definite size) does not have this problem; only `maxHeight` does.
- **Critical security fix — IDOR on invoice endpoints**: 5 endpoints (`GET /invoices/{id}`, `GET /invoices/{id}/pdf`, `POST /invoices/{id}/mark-paid`, `PUT /invoices/{id}`, `GET /invoices/{id}/payment-statement-pdf`) previously allowed any authenticated user to view/edit/download/mark-paid ANY business's invoices by guessing the ID. Fixed via `deps.validate_business_access()` on all 5, with `GET /invoices/{id}` specifically redesigned to look up the invoice's actual `business_id` first (rather than requiring the caller to supply it) to avoid a breaking API change for 4 existing callers that didn't send `business_id`. Deployed to production same-day given severity.
- **Critical backend bug found and fixed alongside the security fix**: `app/main.py`'s `validation_exception_handler` crashed with a 500 (instead of returning a clean 422) whenever ANY Pydantic `@field_validator` raised `ValueError` — this was a PRE-EXISTING bug (not introduced this session), confirmed also affecting the business GST number validator, meaning invalid GST number entry during business signup/edit was silently 500ing on production before this fix. Root cause: `exc.errors()` contains a raw Python `ValueError` object inside `ctx["error"]` which `JSONResponse`'s plain `json.dumps()` can't serialize. Fixed with `jsonable_encoder(exc.errors())`.
- **Pagination + server-side search**: Parties and Products list pages moved from loading up to 1000 records at once to real page-by-page pagination (20/page), with new server-side `search` query param added to `GET /customers/` (name, phone, AND gstin) matching the pattern already on `GET /items/` (name, hsn_code). Fixes both a real performance problem and a bug where any business with >20 customers only saw the first 20 on the Parties page (backend defaulted to `limit=20` when omitted).
- **GSTIN format validation**: added real regex validation (`^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`) to `CustomerCreate`/`CustomerUpdate` schemas (previously only length-checked, allowing malformed GSTINs that failed real-world GST portal uploads). GSTR-1 export endpoint now returns structured `invalid_gstin_parties` (party name/id/gstin/invoice numbers) instead of plain warning strings; both mobile (`app/reports/gstr1.tsx`) and web now show a full-screen "Action Required" blocking state listing each invalid party with inline edit, instead of a dismissible toast — with a "Download anyway" bypass link for edge cases.
- **Referral source tracking**: new `referral_source` field on `Business` model (nullable, migration `a533f0e20a8c`), captured via a new chip-select question ("How did you hear about Udyog?") added to the same onboarding step as role selection, displayed in `udyog-admin`'s business detail view and Excel export.
- **New Razorpay account**: `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`/`RAZORPAY_WEBHOOK_SECRET` rotated to a new Razorpay account on production; webhook re-registered at `https://api.udyogbook.in/api/v1/subscriptions/webhook`.
- Status: all fixes deployed to production and verified working.

### v3.2.0 — Redesigned Party/Item Forms, Custom Image Crop Tool, App Icon Overhaul
- **Party & Item creation screens fully redesigned**: fields grouped into icon-labeled cards (matching the pattern established for Business Setup), added a secondary Save button in the top-right header (in addition to the existing bottom `FixedBottomBar` save) so users aren't forced to scroll or fight the keyboard to save.
- **State/Unit picker modals**: fixed height (not percentage-derived) with `flex: 1` on the `FlatList` and proper `insets.bottom` padding, so a single filtered search result (e.g. typing "Maharashtra") stays visibly positioned above the keyboard instead of the modal collapsing around it.
- **Party type filter bug fixed**: parties saved with `party_type: 'both'` were only showing under "All," not under "Customers" or "Suppliers" tabs — backend query was already correct, bug was purely in mobile's client-side filter (`app/(tabs)/parties.tsx`) doing a strict equality check instead of also matching `'both'`.
- **Custom image crop tool built from scratch** (`components/ImageCropModal.tsx`) to replace the native OS cropper for business logo/signature upload — freeform drag-resize crop box (no locked aspect ratio, per explicit product decision) built with `react-native-gesture-handler` + `react-native-reanimated`, using `expo-image-manipulator` for the actual crop/output. Required a full `expo prebuild --clean` cycle since native mipmap resources needed regenerating — this WIPES `android/gradle.properties`' release signing config and resets `versionCode` to 1; both must be manually restored from backup immediately after (see release-signing block already documented in `android/app/build.gradle`).
- **Two real bugs found and fixed in the crop tool during testing**: (1) cropped output was solid black for any image with transparency — `manipulateAsync` was hardcoded to `SaveFormat.JPEG`, which has no alpha channel; fixed by switching to `SaveFormat.PNG`. (2) cropped region didn't match the user's on-screen selection for camera-taken photos — root cause was `Image.getSize()` returning dimensions that didn't match the actual EXIF-rotated image in ~50% of cases (confirmed via device logs, not assumption); fixed by bypassing `Image.getSize()` entirely and passing known-correct dimensions from the upstream `expo-image-manipulator` normalization step instead.
- **App icon/splash logo replaced**: old logo asset had a soft white halo/anti-aliasing artifact baked in and rendered as an incomplete/broken shape at small launcher sizes; replaced with a clean, properly safe-zone-padded version across `assets/icon.png`, `assets/icon-flat.png` (the actual file `app.json`'s `icon` field references — was missed in an earlier pass, which is why the launcher icon stayed broken after the first fix attempt), `assets/adaptive-icon.png`, and `assets/splash-icon.png` (used by `IntroOverlay.tsx`, previously incorrectly pointed at the low-res `icon.png`).
- **Misc fixes**: GSTR-1 mobile export now shares an actual file via `expo-sharing` (was sharing plain text before); "Add Item" button during invoice creation fixed a one-character route typo (`/item/create` → `/items/create`); purchase bill Discount % field now shows a grey "Disc %" placeholder instead of a literal `0` when empty (default state values changed from `'0'` to `''`).
- Status: all changes committed to `main`, versionCode progressed through 24 builds this session (13→24) tracking each fix; final build tested on-device and confirmed working across all listed items.
