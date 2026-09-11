// ============================================================
// SOVEREIGN — Domain Entities
// ============================================================
// Core domain types. All financial values use bigint atomic units.
// No floating-point arithmetic for money.
import type { AnyTaskState } from './state-machine.js';

/** Agent identity and registration */
export interface Agent {
  readonly agentId: string;
  readonly walletAddress: string;
  readonly displayName: string;
  readonly identitySource: IdentitySource;
  readonly status: AgentStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type IdentitySource = 'self-declared' | 'erc-8004' | 'verified-external' | 'daydreams';
export type AgentStatus = 'active' | 'suspended' | 'deactivated';

/** Agent capability declaration */
export interface AgentCapability {
  readonly capabilityId: string;
  readonly agentId: string;
  readonly capability: string;
  readonly description: string;
  readonly price: bigint; // USDC atomic units (6 decimals)
  readonly currency: string;
  readonly createdAt: Date;
}

/** Task — the central workflow entity */
export interface Task {
  readonly taskId: string;
  readonly buyerAgentId: string;
  readonly workerAgentId: string | null;
  readonly capability: string;
  readonly description: string;
  readonly maxBudget: bigint; // USDC atomic units
  readonly currency: string;
  readonly network: string;
  readonly minimumReputation: number;
  readonly deadline: Date;
  readonly state: AnyTaskState;
  readonly policyId: string;
  readonly intentId: string | null;
  readonly escrowId: string | null;
  readonly verificationId: string | null;
  readonly settlementId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Execution Policy defining spending/execution constraints */
export interface ExecutionPolicy {
  readonly policyId: string;
  readonly agentId: string;
  readonly version: number;
  readonly maxSinglePayment: bigint;
  readonly maxCumulativeSpend: bigint;
  readonly currentCumulativeSpend: bigint;
  readonly allowedRecipients: readonly string[];
  readonly allowedNetworks: readonly string[];
  readonly minimumReputationScore: number;
  readonly requiredCapabilities: readonly string[];
  readonly maxExecutionCount: number;
  readonly currentExecutionCount: number;
  readonly requireOutcomeVerification: boolean;
  readonly expiresAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Strongly typed Transaction Intent */
export interface TransactionIntent {
  readonly intentId: string;
  readonly taskId: string;
  readonly buyerAgentId: string;
  readonly workerAgentId: string;
  readonly recipient: string;
  readonly amount: bigint;
  readonly currency: string;
  readonly network: string;
  readonly capability: string;
  readonly settlementCondition: string;
  readonly policyVersion: number;
  readonly expiresAt: Date;
  readonly nonce: string;
  readonly intentHash: string;
  readonly createdAt: Date;
}

/** Policy evaluation decision */
export interface PolicyDecision {
  readonly decisionId: string;
  readonly intentId: string;
  readonly policyId: string;
  readonly policyVersion: number;
  readonly approved: boolean;
  readonly reasons: readonly string[];
  readonly intentHash: string;
  readonly evaluatedAt: Date;
}

/** Escrow record */
export interface Escrow {
  readonly escrowId: string;
  readonly taskId: string;
  readonly intentHash: string;
  readonly buyer: string;
  readonly worker: string;
  readonly recipient: string;
  readonly token: string;
  readonly amount: bigint;
  readonly state: EscrowState;
  readonly onChainEscrowId: bigint | null;
  readonly transactionHash: string | null;
  readonly expiry: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type EscrowState = 'pending' | 'funded' | 'released' | 'refunded' | 'cancelled' | 'expired';

/** Verification record */
export interface Verification {
  readonly verificationId: string;
  readonly taskId: string;
  readonly verifierId: string;
  readonly status: VerificationStatus;
  readonly criteria: string;
  readonly evidenceHash: string;
  readonly reason: string;
  readonly verifiedAt: Date;
}

export type VerificationStatus = 'pending' | 'passed' | 'failed' | 'disputed';

/** Settlement record */
export interface Settlement {
  readonly settlementId: string;
  readonly taskId: string;
  readonly intentId: string;
  readonly intentHash: string;
  readonly escrowId: string;
  readonly executionId: string;
  readonly amount: bigint;
  readonly recipient: string;
  readonly transactionHash: string;
  readonly blockNumber: bigint;
  readonly network: string;
  readonly status: SettlementStatus;
  readonly settledAt: Date;
}

export type SettlementStatus = 'pending' | 'confirmed' | 'failed' | 'reverted';

/** Execution record (KeeperHub) */
export interface Execution {
  readonly executionId: string;
  readonly taskId: string;
  readonly intentId: string;
  readonly intentHash: string;
  readonly keeperHubWorkflowId: string | null;
  readonly keeperHubExecutionId: string | null;
  readonly status: ExecutionStatus;
  readonly dryRunResult: Record<string, unknown> | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type ExecutionStatus =
  | 'pending'
  | 'validating'
  | 'dry-run'
  | 'authorized'
  | 'executing'
  | 'monitoring'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** Execution attempt (retries) */
export interface ExecutionAttempt {
  readonly attemptId: string;
  readonly executionId: string;
  readonly attemptNumber: number;
  readonly status: 'success' | 'failure' | 'timeout';
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly latencyMs: number;
  readonly createdAt: Date;
}

/** Hash-chained audit event */
export interface AuditEvent {
  readonly eventId: string;
  readonly taskId: string;
  readonly intentId: string | null;
  readonly executionId: string | null;
  readonly eventType: AuditEventType;
  readonly actorType: ActorType;
  readonly actorId: string;
  readonly timestamp: Date;
  readonly payloadHash: string;
  readonly previousEventHash: string;
  readonly eventHash: string;
  readonly metadata: Record<string, unknown>;
}

export type ActorType = 'buyer-agent' | 'worker-agent' | 'system' | 'verifier' | 'keeperhub' | 'blockchain';

export type AuditEventType =
  | 'task.created'
  | 'task.discovering'
  | 'task.candidate_selected'
  | 'task.policy_pending'
  | 'task.policy_approved'
  | 'task.policy_rejected'
  | 'task.intent_committed'
  | 'task.escrow_authorized'
  | 'task.work_in_progress'
  | 'task.result_submitted'
  | 'task.verification_pending'
  | 'task.verified'
  | 'task.verification_failed'
  | 'task.settlement_pending'
  | 'task.keeperhub_executing'
  | 'task.settlement_confirmed'
  | 'task.reputation_updated'
  | 'task.completed'
  | 'task.expired'
  | 'task.cancelled'
  | 'task.disputed'
  | 'task.keeperhub_failed'
  | 'task.blockchain_failed'
  | 'task.recovery_required'
  | 'policy.evaluated'
  | 'policy.violation_detected'
  | 'intent.created'
  | 'intent.hashed'
  | 'escrow.created'
  | 'escrow.released'
  | 'escrow.refunded'
  | 'settlement.initiated'
  | 'settlement.confirmed'
  | 'settlement.failed'
  | 'execution.started'
  | 'execution.completed'
  | 'execution.failed'
  | 'reputation.updated'
  | 'security.attack_blocked';

/** Reputation event */
export interface ReputationEvent {
  readonly eventId: string;
  readonly agentId: string;
  readonly taskId: string;
  readonly eventType: 'task_completed' | 'task_failed' | 'verification_passed' | 'verification_failed' | 'dispute_filed' | 'dispute_resolved' | 'settlement_confirmed' | 'settlement_failed';
  readonly settlementTxHash: string | null;
  readonly createdAt: Date;
}

/** Reputation snapshot — stores component scores */
export interface ReputationSnapshot {
  readonly snapshotId: string;
  readonly agentId: string;
  readonly capability: string;
  readonly overallScore: number;
  readonly completionRate: number;
  readonly successfulSettlementRate: number;
  readonly verificationSuccessRate: number;
  readonly disputeRate: number;
  readonly recentActivity: number;
  readonly capabilityReliability: number;
  readonly taskVolume: number;
  readonly calculatedAt: Date;
}

/** Dispute record */
export interface Dispute {
  readonly disputeId: string;
  readonly taskId: string;
  readonly filedBy: string;
  readonly reason: string;
  readonly status: 'open' | 'resolved' | 'dismissed';
  readonly resolution: string | null;
  readonly createdAt: Date;
  readonly resolvedAt: Date | null;
}

/** Risk signal */
export interface RiskSignal {
  readonly signalId: string;
  readonly taskId: string;
  readonly signalType: string;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly description: string;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
}

/** Idempotency key record */
export interface IdempotencyRecord {
  readonly key: string;
  readonly endpoint: string;
  readonly statusCode: number;
  readonly responseBody: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

// ─── Import re-exports for task states ─────────────────────
export type { TaskState, TaskFailureState } from './state-machine.js';
