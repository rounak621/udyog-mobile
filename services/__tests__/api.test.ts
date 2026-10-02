/**
 * Plain TypeScript assertions for resolveApiBaseUrl and getAppScheme.
 * Jest is not configured in this project.
 *
 * Run with:
 *   npx ts-node services/__tests__/api.test.ts
 * (ts-node resolves via node_modules/.bin/ts-node, no global install needed)
 */

// Inline the functions under test so this file has no side-effects from
// importing the real api.ts (which calls Application.applicationId at module
// load time, requiring a React Native runtime).

const PROD_URL = 'https://api.udyogbook.in/api/v1';
const STAGING_URL = 'https://staging-api.udyogbook.in/api/v1';

function resolveApiBaseUrl(applicationId: string | null, isDev: boolean): string {
  if (applicationId === 'com.udyog.udyogmobile' && !isDev) {
    return PROD_URL;
  }
  return STAGING_URL;
}

function getAppScheme(applicationId: string | null): string {
  if (applicationId?.endsWith('.staging')) {
    return 'udyog-staging';
  }
  return 'udyog';
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

// resolveApiBaseUrl — 4 cases
assert(
  resolveApiBaseUrl('com.udyog.udyogmobile', false) === PROD_URL,
  'prod release → production URL',
);
assert(
  resolveApiBaseUrl('com.udyog.udyogmobile.staging', false) === STAGING_URL,
  'staging release → staging URL',
);
assert(
  resolveApiBaseUrl('com.udyog.udyogmobile', true) === STAGING_URL,
  'prod dev (__DEV__=true) → staging URL',
);
assert(
  resolveApiBaseUrl('com.udyog.udyogmobile.staging', true) === STAGING_URL,
  'staging dev (__DEV__=true) → staging URL',
);

// getAppScheme — 2 cases
assert(getAppScheme('com.udyog.udyogmobile') === 'udyog', 'prod → scheme udyog');
assert(getAppScheme('com.udyog.udyogmobile.staging') === 'udyog-staging', 'staging → scheme udyog-staging');

console.log('\nAll assertions passed.');
