// ============================================================
// SOVEREIGN — Policy Engine
// ============================================================
// Deterministic, side-effect free, independently testable.
// Evaluates TransactionIntent against ExecutionPolicy.

import type { TransactionIntent, ExecutionPolicy, PolicyDecision } from '@sovereign/domain';
import { randomUUID } from 'node:crypto';

export interface PolicyEvaluationContext {
  readonly currentCumulativeSpend: bigint;
  readonly currentExecutionCount: number;
  readonly workerReputationScore: number;
  readonly existingSettlementForTask: boolean;
  readonly now: Date;
}

interface PolicyRule {
  readonly name: string;
  evaluate(intent: TransactionIntent, policy: ExecutionPolicy, ctx: PolicyEvaluationContext): string | null;
}

// ─── Individual Policy Rules ───────────────────────────────

const maxSinglePaymentRule: PolicyRule = {
  name: 'max-single-payment',
  evaluate(intent, policy) {
    if (intent.amount > policy.maxSinglePayment) {
      return `BLOCKED — Payment $${Number(intent.amount) / 1_000_000} exceeds maximum single payment $${Number(policy.maxSinglePayment) / 1_000_000}`;
    }
    return null;
  },
};

const cumulativeSpendRule: PolicyRule = {
  name: 'cumulative-spend',
  evaluate(intent, policy, ctx) {
    const newTotal = ctx.currentCumulativeSpend + intent.amount;
    if (newTotal > policy.maxCumulativeSpend) {
      return `BLOCKED — BUDGET CIRCUMVENTION BLOCKED: Cumulative spend $${Number(newTotal) / 1_000_000} would exceed maximum $${Number(policy.maxCumulativeSpend) / 1_000_000}`;
    }
    return null;
  },
};

const recipientRule: PolicyRule = {
  name: 'recipient-check',
  evaluate(intent, policy) {
    if (policy.allowedRecipients.length > 0 && !policy.allowedRecipients.includes(intent.recipient)) {
      return `BLOCKED — RECIPIENT MISMATCH: ${intent.recipient} is not in the approved recipient list`;
    }
    return null;
  },
};

const networkRule: PolicyRule = {
  name: 'network-check',
  evaluate(intent, policy) {
    if (!policy.allowedNetworks.includes(intent.network)) {
      return `BLOCKED — Network ${intent.network} is not authorized. Allowed: [${policy.allowedNetworks.join(', ')}]`;
    }
    return null;
  },
};

const capabilityRule: PolicyRule = {
  name: 'capability-check',
  evaluate(intent, policy) {
    if (policy.requiredCapabilities.length > 0 && !policy.requiredCapabilities.includes(intent.capability)) {
      return `BLOCKED — Capability "${intent.capability}" is not authorized. Required: [${policy.requiredCapabilities.join(', ')}]`;
    }
    return null;
  },
};

const reputationRule: PolicyRule = {
  name: 'reputation-check',
  evaluate(_intent, policy, ctx) {
    if (ctx.workerReputationScore < policy.minimumReputationScore) {
      return `BLOCKED — Worker reputation ${ctx.workerReputationScore} is below minimum ${policy.minimumReputationScore}`;
    }
    return null;
  },
};

const executionCountRule: PolicyRule = {
  name: 'execution-count',
  evaluate(_intent, policy, ctx) {
    if (ctx.currentExecutionCount >= policy.maxExecutionCount) {
      return `BLOCKED — Execution count ${ctx.currentExecutionCount} exceeds maximum ${policy.maxExecutionCount}`;
    }
    return null;
  },
};

const policyExpiryRule: PolicyRule = {
  name: 'policy-expiry',
  evaluate(_intent, policy, ctx) {
    if (ctx.now > policy.expiresAt) {
      return `BLOCKED — Policy expired at ${policy.expiresAt.toISOString()}`;
    }
    return null;
  },
};

const intentExpiryRule: PolicyRule = {
  name: 'intent-expiry',
  evaluate(intent, _policy, ctx) {
    if (ctx.now > intent.expiresAt) {
      return `BLOCKED — Intent expired at ${intent.expiresAt.toISOString()}`;
    }
    return null;
  },
};

const duplicateSettlementRule: PolicyRule = {
  name: 'duplicate-settlement',
  evaluate(_intent, _policy, ctx) {
    if (ctx.existingSettlementForTask) {
      return `BLOCKED — IDEMPOTENCY / ALREADY SETTLED: A settlement already exists for this task`;
    }
    return null;
  },
};

const policyVersionRule: PolicyRule = {
  name: 'policy-version',
  evaluate(intent, policy) {
    if (intent.policyVersion !== policy.version) {
      return `BLOCKED — Policy version mismatch: intent uses v${intent.policyVersion}, current is v${policy.version}`;
    }
    return null;
  },
};

/** All policy rules evaluated in order */
const ALL_RULES: readonly PolicyRule[] = [
  duplicateSettlementRule,
  policyExpiryRule,
  intentExpiryRule,
  policyVersionRule,
  maxSinglePaymentRule,
  cumulativeSpendRule,
  recipientRule,
  networkRule,
  capabilityRule,
  reputationRule,
  executionCountRule,
];

/**
 * Evaluate a transaction intent against a policy.
 * This function is DETERMINISTIC and SIDE-EFFECT FREE.
 * Given the same inputs, it always produces the same output.
 */
export function evaluatePolicy(
  intent: TransactionIntent,
  policy: ExecutionPolicy,
  context: PolicyEvaluationContext,
): PolicyDecision {
  const violations: string[] = [];

  for (const rule of ALL_RULES) {
    const violation = rule.evaluate(intent, policy, context);
    if (violation !== null) {
      violations.push(violation);
    }
  }

  const approved = violations.length === 0;
  const reasons = approved ? ['All policy checks passed'] : violations;

  return {
    decisionId: randomUUID(),
    intentId: intent.intentId,
    policyId: policy.policyId,
    policyVersion: policy.version,
    approved,
    reasons,
    intentHash: intent.intentHash,
    evaluatedAt: context.now,
  };
}

/**
 * Quick check if a proposed amount would pass policy.
 * Used by the UI to show pre-flight validation.
 */
export function wouldAmountPass(
  amount: bigint,
  policy: ExecutionPolicy,
  currentCumulativeSpend: bigint,
): { pass: boolean; reason: string } {
  if (amount > policy.maxSinglePayment) {
    return {
      pass: false,
      reason: `Payment $${Number(amount) / 1_000_000} exceeds maximum $${Number(policy.maxSinglePayment) / 1_000_000}`,
    };
  }

  if (currentCumulativeSpend + amount > policy.maxCumulativeSpend) {
    return {
      pass: false,
      reason: `Cumulative spend would reach $${Number(currentCumulativeSpend + amount) / 1_000_000}, exceeding limit $${Number(policy.maxCumulativeSpend) / 1_000_000}`,
    };
  }

  return { pass: true, reason: 'Amount within policy bounds' };
}
