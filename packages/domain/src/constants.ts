// ============================================================
// SOVEREIGN — Constants
// ============================================================

/** Base Sepolia network configuration */
export const BASE_SEPOLIA = {
  chainId: 84532,
  name: 'base-sepolia',
  rpcUrl: 'https://sepolia.base.org',
  blockExplorer: 'https://sepolia.basescan.org',
} as const;

/** Circle's official Base Sepolia USDC contract */
export const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

/** Retry configuration */
export const RETRY_CONFIG = {
  maxAttempts: 5,
  baseDelayMs: 1000,
  maxDelayMs: 16000,
  jitterFactor: 0.1,
} as const;

/** Exponential backoff delays: 1s, 2s, 4s, 8s, 16s */
export const RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000] as const;

/** Idempotency key TTL (24 hours) */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/** Supported networks */
export const SUPPORTED_NETWORKS = ['base-sepolia'] as const;

/** Supported currencies */
export const SUPPORTED_CURRENCIES = ['USDC'] as const;
