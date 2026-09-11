import { describe, it, expect } from 'vitest';
import { evaluatePolicy, wouldAmountPass } from '@sovereign/policy-engine';
import type { ExecutionPolicy, TransactionIntent } from '@sovereign/domain';

describe('Sovereign Policy Engine', () => {
  const samplePolicy: ExecutionPolicy = {
    policyId: 'pol-001',
    agentId: 'buyer-001',
    version: 1,
    maxSinglePayment: 10_000_000n, // $10 USDC
    maxCumulativeSpend: 50_000_000n, // $50 USDC
    allowedRecipients: ['0x2222222222222222222222222222222222222222'],
    allowedCurrencies: ['USDC'],
    allowedNetworks: ['base-sepolia'],
    requiredCapabilities: ['document-processing'],
    minimumWorkerReputation: 90,
    requiresVerification: true,
    maxExecutionsPerTask: 1,
    settlementTimeoutSeconds: 3600,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const validIntent: TransactionIntent = {
    intentId: 'int-001',
    taskId: 'task-001',
    buyerAgentId: 'buyer-001',
    workerAgentId: 'worker-001',
    recipient: '0x2222222222222222222222222222222222222222',
    amount: 8_000_000n, // $8 USDC
    currency: 'USDC',
    network: 'base-sepolia',
    capability: 'document-processing',
    settlementCondition: 'verification_passed',
    policyVersion: 1,
    expiresAt: new Date(Date.now() + 3600000),
    nonce: '0x1234',
    intentHash: '0xabcd',
    createdAt: new Date(),
  };

  it('approves compliant intent within spending limit and reputation threshold', () => {
    const context = {
      currentCumulativeSpend: 0n,
      currentExecutionCount: 0,
      workerReputationScore: 97.5,
      existingSettlementForTask: false,
      now: new Date(),
    };

    const decision = evaluatePolicy(validIntent, samplePolicy, context);
    expect(decision.approved).toBe(true);
    expect(decision.reasons).toEqual(['All policy checks passed']);
  });

  it('rejects transaction exceeding maximum single payment cap (Budget Overflow)', () => {
    const overspendIntent = { ...validIntent, amount: 15_000_000n }; // $15 exceeds $10 cap
    const context = {
      currentCumulativeSpend: 0n,
      currentExecutionCount: 0,
      workerReputationScore: 95,
      existingSettlementForTask: false,
      now: new Date(),
    };

    const decision = evaluatePolicy(overspendIntent, samplePolicy, context);
    expect(decision.approved).toBe(false);
    expect(decision.reasons[0]).toContain('BLOCKED — Payment $15 exceeds maximum single payment $10');
  });

  it('blocks cumulative spend limit circumvention', () => {
    const context = {
      currentCumulativeSpend: 45_000_000n, // 45 + 8 = 53 > 50
      currentExecutionCount: 0,
      workerReputationScore: 95,
      existingSettlementForTask: false,
      now: new Date(),
    };

    const decision = evaluatePolicy(validIntent, samplePolicy, context);
    expect(decision.approved).toBe(false);
    expect(decision.reasons.some((r) => r.includes('BUDGET CIRCUMVENTION BLOCKED'))).toBe(true);
  });

  it('blocks unapproved recipient address', () => {
    const rogueIntent = { ...validIntent, recipient: '0x9999999999999999999999999999999999999999' };
    const context = {
      currentCumulativeSpend: 0n,
      currentExecutionCount: 0,
      workerReputationScore: 95,
      existingSettlementForTask: false,
      now: new Date(),
    };

    const decision = evaluatePolicy(rogueIntent, samplePolicy, context);
    expect(decision.approved).toBe(false);
    expect(decision.reasons.some((r) => r.includes('RECIPIENT MISMATCH'))).toBe(true);
  });

  it('blocks worker failing minimum reputation threshold', () => {
    const context = {
      currentCumulativeSpend: 0n,
      currentExecutionCount: 0,
      workerReputationScore: 82.0, // Minimum is 90
      existingSettlementForTask: false,
      now: new Date(),
    };

    const decision = evaluatePolicy(validIntent, samplePolicy, context);
    expect(decision.approved).toBe(false);
    expect(decision.reasons.some((r) => r.includes('Worker reputation score 82 is below minimum requirement 90'))).toBe(true);
  });

  it('correctly evaluates wouldAmountPass helper for UI validation', () => {
    expect(wouldAmountPass(8_000_000n, samplePolicy, 0n).pass).toBe(true);
    expect(wouldAmountPass(12_000_000n, samplePolicy, 0n).pass).toBe(false);
    expect(wouldAmountPass(8_000_000n, samplePolicy, 45_000_000n).pass).toBe(false);
  });
});
