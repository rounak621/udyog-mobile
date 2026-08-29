# Udyog Mobile

React Native / Expo mobile application for Udyog GST Billing SaaS.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npx expo start
```

## Security & Release Signing

- Keystore files, passwords, and sensitive Gradle properties are strictly excluded from version control.
- For local release builds and EAS credentials setup, refer to [docs/SIGNING_AND_SECRETS.md](file:///Users/rounak/Projects/BillMitra/udyog-mobile/docs/SIGNING_AND_SECRETS.md).
- Firebase configuration (`google-services.json`) is gitignored and resolved dynamically via `app.config.js` or EAS Secrets.

## Documentation

- [docs/DEVELOPMENT.md](file:///Users/rounak/Projects/BillMitra/udyog-mobile/docs/DEVELOPMENT.md) — Comprehensive mobile development architecture & changelog
- [docs/SIGNING_AND_SECRETS.md](file:///Users/rounak/Projects/BillMitra/udyog-mobile/docs/SIGNING_AND_SECRETS.md) — Keystore signing, secrets & CI/EAS setup
- [docs/cicd.md](file:///Users/rounak/Projects/BillMitra/udyog-mobile/docs/cicd.md) — CI/CD deployment guide across services
