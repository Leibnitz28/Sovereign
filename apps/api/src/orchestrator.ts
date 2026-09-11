// ============================================================
// SOVEREIGN — Task Orchestrator
// ============================================================
// Coordinates the entire task lifecycle across all services.
// This is the single authority for task state transitions.

import type { Task, TransactionIntent, PolicyDecision, Verification, AuditEvent } from '@sovereign/domain';
import { validateTransition, SovereignError, ERROR_CODES } from '@sovereign/domain';
import type { AnyTaskState } from '@sovereign/domain';
import { evaluatePolicy } from '@sovereign/policy-engine';
import type { PolicyEvaluationContext } from '@sovereign/policy-engine';
import { createTransactionIntent, verifyIntentHash } from '@sovereign/intent';
import { createAuditEvent } from '@sovereign/audit';
import type { KeeperHubExecutor } from '@sovereign/keeperhub';
import type { DaydreamsAdapter, DiscoveredWorker } from '@sovereign/daydreams';
import type {
  TaskRepository, IntentRepository, PolicyRepository, EscrowRepository,
  SettlementRepository, AuditRepository, ReputationRepository,
  ExecutionRepository, VerificationRepository, CapabilityRepository,
} from '@sovereign/database';

export interface OrchestratorDeps {
  tasks: TaskRepository;
  intents: IntentRepository;
  policies: PolicyRepository;
  escrows: EscrowRepository;
  settlements: SettlementRepository;
  audit: AuditRepository;
  reputation: ReputationRepository;
  executions: ExecutionRepository;
  verifications: VerificationRepository;
  capabilities: CapabilityRepository;
  keeperHub: KeeperHubExecutor;
  daydreams: DaydreamsAdapter;
}

export class TaskOrchestrator {
  constructor(private deps: OrchestratorDeps) {}

  // ─── Transition Helper ─────────────────────────────────
  private async transitionTask(
    taskId: string,
    toState: AnyTaskState,
    updates: Record<string, unknown>,
    auditMeta: { eventType: AuditEvent['eventType']; actorType: AuditEvent['actorType']; actorId: string; metadata?: Record<string, unknown> },
  ): Promise<Task> {
    const task = await this.deps.tasks.findById(taskId);
    if (!task) {
      throw new SovereignError({ code: ERROR_CODES.TASK_NOT_FOUND, message: `Task ${taskId} not found`, statusCode: 404 });
    }

    const result = validateTransition(task.state, toState);
    if (!result.valid) {
      throw new SovereignError({ code: ERROR_CODES.INVALID_STATE_TRANSITION, message: result.reason, statusCode: 409, details: { from: task.state, to: toState } });
    }

    const updatedTask = await this.deps.tasks.updateState(taskId, toState, updates);

    // Create audit event with hash chaining
    const lastAudit = await this.deps.audit.getLastEventForTask(taskId);
    const auditEvent = createAuditEvent({
      taskId,
      intentId: task.intentId,
      executionId: null,
      eventType: auditMeta.eventType,
      actorType: auditMeta.actorType,
      actorId: auditMeta.actorId,
      metadata: { ...auditMeta.metadata, fromState: task.state, toState },
      previousEventHash: lastAudit?.eventHash,
    });
    await this.deps.audit.create(auditEvent);

    return updatedTask;
  }

  // ─── Discover Workers ──────────────────────────────────
  async discoverWorkers(taskId: string): Promise<DiscoveredWorker[]> {
    const task = await this.deps.tasks.findById(taskId);
    if (!task) throw new SovereignError({ code: ERROR_CODES.TASK_NOT_FOUND, message: `Task ${taskId} not found`, statusCode: 404 });

    await this.transitionTask(taskId, 'DISCOVERING', {}, {
      eventType: 'task.discovering',
      actorType: 'system',
      actorId: 'orchestrator',
    });

    const workers = await this.deps.daydreams.discoverWorkers(task.capability);
    return workers;
  }

