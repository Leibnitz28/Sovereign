// ============================================================
// SOVEREIGN — Error Types
// ============================================================
// Structured error codes matching the API error contract.

export const ERROR_CODES = {
  // Policy errors
  POLICY_VIOLATION: 'POLICY_VIOLATION',
  POLICY_EXPIRED: 'POLICY_EXPIRED',
  BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
  BUDGET_CIRCUMVENTION: 'BUDGET_CIRCUMVENTION',
  RECIPIENT_MISMATCH: 'RECIPIENT_MISMATCH',
  UNAUTHORIZED_NETWORK: 'UNAUTHORIZED_NETWORK',
  UNAUTHORIZED_CAPABILITY: 'UNAUTHORIZED_CAPABILITY',
  EXECUTION_LIMIT_EXCEEDED: 'EXECUTION_LIMIT_EXCEEDED',

  // Intent errors
  INTENT_MISMATCH: 'INTENT_MISMATCH',
  INTENT_EXPIRED: 'INTENT_EXPIRED',
  INTENT_MUTATION_DETECTED: 'INTENT_MUTATION_DETECTED',

  // Reputation errors
  REPUTATION_TOO_LOW: 'REPUTATION_TOO_LOW',
  REPUTATION_FRAUD_DETECTED: 'REPUTATION_FRAUD_DETECTED',

  // Settlement errors
  DUPLICATE_SETTLEMENT: 'DUPLICATE_SETTLEMENT',
  SETTLEMENT_ALREADY_EXISTS: 'SETTLEMENT_ALREADY_EXISTS',
  SETTLEMENT_BLOCKED: 'SETTLEMENT_BLOCKED',
  UNVERIFIED_RESULT: 'UNVERIFIED_RESULT',

  // State errors
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',

  // Escrow errors
  ESCROW_NOT_FOUND: 'ESCROW_NOT_FOUND',
  ESCROW_INVALID_STATE: 'ESCROW_INVALID_STATE',
  ESCROW_EXPIRED: 'ESCROW_EXPIRED',

  // KeeperHub errors
  KEEPERHUB_UNAVAILABLE: 'KEEPERHUB_UNAVAILABLE',
  KEEPERHUB_EXECUTION_FAILED: 'KEEPERHUB_EXECUTION_FAILED',
  KEEPERHUB_VALIDATION_FAILED: 'KEEPERHUB_VALIDATION_FAILED',

  // Blockchain errors
  BLOCKCHAIN_ERROR: 'BLOCKCHAIN_ERROR',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  TRANSACTION_REVERTED: 'TRANSACTION_REVERTED',

  // Verification errors
  VERIFICATION_FAILED: 'VERIFICATION_FAILED',
  VERIFICATION_PENDING: 'VERIFICATION_PENDING',

  // General errors
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Retry classification for external call failures */
export type RetryClassification =
  | 'TRANSIENT'
  | 'PERMANENT'
  | 'AUTHENTICATION'
  | 'RATE_LIMIT'
  | 'CONFLICT'
  | 'BLOCKCHAIN'
  | 'POLICY'
  | 'VALIDATION';

/** Structured API error response */
export interface ApiError {
  readonly error: {
    readonly code: ErrorCode;
    readonly message: string;
    readonly requestId: string;
    readonly retryable: boolean;
    readonly details: Record<string, unknown>;
  };
}

/** Application error class with structured error info */
export class SovereignError extends Error {
  public readonly code: ErrorCode;
  public readonly retryable: boolean;
  public readonly statusCode: number;
  public readonly details: Record<string, unknown>;

  constructor(params: {
    code: ErrorCode;
    message: string;
    retryable?: boolean;
    statusCode?: number;
    details?: Record<string, unknown>;
  }) {
    super(params.message);
    this.name = 'SovereignError';
    this.code = params.code;
    this.retryable = params.retryable ?? false;
    this.statusCode = params.statusCode ?? 500;
    this.details = params.details ?? {};
  }

  toApiError(requestId: string): ApiError {
    return {
      error: {
        code: this.code,
        message: this.message,
        requestId,
        retryable: this.retryable,
        details: this.details,
      },
    };
  }
}

/**
 * Classifies an error for retry logic.
 */
export function classifyError(error: unknown): RetryClassification {
  if (error instanceof SovereignError) {
    switch (error.code) {
      case 'RATE_LIMITED':
        return 'RATE_LIMIT';
      case 'KEEPERHUB_UNAVAILABLE':
      case 'SERVICE_UNAVAILABLE':
        return 'TRANSIENT';
      case 'BLOCKCHAIN_ERROR':
      case 'TRANSACTION_FAILED':
        return 'BLOCKCHAIN';
      case 'UNAUTHORIZED':
        return 'AUTHENTICATION';
      case 'CONFLICT':
      case 'IDEMPOTENCY_CONFLICT':
      case 'DUPLICATE_SETTLEMENT':
        return 'CONFLICT';
      case 'POLICY_VIOLATION':
      case 'POLICY_EXPIRED':
      case 'BUDGET_EXCEEDED':
      case 'BUDGET_CIRCUMVENTION':
        return 'POLICY';
      case 'VALIDATION_ERROR':
        return 'VALIDATION';
      default:
        return 'PERMANENT';
    }
  }

  // Network errors are transient
  if (error instanceof Error) {
    if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT') || error.message.includes('fetch failed')) {
      return 'TRANSIENT';
    }
  }

  return 'PERMANENT';
}
