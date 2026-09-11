// ============================================================
// SOVEREIGN — Task State Machine
// ============================================================
// Explicit finite state machine with guarded transitions.
// Every transition must be persisted and create an audit event.

/** All valid task states */
export const TASK_STATES = [
  'CREATED',
  'DISCOVERING',
  'CANDIDATE_SELECTED',
  'POLICY_PENDING',
  'POLICY_APPROVED',
  'INTENT_COMMITTED',
  'ESCROW_AUTHORIZED',
  'WORK_IN_PROGRESS',
  'RESULT_SUBMITTED',
  'VERIFICATION_PENDING',
  'VERIFIED',
  'SETTLEMENT_PENDING',
  'KEEPERHUB_EXECUTING',
  'SETTLEMENT_CONFIRMED',
  'REPUTATION_UPDATED',
  'COMPLETED',
] as const;

export const TASK_FAILURE_STATES = [
  'POLICY_REJECTED',
  'EXPIRED',
  'VERIFICATION_FAILED',
  'KEEPERHUB_FAILED',
  'BLOCKCHAIN_FAILED',
  'CANCELLED',
  'DISPUTED',
  'RECOVERY_REQUIRED',
] as const;

export type TaskState = (typeof TASK_STATES)[number];
export type TaskFailureState = (typeof TASK_FAILURE_STATES)[number];
export type AnyTaskState = TaskState | TaskFailureState;

/** Valid state transitions. Key = from state, Value = set of valid target states */
export const VALID_TRANSITIONS: ReadonlyMap<AnyTaskState, ReadonlySet<AnyTaskState>> = new Map([
  // Happy path
  ['CREATED', new Set<AnyTaskState>(['DISCOVERING', 'CANCELLED'])],
  ['DISCOVERING', new Set<AnyTaskState>(['CANDIDATE_SELECTED', 'EXPIRED', 'CANCELLED'])],
  ['CANDIDATE_SELECTED', new Set<AnyTaskState>(['POLICY_PENDING', 'CANCELLED'])],
  ['POLICY_PENDING', new Set<AnyTaskState>(['POLICY_APPROVED', 'POLICY_REJECTED'])],
  ['POLICY_APPROVED', new Set<AnyTaskState>(['INTENT_COMMITTED', 'EXPIRED', 'CANCELLED'])],
  ['INTENT_COMMITTED', new Set<AnyTaskState>(['ESCROW_AUTHORIZED', 'EXPIRED', 'CANCELLED'])],
  ['ESCROW_AUTHORIZED', new Set<AnyTaskState>(['WORK_IN_PROGRESS', 'EXPIRED', 'CANCELLED'])],
  ['WORK_IN_PROGRESS', new Set<AnyTaskState>(['RESULT_SUBMITTED', 'EXPIRED', 'CANCELLED'])],
  ['RESULT_SUBMITTED', new Set<AnyTaskState>(['VERIFICATION_PENDING', 'CANCELLED'])],
  ['VERIFICATION_PENDING', new Set<AnyTaskState>(['VERIFIED', 'VERIFICATION_FAILED', 'DISPUTED'])],
  ['VERIFIED', new Set<AnyTaskState>(['SETTLEMENT_PENDING'])],
  ['SETTLEMENT_PENDING', new Set<AnyTaskState>(['KEEPERHUB_EXECUTING', 'KEEPERHUB_FAILED'])],
  ['KEEPERHUB_EXECUTING', new Set<AnyTaskState>(['SETTLEMENT_CONFIRMED', 'KEEPERHUB_FAILED', 'BLOCKCHAIN_FAILED'])],
  ['SETTLEMENT_CONFIRMED', new Set<AnyTaskState>(['REPUTATION_UPDATED'])],
  ['REPUTATION_UPDATED', new Set<AnyTaskState>(['COMPLETED'])],

  // Failure recovery paths
  ['KEEPERHUB_FAILED', new Set<AnyTaskState>(['SETTLEMENT_PENDING', 'RECOVERY_REQUIRED', 'CANCELLED'])],
  ['BLOCKCHAIN_FAILED', new Set<AnyTaskState>(['SETTLEMENT_PENDING', 'RECOVERY_REQUIRED', 'CANCELLED'])],
  ['VERIFICATION_FAILED', new Set<AnyTaskState>(['CANCELLED', 'DISPUTED'])],
  ['RECOVERY_REQUIRED', new Set<AnyTaskState>(['SETTLEMENT_PENDING', 'CANCELLED'])],

  // Terminal states — no transitions out
  ['COMPLETED', new Set<AnyTaskState>()],
  ['POLICY_REJECTED', new Set<AnyTaskState>(['CANCELLED'])],
  ['EXPIRED', new Set<AnyTaskState>()],
  ['CANCELLED', new Set<AnyTaskState>()],
  ['DISPUTED', new Set<AnyTaskState>(['CANCELLED', 'RECOVERY_REQUIRED'])],
]);

