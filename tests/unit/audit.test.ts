import { describe, it, expect } from 'vitest';
import { createAuditEvent, verifyAuditChain } from '@sovereign/audit';
import type { AuditEvent } from '@sovereign/domain';

describe('Sovereign Hash-Chained Audit Trail', () => {
  it('creates genesis event linking to all-zero hash', () => {
    const event1 = createAuditEvent({
      taskId: 'task-1',
      eventType: 'task.created',
      actorType: 'agent',
      actorId: 'buyer-001',
    });

    expect(event1.previousEventHash).toBe('0x0000000000000000000000000000000000000000000000000000000000000000');
    expect(event1.eventHash).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it('chains subsequent events to previous event hash', () => {
    const event1 = createAuditEvent({
      taskId: 'task-1',
      eventType: 'task.created',
      actorType: 'agent',
      actorId: 'buyer-001',
    });

    const event2 = createAuditEvent({
      taskId: 'task-1',
      eventType: 'worker.selected',
      actorType: 'orchestrator',
      actorId: 'system',
      previousEventHash: event1.eventHash,
    });

    expect(event2.previousEventHash).toBe(event1.eventHash);
    expect(event2.eventHash).not.toBe(event1.eventHash);
  });

  it('validates unbroken chain and detects tampering', () => {
    const event1 = { ...createAuditEvent({ taskId: 't1', eventType: 'task.created', actorType: 'agent', actorId: 'a1' }), eventId: '1' } as AuditEvent;
    const event2 = { ...createAuditEvent({ taskId: 't1', eventType: 'escrow.locked', actorType: 'system', actorId: 's1', previousEventHash: event1.eventHash }), eventId: '2' } as AuditEvent;

    const chain = [event1, event2];
    expect(verifyAuditChain(chain).valid).toBe(true);

    // Tamper with event2's previous hash link
    const brokenChain = [
      event1,
      { ...event2, previousEventHash: '0x1111111111111111111111111111111111111111111111111111111111111111' },
    ];
    const verifyRes = verifyAuditChain(brokenChain);
    expect(verifyRes.valid).toBe(false);
    expect(verifyRes.brokenAt).toBe(1);
  });
});
