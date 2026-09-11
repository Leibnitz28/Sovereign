import { describe, it, expect } from 'vitest';
import { calculateReputation, explainReputation, REPUTATION_WEIGHTS } from '@sovereign/reputation';
import type { ReputationEvent } from '@sovereign/domain';

describe('Sovereign Reputation Engine', () => {
  it('returns baseline neutral snapshot when no history exists', () => {
    const snapshot = calculateReputation('agent-001', 'document-processing', []);
    expect(snapshot.overallScore).toBe(50);
    expect(snapshot.taskVolume).toBe(0);
    expect(snapshot.disputeRate).toBe(0);
  });

  it('calculates weighted score accurately from historical events', () => {
    const now = new Date();
    const events: ReputationEvent[] = [
      {
        eventId: '1',
        agentId: 'agent-001',
        capability: 'document-processing',
        eventType: 'task_completed',
        weight: 1.0,
        metadata: {},
        createdAt: now,
      },
      {
        eventId: '2',
        agentId: 'agent-001',
        capability: 'document-processing',
        eventType: 'verification_passed',
        weight: 1.0,
        metadata: {},
        createdAt: now,
      },
      {
        eventId: '3',
        agentId: 'agent-001',
        capability: 'document-processing',
        eventType: 'settlement_confirmed',
        weight: 1.0,
        metadata: {},
        createdAt: now,
      },
    ];

    const snapshot = calculateReputation('agent-001', 'document-processing', events, now);
    expect(snapshot.overallScore).toBeGreaterThan(60);
    expect(snapshot.taskVolume).toBe(1);
    expect(snapshot.disputeRate).toBe(0);
  });

  it('penalizes score when disputes are filed', () => {
    const now = new Date();
    const cleanEvents: ReputationEvent[] = [
      { eventId: '1', agentId: 'agent-001', capability: 'doc', eventType: 'task_completed', weight: 1, metadata: {}, createdAt: now },
    ];
    const disputeEvents: ReputationEvent[] = [
      ...cleanEvents,
      { eventId: '2', agentId: 'agent-001', capability: 'doc', eventType: 'dispute_filed', weight: 1, metadata: {}, createdAt: now },
      { eventId: '3', agentId: 'agent-001', capability: 'doc', eventType: 'dispute_filed', weight: 1, metadata: {}, createdAt: now },
    ];

    const cleanScore = calculateReputation('agent-001', 'doc', cleanEvents, now).overallScore;
    const disputedScore = calculateReputation('agent-001', 'doc', disputeEvents, now).overallScore;

    expect(disputedScore).toBeLessThan(cleanScore);
  });

  it('provides explainable component breakdown', () => {
    const snapshot = calculateReputation('agent-001', 'doc', []);
    const explanation = explainReputation(snapshot);

    expect(Array.isArray(explanation)).toBe(true);
    expect(explanation.length).toBe(8);
    expect(explanation[0]).toContain('Overall Score: 50/100');
  });
});