/** Terminal states where no further transitions are valid (or only to CANCELLED) */
export const TERMINAL_STATES: ReadonlySet<AnyTaskState> = new Set([
  'COMPLETED',
  'EXPIRED',
  'CANCELLED',
]);

/**
 * Validates whether a state transition is allowed.
 * Returns { valid: true } or { valid: false, reason: string }.
 */
export function validateTransition(
  from: AnyTaskState,
  to: AnyTaskState,
): { valid: true } | { valid: false; reason: string } {
  const allowed = VALID_TRANSITIONS.get(from);

  if (!allowed) {
    return { valid: false, reason: `Unknown state: ${from}` };
  }

  if (!allowed.has(to)) {
    return {
      valid: false,
      reason: `Invalid transition: ${from} → ${to}. Allowed: [${[...allowed].join(', ')}]`,
    };
  }

  return { valid: true };
}

/**
 * Returns the display label for a task state.
 */
export function getStateLabel(state: AnyTaskState): string {
  const labels: Record<AnyTaskState, string> = {
    CREATED: 'Task Created',
    DISCOVERING: 'Discovering Workers',
    CANDIDATE_SELECTED: 'Candidate Selected',
    POLICY_PENDING: 'Policy Evaluation Pending',
    POLICY_APPROVED: 'Policy Approved',
    POLICY_REJECTED: 'Policy Rejected',
    INTENT_COMMITTED: 'Intent Committed',
    ESCROW_AUTHORIZED: 'Escrow Authorized',
    WORK_IN_PROGRESS: 'Work In Progress',
    RESULT_SUBMITTED: 'Result Submitted',
    VERIFICATION_PENDING: 'Verification Pending',
    VERIFIED: 'Result Verified',
    VERIFICATION_FAILED: 'Verification Failed',
    SETTLEMENT_PENDING: 'Settlement Pending',
    KEEPERHUB_EXECUTING: 'KeeperHub Executing',
    KEEPERHUB_FAILED: 'KeeperHub Failed',
    BLOCKCHAIN_FAILED: 'Blockchain Failed',
    SETTLEMENT_CONFIRMED: 'Settlement Confirmed',
    REPUTATION_UPDATED: 'Reputation Updated',
    COMPLETED: 'Completed',
    EXPIRED: 'Expired',
    CANCELLED: 'Cancelled',
    DISPUTED: 'Disputed',
    RECOVERY_REQUIRED: 'Recovery Required',
  };
  return labels[state];
}

/**
 * Returns whether a state is a failure state.
 */
export function isFailureState(state: AnyTaskState): state is TaskFailureState {
  return (TASK_FAILURE_STATES as readonly string[]).includes(state);
}

/**
 * Returns whether a state is terminal (no further progression).
 */
export function isTerminalState(state: AnyTaskState): boolean {
  return TERMINAL_STATES.has(state);
}
