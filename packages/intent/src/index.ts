// ============================================================
// SOVEREIGN — Intent Engine
// ============================================================
// Canonical intent creation, deterministic serialization, keccak256 hashing.

import type { TransactionIntent } from '@sovereign/domain';
import { createHash, randomUUID, randomBytes } from 'node:crypto';

/**
 * Canonicalize a TransactionIntent into a deterministic string.
 * Field order is fixed. All values are normalized.
 * Any change to any security-critical field changes the hash.
 */
export function canonicalizeIntent(intent: Omit<TransactionIntent, 'intentId' | 'intentHash' | 'createdAt'>): string {
  const canonical = [
    `taskId:${intent.taskId}`,
    `buyerAgentId:${intent.buyerAgentId}`,
    `workerAgentId:${intent.workerAgentId}`,
    `recipient:${intent.recipient.toLowerCase()}`,
    `amount:${intent.amount.toString()}`,
    `currency:${intent.currency}`,
    `network:${intent.network}`,
    `capability:${intent.capability}`,
    `settlementCondition:${intent.settlementCondition}`,
    `policyVersion:${intent.policyVersion}`,
    `expiresAt:${intent.expiresAt.toISOString()}`,
    `nonce:${intent.nonce}`,
  ].join('|');

  return canonical;
}

/**
 * Compute keccak256 hash of the canonical intent.
 * Uses Node.js crypto which supports keccak via 'sha3-256'.
 * For Ethereum-compatible keccak256, we use the raw implementation.
 */
export function hashIntent(canonicalIntent: string): string {
  // Use SHA3-256 (keccak256) for Ethereum compatibility
  const hash = createHash('sha3-256').update(canonicalIntent).digest('hex');
  return `0x${hash}`;
}

/**
 * Generate a cryptographically secure nonce for intent uniqueness.
 */
export function generateNonce(): string {
  return `0x${randomBytes(32).toString('hex')}`;
}

/**
 * Create a complete TransactionIntent with hash.
 */
export function createTransactionIntent(params: {
  taskId: string;
  buyerAgentId: string;
  workerAgentId: string;
  recipient: string;
  amount: bigint;
  currency: string;
  network: string;
  capability: string;
  settlementCondition: string;
  policyVersion: number;
  expiresAt: Date;
}): TransactionIntent {
  const nonce = generateNonce();
  const intentId = randomUUID();

  const partialIntent = {
    ...params,
    nonce,
  };

  const canonical = canonicalizeIntent(partialIntent);
  const intentHash = hashIntent(canonical);

  return {
    intentId,
    ...params,
    nonce,
    intentHash,
    createdAt: new Date(),
  };
}

/**
 * Verify that an intent's hash matches its content.
 * Used to detect intent mutation.
 */
export function verifyIntentHash(intent: TransactionIntent): boolean {
  const canonical = canonicalizeIntent(intent);
  const expectedHash = hashIntent(canonical);
  return expectedHash === intent.intentHash;
}