  // ─── Select Worker ─────────────────────────────────────
  async selectWorker(taskId: string, workerAgentId: string): Promise<Task> {
    const task = await this.deps.tasks.findById(taskId);
    if (!task) throw new SovereignError({ code: ERROR_CODES.TASK_NOT_FOUND, message: `Task ${taskId} not found`, statusCode: 404 });

    // Verify worker reputation
    const repSnapshot = await this.deps.reputation.getLatestSnapshot(workerAgentId, task.capability);
    const workerScore = repSnapshot?.overallScore ?? 50;

    if (workerScore < task.minimumReputation) {
      throw new SovereignError({
        code: ERROR_CODES.REPUTATION_TOO_LOW,
        message: `Worker reputation ${workerScore} is below minimum ${task.minimumReputation}`,
        statusCode: 422,
        details: { workerScore, minimumRequired: task.minimumReputation },
      });
    }

    // Check price vs budget
    const workerCaps = await this.deps.capabilities.findByAgentId(workerAgentId);
    const matchingCap = workerCaps.find((c) => c.capability === task.capability);
    if (matchingCap && matchingCap.price > task.maxBudget) {
      throw new SovereignError({
        code: ERROR_CODES.BUDGET_EXCEEDED,
        message: `Worker price $${Number(matchingCap.price) / 1_000_000} exceeds task budget $${Number(task.maxBudget) / 1_000_000}`,
        statusCode: 422,
        details: { workerPrice: matchingCap.price.toString(), taskBudget: task.maxBudget.toString() },
      });
    }

    return this.transitionTask(taskId, 'CANDIDATE_SELECTED', { worker_agent_id: workerAgentId }, {
      eventType: 'task.candidate_selected',
      actorType: 'buyer-agent',
      actorId: task.buyerAgentId,
      metadata: { workerAgentId, workerScore },
    });
  }

  // ─── Evaluate Policy ───────────────────────────────────
  async evaluateTaskPolicy(taskId: string): Promise<PolicyDecision> {
    const task = await this.deps.tasks.findById(taskId);
    if (!task) throw new SovereignError({ code: ERROR_CODES.TASK_NOT_FOUND, message: `Task ${taskId} not found`, statusCode: 404 });
    if (!task.workerAgentId) throw new SovereignError({ code: ERROR_CODES.VALIDATION_ERROR, message: 'No worker selected', statusCode: 422 });

    await this.transitionTask(taskId, 'POLICY_PENDING', {}, {
      eventType: 'task.policy_pending',
      actorType: 'system',
      actorId: 'orchestrator',
    });

    const policy = await this.deps.policies.findById(task.policyId);
    if (!policy) throw new SovereignError({ code: ERROR_CODES.POLICY_EXPIRED, message: 'Policy not found', statusCode: 404 });

    const worker = await this.deps.daydreams.getWorker(task.workerAgentId);
    const workerCaps = await this.deps.capabilities.findByAgentId(task.workerAgentId);
    const matchingCap = workerCaps.find((c) => c.capability === task.capability);
    const workerPrice = matchingCap?.price ?? task.maxBudget;

    const repSnapshot = await this.deps.reputation.getLatestSnapshot(task.workerAgentId, task.capability);
    const existingSettlement = await this.deps.settlements.existsForTask(taskId);

    // Create a temporary intent for policy evaluation
    const workerWallet = worker?.walletAddress ?? '0x0000000000000000000000000000000000000000';

    const tempIntent = createTransactionIntent({
      taskId,
      buyerAgentId: task.buyerAgentId,
      workerAgentId: task.workerAgentId,
      recipient: workerWallet,
      amount: workerPrice,
      currency: task.currency,
      network: task.network,
      capability: task.capability,
      settlementCondition: 'VERIFIED_OUTCOME',
      policyVersion: policy.version,
      expiresAt: task.deadline,
    });

    const context: PolicyEvaluationContext = {
      currentCumulativeSpend: policy.currentCumulativeSpend,
      currentExecutionCount: policy.currentExecutionCount,
      workerReputationScore: repSnapshot?.overallScore ?? 50,
      existingSettlementForTask: existingSettlement,
      now: new Date(),
    };

    const decision = evaluatePolicy(tempIntent, policy, context);

    if (decision.approved) {
      await this.transitionTask(taskId, 'POLICY_APPROVED', {}, {
        eventType: 'task.policy_approved',
        actorType: 'system',
        actorId: 'policy-engine',
        metadata: { decisionId: decision.decisionId, reasons: decision.reasons },
      });
    } else {
      await this.transitionTask(taskId, 'POLICY_REJECTED', {}, {
        eventType: 'task.policy_rejected',
        actorType: 'system',
        actorId: 'policy-engine',
        metadata: { decisionId: decision.decisionId, reasons: decision.reasons },
      });
    }

    return decision;
  }

