import { describe, it, expect } from 'vitest';
import { validateTransition, isTerminalState, TASK_STATES, TASK_FAILURE_STATES } from '@sovereign/domain';

describe('Sovereign Task Finite State Machine', () => {
  it('allows complete valid happy path sequence', () => {
    const sequence = [
      ['CREATED', 'DISCOVERING'],
      ['DISCOVERING', 'CANDIDATE_SELECTED'],
      ['CANDIDATE_SELECTED', 'POLICY_PENDING'],
      ['POLICY_PENDING', 'POLICY_APPROVED'],
      ['POLICY_APPROVED', 'INTENT_COMMITTED'],
      ['INTENT_COMMITTED', 'ESCROW_AUTHORIZED'],
      ['ESCROW_AUTHORIZED', 'WORK_IN_PROGRESS'],
      ['WORK_IN_PROGRESS', 'RESULT_SUBMITTED'],
      ['RESULT_SUBMITTED', 'VERIFICATION_PENDING'],
      ['VERIFICATION_PENDING', 'VERIFIED'],
      ['VERIFIED', 'SETTLEMENT_PENDING'],
      ['SETTLEMENT_PENDING', 'KEEPERHUB_EXECUTING'],
      ['KEEPERHUB_EXECUTING', 'SETTLEMENT_CONFIRMED'],
      ['SETTLEMENT_CONFIRMED', 'REPUTATION_UPDATED'],
      ['REPUTATION_UPDATED', 'COMPLETED'],
    ] as const;

    for (const [from, to] of sequence) {
      const res = validateTransition(from, to);
      expect(res.valid).toBe(true);
      expect(res.reason).toBeUndefined();
    }
  });

  it('rejects invalid or skipped transitions', () => {
    // Cannot skip directly from CREATED to COMPLETED
    const skip1 = validateTransition('CREATED', 'COMPLETED');
    expect(skip1.valid).toBe(false);

    // Cannot jump from WORK_IN_PROGRESS directly to SETTLEMENT_CONFIRMED
    const skip2 = validateTransition('WORK_IN_PROGRESS', 'SETTLEMENT_CONFIRMED');
    expect(skip2.valid).toBe(false);

    // Cannot transition backward from COMPLETED
    const back = validateTransition('COMPLETED', 'CREATED');
    expect(back.valid).toBe(false);
  });

  it('identifies terminal states properly', () => {
    expect(isTerminalState('COMPLETED')).toBe(true);
    expect(isTerminalState('CANCELLED')).toBe(true);
    expect(isTerminalState('EXPIRED')).toBe(true);
    expect(isTerminalState('WORK_IN_PROGRESS')).toBe(false);
    expect(isTerminalState('POLICY_PENDING')).toBe(false);
  });
});
