export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/**
 * Validates a 15-character Indian GSTIN:
 * 1. 15 characters long
 * 2. Structural regex match
 * 3. Valid state code (01-38, 97, 99)
 * 4. Modulo-36 checksum verification digit on 15th character
 */
export function validateGSTIN(gstin: string | null | undefined): ValidationResult {
  if (!gstin || !gstin.trim()) {
    return { isValid: true };
  }

  const clean = gstin.trim().toUpperCase();

  if (clean.length !== 15) {
    return {
      isValid: false,
      error: 'GSTIN must be exactly 15 characters',
    };
  }

  if (!GSTIN_REGEX.test(clean)) {
    return {
      isValid: false,
      error: 'Invalid GSTIN format (e.g. 27AAPFU0939F1ZV)',
    };
  }

  const statePrefix = clean.slice(0, 2);
  const stateCode = parseInt(statePrefix, 10);
  const isValidState = (stateCode >= 1 && stateCode <= 38) || statePrefix === '97' || statePrefix === '99';

  if (!isValidState) {
    return {
      isValid: false,
      error: `Invalid GST state code "${statePrefix}". Must be 01–38, 97, or 99`,
    };
  }

  let total = 0;
  for (let i = 0; i < 14; i++) {
    const val = GSTIN_CHARS.indexOf(clean[i]);
    if (val === -1) {
      return {
        isValid: false,
        error: `Invalid character "${clean[i]}" in GSTIN`,
      };
    }
    let digit = val * (i % 2 === 0 ? 1 : 2);
    digit = Math.floor(digit / 36) + (digit % 36);
    total += digit;
  }

  const rem = total % 36;
  const checkVal = (36 - rem) % 36;
  const expectedChecksumChar = GSTIN_CHARS[checkVal];

  if (clean[14] !== expectedChecksumChar) {
    return {
      isValid: false,
      error: `Invalid GSTIN checksum digit. Expected "${expectedChecksumChar}", got "${clean[14]}"`,
    };
  }

  return { isValid: true };
}

/**
 * Validates HSN / SAC code:
 * - Must be empty/blank OR exactly 2, 4, 6, or 8 numeric digits
 */
export function validateHSN(hsn: string | null | undefined): ValidationResult {
  if (!hsn || !hsn.trim()) {
    return { isValid: true };
  }

  const clean = hsn.trim();
  if (!/^\d+$/.test(clean)) {
    return {
      isValid: false,
      error: 'HSN code must contain only numbers',
    };
  }

  if (![2, 4, 6, 8].includes(clean.length)) {
    return {
      isValid: false,
      error: 'HSN code must be exactly 2, 4, 6, or 8 digits',
    };
  }

  return { isValid: true };
}

/**
 * Validates Indian 10-digit phone number:
 * - Exactly 10 digits
 */
export function validatePhone(phone: string | null | undefined, required = false): ValidationResult {
  if (!phone || !phone.trim()) {
    if (required) {
      return { isValid: false, error: 'Phone number is required' };
    }
    return { isValid: true };
  }

  const clean = phone.trim();
  if (!/^\d{10}$/.test(clean)) {
    return {
      isValid: false,
      error: 'Phone number must be exactly 10 digits',
    };
  }

  return { isValid: true };
}
