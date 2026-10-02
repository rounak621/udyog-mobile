# Building Udyog Mobile

## ⚠️ Never run `expo prebuild`

`expo prebuild` regenerates the entire `android/` directory from `app.json`, which will overwrite product-flavor config, signing config, and all native customizations in this repo. **Do not run it.**

---

## Build Commands

All commands must be run from the repo root. The `NODE_ENV=production` prefix is required to ensure the Metro bundler does not include dev-only code.

### Staging APK (side-loadable, separate app ID)

```bash
NODE_ENV=production ./android/gradlew -p android assembleStagingRelease
```

Output: `android/app/build/outputs/apk/staging/release/app-staging-release.apk`

- **App name**: UDYOG Staging  
- **Package**: `com.udyog.udyogmobile.staging`  
- **API**: `https://staging-api.udyogbook.in/api/v1`  
- **Deep-link scheme**: `udyog-staging`  
- **Firebase**: disabled (no `google-services.json` for staging; build warns and continues)  

### Production APK

```bash
NODE_ENV=production ./android/gradlew -p android assembleProductionRelease
```

Output: `android/app/build/outputs/apk/production/release/app-production-release.apk`

### Production AAB (for Play Store upload)

```bash
NODE_ENV=production ./android/gradlew -p android bundleProductionRelease
```

Output: `android/app/build/outputs/bundle/productionRelease/app-productionRelease.aab`

---

## Signing

Signing secrets are **not** in the repo. They must be present in `~/.gradle/gradle.properties`:

```
UDYOG_RELEASE_STORE_FILE=/path/to/release.keystore
UDYOG_RELEASE_STORE_PASSWORD=…
UDYOG_RELEASE_KEY_ALIAS=…
UDYOG_RELEASE_KEY_PASSWORD=…
```

---

## Product Flavors

| Flavor | App ID | Name | API | Scheme | Firebase |
|--------|--------|------|-----|--------|----------|
| `production` | `com.udyog.udyogmobile` | UDYOG | `api.udyogbook.in` | `udyog` | Yes (`src/production/google-services.json`) |
| `staging` | `com.udyog.udyogmobile.staging` | UDYOG Staging | `staging-api.udyogbook.in` | `udyog-staging` | No (warn only) |

Both flavors use the **same release signing key** configured in `signingConfigs.release`.
