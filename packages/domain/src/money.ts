// ============================================================
// SOVEREIGN — Money Utilities
// ============================================================
// Integer atomic unit arithmetic only. NO floating-point for money.
// USDC uses 6 decimal places: 1 USDC = 1_000_000 atomic units.

/** USDC has 6 decimals */
export const USDC_DECIMALS = 6;
export const USDC_SCALE = BigInt(10 ** USDC_DECIMALS); // 1_000_000n

/**
 * Convert a human-readable dollar string to atomic units.
 * "$10" → 10_000_000n
 * "8.5" → 8_500_000n
 */
export function usdcToAtomicUnits(humanReadable: string): bigint {
  // Strip dollar sign and whitespace
  const cleaned = humanReadable.replace(/[$\s,]/g, '');
  const parts = cleaned.split('.');

  if (parts.length > 2) {
    throw new Error(`Invalid USDC amount: ${humanReadable}`);
  }

  const wholePart = parts[0] ?? '0';
  let fractionalPart = parts[1] ?? '';

  // Validate numeric
  if (!/^\d+$/.test(wholePart) || (fractionalPart !== '' && !/^\d+$/.test(fractionalPart))) {
    throw new Error(`Invalid USDC amount: ${humanReadable}`);
  }

  // Pad or truncate fractional to 6 digits
  if (fractionalPart.length > USDC_DECIMALS) {
    throw new Error(`USDC amount has too many decimal places (max ${USDC_DECIMALS}): ${humanReadable}`);
  }
  fractionalPart = fractionalPart.padEnd(USDC_DECIMALS, '0');

  const whole = BigInt(wholePart) * USDC_SCALE;
  const fractional = BigInt(fractionalPart);

  return whole + fractional;
}

/**
 * Convert atomic units to human-readable dollar string.
 * 10_000_000n → "$10.000000"
 */
export function atomicUnitsToUsdc(atomicUnits: bigint): string {
  if (atomicUnits < 0n) {
    throw new Error('Amount cannot be negative');
  }

  const whole = atomicUnits / USDC_SCALE;
  const fractional = atomicUnits % USDC_SCALE;
  const fractionalStr = fractional.toString().padStart(USDC_DECIMALS, '0');

  return `$${whole}.${fractionalStr}`;
}

/**
 * Format atomic units as a clean display string.
 * 10_000_000n → "$10.00"
 * 8_500_000n → "$8.50"
 */
export function formatUsdc(atomicUnits: bigint): string {
  if (atomicUnits < 0n) {
    throw new Error('Amount cannot be negative');
  }

  const whole = atomicUnits / USDC_SCALE;
  const fractional = atomicUnits % USDC_SCALE;
  const fractionalStr = fractional.toString().padStart(USDC_DECIMALS, '0');

  // Trim trailing zeros but keep at least 2 decimal places
  let trimmed = fractionalStr.replace(/0+$/, '');
  if (trimmed.length < 2) {
    trimmed = trimmed.padEnd(2, '0');
  }

  return `$${whole}.${trimmed}`;
}

/**
 * Safe addition with overflow check.
 */
export function safeAdd(a: bigint, b: bigint): bigint {
  const result = a + b;
  if (result < a || result < b) {
    throw new Error('Arithmetic overflow');
  }
  return result;
}

/**
 * Validates that an amount is positive and within reasonable bounds.
 */
export function validateAmount(amount: bigint): void {
  if (amount <= 0n) {
    throw new Error('Amount must be positive');
  }
  // Max 1 billion USDC — sane upper bound
  const MAX_AMOUNT = BigInt(1_000_000_000) * USDC_SCALE;
  if (amount > MAX_AMOUNT) {
    throw new Error('Amount exceeds maximum allowed value');
  }
}
