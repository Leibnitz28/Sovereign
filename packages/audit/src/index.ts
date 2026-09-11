// ============================================================
// SOVEREIGN — Audit Service
// ============================================================
// Hash-chained audit trail. Every event links to previous via hash.

import { createHash } from 'node:crypto';
import type { AuditEvent, AuditEventType, ActorType } from '@sovereign/domain';

const GENESIS_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Create a hash-chained audit event.
 * eventHash[n] = H(eventPayload[n] + eventHash[n-1])
 */
export function createAuditEvent(params: {
  taskId: string;
  intentId?: string | null;
  executionId?: string | null;
  eventType: AuditEventType;
  actorType: ActorType;
  actorId: string;
  metadata?: Record<string, unknown>;
  previousEventHash?: string;
}): Omit<AuditEvent, 'eventId'> {
  const timestamp = new Date();
  const previousHash = params.previousEventHash ?? GENESIS_HASH;

  // Create payload for hashing
  const payload = JSON.stringify({
    taskId: params.taskId,
    intentId: params.intentId ?? null,
    executionId: params.executionId ?? null,
    eventType: params.eventType,
    actorType: params.actorType,
    actorId: params.actorId,
    timestamp: timestamp.toISOString(),
    metadata: params.metadata ?? {},
  });

  const payloadHash = `0x${createHash('sha256').update(payload).digest('hex')}`;
  const eventHash = `0x${createHash('sha256').update(payload + previousHash).digest('hex')}`;

  return {
    taskId: params.taskId,
    intentId: params.intentId ?? null,
    executionId: params.executionId ?? null,
    eventType: params.eventType,
    actorType: params.actorType,
    actorId: params.actorId,
    timestamp,
    payloadHash,
    previousEventHash: previousHash,
    eventHash,
    metadata: params.metadata ?? {},
  };
}

/**
 * Verify the integrity of an audit chain.
 * Returns true if all hash links are valid.
 */
export function verifyAuditChain(events: readonly AuditEvent[]): {
  valid: boolean;
  brokenAt: number | null;
} {
  for (let i = 0; i < events.length; i++) {
    const event = events[i]!;

    if (i === 0) {
      if (event.previousEventHash !== GENESIS_HASH) {
        return { valid: false, brokenAt: 0 };
      }
    } else {
      const previousEvent = events[i - 1]!;
      if (event.previousEventHash !== previousEvent.eventHash) {
        return { valid: false, brokenAt: i };
      }
    }
  }
  return { valid: true, brokenAt: null };
}

export { GENESIS_HASH };