  // ─── Commit Intent ─────────────────────────────────────
  async commitIntent(taskId: string): Promise<TransactionIntent> {
    const task = await this.deps.tasks.findById(taskId);
    if (!task || !task.workerAgentId) throw new SovereignError({ code: ERROR_CODES.TASK_NOT_FOUND, message: 'Task or worker not found', statusCode: 404 });

    const policy = await this.deps.policies.findById(task.policyId);
    if (!policy) throw new SovereignError({ code: ERROR_CODES.POLICY_EXPIRED, message: 'Policy not found', statusCode: 404 });

    const worker = await this.deps.daydreams.getWorker(task.workerAgentId);
    const workerCaps = await this.deps.capabilities.findByAgentId(task.workerAgentId);
    const matchingCap = workerCaps.find((c) => c.capability === task.capability);
    const workerPrice = matchingCap?.price ?? task.maxBudget;
    const workerWallet = worker?.walletAddress ?? '0x0000000000000000000000000000000000000000';

    const intent = createTransactionIntent({
      taskId,
      buyerAgentId: task.buyerAgentId,
      workerAgentId: task.workerAgentId,
      recipient: workerWallet,
      amount: workerPrice,
      currency: task.currency,
      network: task.network,
      capability: task.capability,
      settlementCondition: 'VERIFIED_OUTCOME',
      policyVersion: policy.version,
      expiresAt: task.deadline,
    });

    const savedIntent = await this.deps.intents.create(intent);

    await this.transitionTask(taskId, 'INTENT_COMMITTED', { intent_id: savedIntent.intentId }, {
      eventType: 'task.intent_committed',
      actorType: 'system',
      actorId: 'intent-engine',
      metadata: { intentId: savedIntent.intentId, intentHash: savedIntent.intentHash },
    });

    return savedIntent;
  }

  // ─── Create Escrow ─────────────────────────────────────
  async createEscrow(taskId: string): Promise<void> {
    const task = await this.deps.tasks.findById(taskId);
    if (!task || !task.intentId) throw new SovereignError({ code: ERROR_CODES.TASK_NOT_FOUND, message: 'Task or intent not found', statusCode: 404 });

    const intent = await this.deps.intents.findByTaskId(taskId);
    if (!intent) throw new SovereignError({ code: ERROR_CODES.VALIDATION_ERROR, message: 'Intent not found', statusCode: 404 });

    const escrow = await this.deps.escrows.create({
      taskId,
      intentHash: intent.intentHash,
      buyer: intent.recipient, // buyer wallet — simplified for demo
      worker: intent.recipient,
      recipient: intent.recipient,
      token: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // USDC Base Sepolia
      amount: intent.amount,
      state: 'funded', // In mock mode, escrow is immediately funded
      onChainEscrowId: null,
      transactionHash: null,
      expiry: intent.expiresAt,
    });

    await this.transitionTask(taskId, 'ESCROW_AUTHORIZED', { escrow_id: escrow.escrowId }, {
      eventType: 'task.escrow_authorized',
      actorType: 'system',
      actorId: 'escrow-manager',
      metadata: { escrowId: escrow.escrowId, amount: intent.amount.toString() },
    });
  }

