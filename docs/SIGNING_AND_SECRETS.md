# Udyog Mobile — Secrets & Release Signing Guide

This document outlines how release signing credentials, Firebase configuration, and environment secrets are managed for `udyog-mobile`.

---

## 1. Release Keystore Signing

To build a release APK or AAB (`./gradlew assembleRelease` or EAS Cloud Builds), Android requires a cryptographic signing key.

> [!CAUTION]
> **Never commit signing passwords, aliases, or keystore files into version control.**
> All sensitive properties (`*.keystore`, `gradle.properties`, `local.properties`) are strictly ignored by `.gitignore`.

### A. Local Builds (Workstation)

For building signed releases locally on your machine, do **not** place plaintext credentials into `android/gradle.properties` within the repository. Instead, use one of the two standard approaches:

#### Option 1: User-Level Gradle Properties (Recommended)
Place your signing configuration in `~/.gradle/gradle.properties` in your user home directory (`/Users/<username>/.gradle/gradle.properties`). Gradle automatically reads this file across builds without touching repository files:

```properties
UDYOG_RELEASE_STORE_FILE=/path/to/your/udyog-release-key.keystore
UDYOG_RELEASE_KEY_ALIAS=udyog
UDYOG_RELEASE_STORE_PASSWORD=<your_release_store_password>
UDYOG_RELEASE_KEY_PASSWORD=<your_release_key_password>
```

#### Option 2: Environment Variables
Pass the credentials as environment variables to Gradle:

```bash
export ORG_GRADLE_PROJECT_UDYOG_RELEASE_STORE_FILE="/path/to/your/udyog-release-key.keystore"
export ORG_GRADLE_PROJECT_UDYOG_RELEASE_KEY_ALIAS="udyog"
export ORG_GRADLE_PROJECT_UDYOG_RELEASE_STORE_PASSWORD="<your_release_store_password>"
export ORG_GRADLE_PROJECT_UDYOG_RELEASE_KEY_PASSWORD="<your_release_key_password>"
./gradlew assembleRelease
```

---

### B. Cloud / CI Builds (EAS Build)

In CI/CD environments and EAS Cloud Builds, machines do not have access to developer local home directories.

1. **Upload Keystore to EAS**:
   Run the following command in `udyog-mobile`:
   ```bash
   eas credentials
   ```
   Select `Android` -> `production` / `preview` -> `Keystore`.
   Choose **Upload existing keystore**, and provide:
   - Keystore file: path to `udyog-release-key.keystore`
   - Key alias: `udyog`
   - Keystore password
   - Key password

2. **EAS Build Workflow**:
   Once uploaded, EAS securely manages the keystore in encrypted cloud storage and injects it into build containers during `eas build --platform android`. No local file paths in `gradle.properties` are needed.

> [!IMPORTANT]
> Because existing app installations require matching signing keys to accept updates, the existing release keystore must be preserved and uploaded to EAS rather than generating an entirely new one.

---

## 2. Firebase Configuration (`google-services.json`)

`google-services.json` contains Google Services configuration including the client API key for Android push notifications.

- **Git Tracking**: `google-services.json` and `**/google-services.json` are excluded from version control in `.gitignore`.
- **Dynamic Configuration**: `app.config.js` is configured to resolve the file dynamically:
  ```javascript
  module.exports = ({ config }) => {
    return {
      ...config,
      android: {
        ...config.android,
        googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
      },
    };
  };
  ```
- **EAS Builds**:
  Provide `GOOGLE_SERVICES_JSON` as an EAS Secret:
  ```bash
  eas secret:create --scope project --name GOOGLE_SERVICES_JSON --type file --file ./google-services.json
  ```
- **Platform Restrictions**:
  Firebase client API keys identify the project. In the Google Cloud Console / Firebase Console under **APIs & Services** > **Credentials**:
  - Restrict application type to **Android apps**.
  - Specify package name `com.udyog.udyogmobile` and SHA-1 signing certificate fingerprints (debug and release).
  - Restrict API scope to required APIs (e.g. Firebase Cloud Messaging, Firebase Installations).

---

## 3. Expo Prebuild Note

Running `expo prebuild --clean` regenerates the native `android/` directory. When regenerated:
1. `android/gradle.properties` will be regenerated from template.
2. Ensure you do not write plaintext passwords into `android/gradle.properties`.
3. Keep your release properties safely in `~/.gradle/gradle.properties`.
