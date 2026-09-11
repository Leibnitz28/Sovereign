// ============================================================
// SOVEREIGN — Reputation Engine
// ============================================================
// Transparent, formula-based reputation. No LLM-assigned scores.
// Every score is explainable with component values.

import type { ReputationEvent, ReputationSnapshot } from '@sovereign/domain';

/** Reputation weight configuration */
export const REPUTATION_WEIGHTS = {
  completionRate: 0.30,
  successfulSettlementRate: 0.20,
  verificationSuccessRate: 0.20,
  disputeInverse: 0.10,
  recency: 0.10,
  capabilityReliability: 0.10,
} as const;

/**
 * Calculate reputation score from events.
 * Returns a snapshot with all component values for explainability.
 */
export function calculateReputation(
  agentId: string,
  capability: string,
  events: readonly ReputationEvent[],
  now: Date = new Date(),
): ReputationSnapshot {
  if (events.length === 0) {
    return createBaselineSnapshot(agentId, capability, now);
  }

  // Count event types
  const counts = {
    completed: 0,
    failed: 0,
    verificationPassed: 0,
    verificationFailed: 0,
    disputeFiled: 0,
    disputeResolved: 0,
    settlementConfirmed: 0,
    settlementFailed: 0,
  };

  for (const event of events) {
    switch (event.eventType) {
      case 'task_completed': counts.completed++; break;
      case 'task_failed': counts.failed++; break;
      case 'verification_passed': counts.verificationPassed++; break;
      case 'verification_failed': counts.verificationFailed++; break;
      case 'dispute_filed': counts.disputeFiled++; break;
      case 'dispute_resolved': counts.disputeResolved++; break;
      case 'settlement_confirmed': counts.settlementConfirmed++; break;
      case 'settlement_failed': counts.settlementFailed++; break;
    }
  }

  const totalTasks = counts.completed + counts.failed;
  const totalSettlements = counts.settlementConfirmed + counts.settlementFailed;
  const totalVerifications = counts.verificationPassed + counts.verificationFailed;

  // Calculate component rates (0-1)
  const completionRate = totalTasks > 0 ? counts.completed / totalTasks : 0.5;
  const successfulSettlementRate = totalSettlements > 0 ? counts.settlementConfirmed / totalSettlements : 0.5;
  const verificationSuccessRate = totalVerifications > 0 ? counts.verificationPassed / totalVerifications : 0.5;
  const disputeRate = totalTasks > 0 ? counts.disputeFiled / totalTasks : 0;
  const disputeInverse = 1 - disputeRate;

  // Recency: how recently active (events in last 30 days / total)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recentEvents = events.filter((e) => e.createdAt > thirtyDaysAgo).length;
  const recentActivity = Math.min(recentEvents / Math.max(events.length, 1), 1);

  // Capability reliability (same as completion for now, but scoped to this capability)
  const capabilityReliability = completionRate;

  // Weighted score (0-100)
  const rawScore =
    REPUTATION_WEIGHTS.completionRate * completionRate +
    REPUTATION_WEIGHTS.successfulSettlementRate * successfulSettlementRate +
    REPUTATION_WEIGHTS.verificationSuccessRate * verificationSuccessRate +
    REPUTATION_WEIGHTS.disputeInverse * disputeInverse +
    REPUTATION_WEIGHTS.recency * recentActivity +
    REPUTATION_WEIGHTS.capabilityReliability * capabilityReliability;

  const overallScore = Math.round(rawScore * 100 * 100) / 100; // 2 decimal precision

  return {
    snapshotId: '', // Assigned by DB
    agentId,
    capability,
    overallScore,
    completionRate,
    successfulSettlementRate,
    verificationSuccessRate,
    disputeRate,
    recentActivity,
    capabilityReliability,
    taskVolume: totalTasks,
    calculatedAt: now,
  };
}

/**
 * Create a baseline snapshot for agents with no history.
 * Starts at 50 — neutral, requiring proof to rise or fall.
 */
function createBaselineSnapshot(agentId: string, capability: string, now: Date): ReputationSnapshot {
  return {
    snapshotId: '',
    agentId,
    capability,
    overallScore: 50,
    completionRate: 0.5,
    successfulSettlementRate: 0.5,
    verificationSuccessRate: 0.5,
    disputeRate: 0,
    recentActivity: 0,
    capabilityReliability: 0.5,
    taskVolume: 0,
    calculatedAt: now,
  };
}

/**
 * Generate a human-readable explanation of the reputation score.
 */
export function explainReputation(snapshot: ReputationSnapshot): string[] {
  const explanations: string[] = [
    `Overall Score: ${snapshot.overallScore}/100`,
    `Completion Rate: ${(snapshot.completionRate * 100).toFixed(1)}% (weight: ${REPUTATION_WEIGHTS.completionRate * 100}%)`,
    `Settlement Success: ${(snapshot.successfulSettlementRate * 100).toFixed(1)}% (weight: ${REPUTATION_WEIGHTS.successfulSettlementRate * 100}%)`,
    `Verification Success: ${(snapshot.verificationSuccessRate * 100).toFixed(1)}% (weight: ${REPUTATION_WEIGHTS.verificationSuccessRate * 100}%)`,
    `Dispute Rate: ${(snapshot.disputeRate * 100).toFixed(1)}% (weight: ${REPUTATION_WEIGHTS.disputeInverse * 100}%, inverted)`,
    `Recent Activity: ${(snapshot.recentActivity * 100).toFixed(1)}% (weight: ${REPUTATION_WEIGHTS.recency * 100}%)`,
    `Capability Reliability: ${(snapshot.capabilityReliability * 100).toFixed(1)}% (weight: ${REPUTATION_WEIGHTS.capabilityReliability * 100}%)`,
    `Total Tasks: ${snapshot.taskVolume}`,
  ];
  return explanations;
}

/**
 * Validate that a reputation event can be recorded.
 * Prevents self-attestation and farming.
 */
export function validateReputationEvent(
  event: Omit<ReputationEvent, 'eventId'>,
  existingEvents: readonly ReputationEvent[],
): { valid: boolean; reason: string } {
  // Check for duplicate events (same agent, task, type)
  const isDuplicate = existingEvents.some(
    (e) => e.agentId === event.agentId && e.taskId === event.taskId && e.eventType === event.eventType,
  );
  if (isDuplicate) {
    return { valid: false, reason: 'Duplicate reputation event for this agent/task/type' };
  }

  // Positive reputation requires settlement confirmation
  const positiveEvents: ReputationEvent['eventType'][] = ['task_completed', 'settlement_confirmed', 'verification_passed'];
  if (positiveEvents.includes(event.eventType) && !event.settlementTxHash) {
    return { valid: false, reason: 'Positive reputation events require a confirmed settlement transaction hash' };
  }

  return { valid: true, reason: 'Event is valid' };
}