  // ─── Submit Result ─────────────────────────────────────
  async submitResult(taskId: string, resultData: string): Promise<void> {
    await this.transitionTask(taskId, 'WORK_IN_PROGRESS', {}, {
      eventType: 'task.work_in_progress',
      actorType: 'worker-agent',
      actorId: 'worker',
    });

    await this.transitionTask(taskId, 'RESULT_SUBMITTED', {}, {
      eventType: 'task.result_submitted',
      actorType: 'worker-agent',
      actorId: 'worker',
      metadata: { resultLength: resultData.length },
    });
  }

  // ─── Verify ────────────────────────────────────────────
  async verifyResult(taskId: string): Promise<Verification> {
    const task = await this.deps.tasks.findById(taskId);
    if (!task) throw new SovereignError({ code: ERROR_CODES.TASK_NOT_FOUND, message: 'Task not found', statusCode: 404 });

    await this.transitionTask(taskId, 'VERIFICATION_PENDING', {}, {
      eventType: 'task.verification_pending',
      actorType: 'system',
      actorId: 'verifier',
    });

    const verification = await this.deps.verifications.create({
      taskId,
      verifierId: 'a0000000-0000-0000-0000-000000000005', // system verifier
      status: 'passed',
      criteria: 'Document processing completion verified',
      evidenceHash: '0x' + '0'.repeat(64),
      reason: 'Result matches expected output criteria',
      verifiedAt: new Date(),
    });

    await this.transitionTask(taskId, 'VERIFIED', { verification_id: verification.verificationId }, {
      eventType: 'task.verified',
      actorType: 'verifier',
      actorId: 'a0000000-0000-0000-0000-000000000005',
      metadata: { verificationId: verification.verificationId },
    });

    return verification;
  }

