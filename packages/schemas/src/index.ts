// ============================================================
// SOVEREIGN — Zod Schemas
// ============================================================
// All API input/output validation schemas.

import { z } from 'zod';

// ─── Common ────────────────────────────────────────────────
export const EthAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');
export const UuidSchema = z.string().uuid();
export const BigIntStringSchema = z.string().regex(/^\d+$/, 'Must be a non-negative integer string');
export const HashSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid 256-bit hash');
export const NonEmptyString = z.string().min(1).max(1000);

// ─── Agent ─────────────────────────────────────────────────
export const CreateAgentSchema = z.object({
  walletAddress: EthAddressSchema,
  displayName: z.string().min(1).max(100),
  capabilities: z.array(z.object({
    capability: z.string().min(1).max(100),
    description: z.string().min(1).max(500),
    price: BigIntStringSchema,
    currency: z.literal('USDC'),
  })).min(1),
  identitySource: z.enum(['self-declared', 'erc-8004', 'verified-external', 'daydreams']).default('self-declared'),
});

export type CreateAgentInput = z.infer<typeof CreateAgentSchema>;

// ─── Task ──────────────────────────────────────────────────
export const CreateTaskSchema = z.object({
  buyerAgentId: UuidSchema,
  capability: z.string().min(1).max(100),
  description: z.string().min(1).max(2000),
  maxBudget: BigIntStringSchema,
  currency: z.literal('USDC'),
  network: z.enum(['base-sepolia']),
  minimumReputation: z.number().int().min(0).max(100),
  deadline: z.string().datetime(),
  policyId: UuidSchema,
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

// ─── Policy ────────────────────────────────────────────────
export const CreatePolicySchema = z.object({
  agentId: UuidSchema,
  maxSinglePayment: BigIntStringSchema,
  maxCumulativeSpend: BigIntStringSchema,
  allowedRecipients: z.array(EthAddressSchema),
  allowedNetworks: z.array(z.enum(['base-sepolia'])),
  minimumReputationScore: z.number().int().min(0).max(100),
  requiredCapabilities: z.array(z.string().min(1).max(100)),
  maxExecutionCount: z.number().int().min(1).max(10000),
  requireOutcomeVerification: z.boolean(),
  expiresAt: z.string().datetime(),
});

export type CreatePolicyInput = z.infer<typeof CreatePolicySchema>;

// ─── Worker Selection ──────────────────────────────────────
export const SelectWorkerSchema = z.object({
  workerAgentId: UuidSchema,
});

export type SelectWorkerInput = z.infer<typeof SelectWorkerSchema>;

// ─── Result Submission ─────────────────────────────────────
export const SubmitResultSchema = z.object({
  resultData: z.string().min(1).max(10000),
  evidenceHash: HashSchema.optional(),
});

export type SubmitResultInput = z.infer<typeof SubmitResultSchema>;

// ─── API Error Response ────────────────────────────────────
export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
    retryable: z.boolean(),
    details: z.record(z.unknown()),
  }),
});

// ─── Pagination ────────────────────────────────────────────
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationInput = z.infer<typeof PaginationSchema>;

// ─── Attack Simulation ─────────────────────────────────────
export const AttackScenarioSchema = z.enum([
  'over-budget',
  'split-payment-bypass',
  'recipient-substitution',
  'intent-mutation',
  'unverified-result',
  'replay-attack',
  'expired-intent',
  'low-reputation',
]);

export type AttackScenario = z.infer<typeof AttackScenarioSchema>;
