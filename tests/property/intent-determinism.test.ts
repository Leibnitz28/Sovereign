import { describe, it } from 'vitest';
import fc from 'fast-check';
import { canonicalizeIntent, hashIntent } from '@sovereign/intent';

describe('Intent Engine Property Tests (fast-check)', () => {
  it('guarantees deterministic hashing invariant for arbitrary intents', () => {
    fc.assert(
      fc.property(
        fc.record({
          taskId: fc.uuid(),
          buyerAgentId: fc.uuid(),
          workerAgentId: fc.uuid(),
          recipient: fc.hexaString({ minLength: 40, maxLength: 40 }).map((h) => `0x${h}`),
          amount: fc.bigInt({ min: 1n, max: 1_000_000_000_000n }),
          currency: fc.constantFrom('USDC', 'EURC', 'DAI'),
          network: fc.constantFrom('base-sepolia', 'ethereum-sepolia'),
          capability: fc.constantFrom('document-processing', 'code-audit', 'translation'),
          settlementCondition: fc.constant('verification_passed' as const),
          policyVersion: fc.integer({ min: 1, max: 100 }),
          expiresAt: fc.date(),
          nonce: fc.hexaString({ minLength: 32, maxLength: 64 }).map((h) => `0x${h}`),
        }),
        (intentParams) => {
          const canonicalA = canonicalizeIntent(intentParams);
          const canonicalB = canonicalizeIntent(intentParams);
          const hashA = hashIntent(canonicalA);
          const hashB = hashIntent(canonicalB);

          // Invariant 1: Canonical representation is strictly deterministic
          if (canonicalA !== canonicalB) return false;

          // Invariant 2: Hash output is strictly deterministic
          if (hashA !== hashB) return false;

          // Invariant 3: Hash matches 0x prefix + 64 hex characters
          if (!/^0x[a-f0-9]{64}$/.test(hashA)) return false;

          return true;
        }
      ),
      { numRuns: 200 }
    );
  });
});