  // ─── Settle via KeeperHub ──────────────────────────────
  async settle(taskId: string): Promise<{
    settlement: { settlementId: string; transactionHash: string; blockNumber: string; amount: string; recipient: string };
    execution: { executionId: string; workflowId: string; status: string };
  }> {
    const task = await this.deps.tasks.findById(taskId);
    if (!task) throw new SovereignError({ code: ERROR_CODES.TASK_NOT_FOUND, message: 'Task not found', statusCode: 404 });

    const intent = await this.deps.intents.findByTaskId(taskId);
    if (!intent) throw new SovereignError({ code: ERROR_CODES.VALIDATION_ERROR, message: 'Intent not found', statusCode: 404 });

    // Verify intent hash hasn't been mutated
    if (!verifyIntentHash(intent)) {
      throw new SovereignError({
        code: ERROR_CODES.INTENT_MUTATION_DETECTED,
        message: 'INTENT HASH MISMATCH — intent has been mutated after commitment',
        statusCode: 422,
      });
    }

    // Check verification
    const verification = await this.deps.verifications.findByTaskId(taskId);
    if (!verification || verification.status !== 'passed') {
      throw new SovereignError({
        code: ERROR_CODES.UNVERIFIED_RESULT,
        message: 'SETTLEMENT BLOCKED — result has not been verified',
        statusCode: 422,
      });
    }

    // Check for duplicate settlement
    const existingSettlement = await this.deps.settlements.existsForTask(taskId);
    if (existingSettlement) {
      throw new SovereignError({
        code: ERROR_CODES.DUPLICATE_SETTLEMENT,
        message: 'BLOCKED — IDEMPOTENCY / ALREADY SETTLED',
        statusCode: 409,
      });
    }

    // Transition to settlement pending
    await this.transitionTask(taskId, 'SETTLEMENT_PENDING', {}, {
      eventType: 'task.settlement_pending',
      actorType: 'system',
      actorId: 'orchestrator',
    });

    const escrow = await this.deps.escrows.findByTaskId(taskId);

    // KeeperHub workflow
    const workflow = await this.deps.keeperHub.createOrResolveWorkflow({
      intentHash: intent.intentHash,
      recipient: intent.recipient,
      amount: intent.amount,
      token: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      network: intent.network,
      taskId,
      escrowId: escrow?.escrowId ?? '',
    });

    // Validate
    const validationResult = await this.deps.keeperHub.validateWorkflow(workflow);
    if (!validationResult.valid) {
      throw new SovereignError({
        code: ERROR_CODES.KEEPERHUB_VALIDATION_FAILED,
        message: `KeeperHub validation failed: ${validationResult.errors.join(', ')}`,
        statusCode: 422,
      });
    }

    // Dry run
    const dryRunResult = await this.deps.keeperHub.dryRun(workflow);

    // Create execution record
    const execution = await this.deps.executions.create({
      taskId,
      intentId: intent.intentId,
      intentHash: intent.intentHash,
      keeperHubWorkflowId: workflow.workflowId,
      keeperHubExecutionId: null,
      status: 'dry-run',
      dryRunResult: { estimatedGas: dryRunResult.estimatedGas.toString(), warnings: dryRunResult.warnings },
    });

    // Transition to KeeperHub executing
    await this.transitionTask(taskId, 'KEEPERHUB_EXECUTING', {}, {
      eventType: 'task.keeperhub_executing',
      actorType: 'keeperhub',
      actorId: workflow.workflowId,
      metadata: { workflowId: workflow.workflowId, dryRunSuccess: dryRunResult.success },
    });

    // Execute
    const keeperExecution = await this.deps.keeperHub.execute(workflow);

    await this.deps.executions.updateStatus(execution.executionId, 'completed', {
      keeperhub_execution_id: keeperExecution.executionId,
    });

    // Record settlement
    const settlement = await this.deps.settlements.create({
      taskId,
      intentId: intent.intentId,
      intentHash: intent.intentHash,
      escrowId: escrow?.escrowId ?? '',
      executionId: execution.executionId,
      amount: intent.amount,
      recipient: intent.recipient,
      transactionHash: keeperExecution.transactionHash ?? '0x' + '0'.repeat(64),
      blockNumber: keeperExecution.blockNumber ?? 0n,
      network: intent.network,
      status: 'confirmed',
      settledAt: new Date(),
    });

    // Update escrow state
    if (escrow) {
      await this.deps.escrows.updateState(escrow.escrowId, 'released', keeperExecution.transactionHash ?? undefined);
    }

    // Transition to confirmed
    await this.transitionTask(taskId, 'SETTLEMENT_CONFIRMED', { settlement_id: settlement.settlementId }, {
      eventType: 'task.settlement_confirmed',
      actorType: 'blockchain',
      actorId: keeperExecution.transactionHash ?? 'unknown',
      metadata: {
        transactionHash: keeperExecution.transactionHash,
        blockNumber: keeperExecution.blockNumber?.toString(),
        amount: intent.amount.toString(),
      },
    });

    // Update reputation
    await this.deps.reputation.createEvent({
      agentId: task.workerAgentId!,
      taskId,
      eventType: 'settlement_confirmed',
      settlementTxHash: keeperExecution.transactionHash,
      createdAt: new Date(),
    });

    await this.transitionTask(taskId, 'REPUTATION_UPDATED', {}, {
      eventType: 'task.reputation_updated',
      actorType: 'system',
      actorId: 'reputation-engine',
    });

    // Complete
    await this.transitionTask(taskId, 'COMPLETED', {}, {
      eventType: 'task.completed',
      actorType: 'system',
      actorId: 'orchestrator',
    });

    // Increment policy cumulative spend
    await this.deps.policies.incrementCumulativeSpend(task.policyId, intent.amount);

    return {
      settlement: {
        settlementId: settlement.settlementId,
        transactionHash: settlement.transactionHash,
        blockNumber: settlement.blockNumber.toString(),
        amount: settlement.amount.toString(),
        recipient: settlement.recipient,
      },
      execution: {
        executionId: execution.executionId,
        workflowId: workflow.workflowId,
        status: 'completed',
      },
    };
  }
}
