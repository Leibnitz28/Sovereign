import { describe, it, expect } from 'vitest';
import { canonicalizeIntent, hashIntent, createTransactionIntent, verifyIntentHash } from '@sovereign/intent';

describe('Sovereign Intent Engine', () => {
  const baseParams = {
    taskId: 'task-123',
    buyerAgentId: 'buyer-alpha',
    workerAgentId: 'worker-beta',
    recipient: '0x2222222222222222222222222222222222222222',
    amount: 8000000n,
    currency: 'USDC',
    network: 'base-sepolia',
    capability: 'document-processing',
    settlementCondition: 'verification_passed' as const,
    policyVersion: 1,
    expiresAt: new Date('2026-09-12T12:00:00.000Z'),
  };

  it('produces identical deterministic canonical string and hash for identical fields', () => {
    const nonce = '0xabcd1234';
    const canonical1 = canonicalizeIntent({ ...baseParams, nonce });
    const canonical2 = canonicalizeIntent({ ...baseParams, nonce });

    expect(canonical1).toBe(canonical2);
    expect(hashIntent(canonical1)).toBe(hashIntent(canonical2));
  });

  it('detects tampering when any critical financial parameter changes', () => {
    const nonce = '0xabcd1234';
    const originalCanonical = canonicalizeIntent({ ...baseParams, nonce });
    const originalHash = hashIntent(originalCanonical);

    // 1. Alter amount
    const alteredAmountCanonical = canonicalizeIntent({ ...baseParams, amount: 8000001n, nonce });
    expect(hashIntent(alteredAmountCanonical)).not.toBe(originalHash);

    // 2. Alter recipient
    const alteredRecipientCanonical = canonicalizeIntent({
      ...baseParams,
      recipient: '0x9999999999999999999999999999999999999999',
      nonce,
    });
    expect(hashIntent(alteredRecipientCanonical)).not.toBe(originalHash);

    // 3. Alter network
    const alteredNetworkCanonical = canonicalizeIntent({ ...baseParams, network: 'mainnet', nonce });
    expect(hashIntent(alteredNetworkCanonical)).not.toBe(originalHash);
  });

  it('creates full TransactionIntent and verifies hash successfully', () => {
    const intent = createTransactionIntent(baseParams);
    expect(intent.intentHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(verifyIntentHash(intent)).toBe(true);

    // Tamper with intent after generation
    const tamperedIntent = { ...intent, amount: 9000000n };
    expect(verifyIntentHash(tamperedIntent)).toBe(false);
  });
});
