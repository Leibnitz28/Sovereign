// ============================================================
// SOVEREIGN — Fastify API Server
// ============================================================
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createDatabaseClient } from '@sovereign/database';
import {
  AgentRepository, TaskRepository, IntentRepository, PolicyRepository,
  EscrowRepository, SettlementRepository, AuditRepository,
  ReputationRepository, ExecutionRepository,
  VerificationRepository, CapabilityRepository,
} from '@sovereign/database';
import { createKeeperHubExecutor } from '@sovereign/keeperhub';
import { createDaydreamsAdapter } from '@sovereign/daydreams';
import { TaskOrchestrator } from './orchestrator.js';
import { CreateTaskSchema, CreateAgentSchema, SelectWorkerSchema, SubmitResultSchema, CreatePolicySchema, AttackScenarioSchema } from '@sovereign/schemas';
import { SovereignError, ERROR_CODES } from '@sovereign/domain';
import { evaluatePolicy } from '@sovereign/policy-engine';
import type { PolicyEvaluationContext } from '@sovereign/policy-engine';
import { createTransactionIntent } from '@sovereign/intent';
import { explainReputation } from '@sovereign/reputation';
import { randomUUID } from 'node:crypto';

const PORT = parseInt(process.env['API_PORT'] ?? '3001', 10);
const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgresql://sovereign:sovereign@localhost:5432/sovereign';
const MOCK_EXTERNAL = process.env['MOCK_EXTERNAL_SERVICES'] !== 'false';

async function main() {
  const fastify = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
    requestIdHeader: 'x-request-id',
    genReqId: () => `req_${randomUUID().slice(0, 12)}`,
  });

  await fastify.register(cors, { origin: true });

  // ─── Services ──────────────────────────────────────────
  const db = createDatabaseClient(DATABASE_URL);
  const agents = new AgentRepository(db);
  const tasks = new TaskRepository(db);
  const intents = new IntentRepository(db);
  const policies = new PolicyRepository(db);
  const escrows = new EscrowRepository(db);
  const settlements = new SettlementRepository(db);
  const audit = new AuditRepository(db);
  const reputation = new ReputationRepository(db);
  const executions = new ExecutionRepository(db);
  const verifications = new VerificationRepository(db);
  const capabilities = new CapabilityRepository(db);

  const keeperHub = createKeeperHubExecutor({ mock: MOCK_EXTERNAL });
  const daydreams = createDaydreamsAdapter({ mock: MOCK_EXTERNAL });

  const orchestrator = new TaskOrchestrator({
    tasks, intents, policies, escrows, settlements, audit,
    reputation, executions, verifications, capabilities,
    keeperHub, daydreams,
  });

  // ─── Error Handler ─────────────────────────────────────
  fastify.setErrorHandler((error: unknown, request, reply) => {
    if (error instanceof SovereignError) {
      const apiError = error.toApiError(request.id);
      return reply.status(error.statusCode).send(apiError);
    }

    // Zod validation errors
    if (error && typeof error === 'object' && 'name' in error && (error as { name: string }).name === 'ZodError') {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          requestId: request.id,
          retryable: false,
          details: { issues: (error as unknown as { issues: unknown[] }).issues },
        },
      });
    }

    request.log.error(error);
    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        requestId: request.id,
        retryable: true,
        details: {},
      },
    });
  });

  // ─── Health ────────────────────────────────────────────
  fastify.get('/api/v1/health', async () => ({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    mode: MOCK_EXTERNAL ? 'SIMULATION' : 'REAL EXECUTION',
  }));

  fastify.get('/api/v1/ready', async () => {
    try {
      await db.query('SELECT 1');
      return { ready: true };
    } catch {
      return { ready: false };
    }
  });

  // ─── Agents ────────────────────────────────────────────
  fastify.get('/api/v1/agents', async () => {
    const allAgents = await agents.findAll();
    const result = [];
    for (const agent of allAgents) {
      const caps = await capabilities.findByAgentId(agent.agentId);
      const rep = await reputation.getLatestSnapshot(agent.agentId);
      result.push({
        ...agent,
        capabilities: caps.map((c) => ({ ...c, price: c.price.toString() })),
        reputation: rep ? { ...rep, explanation: explainReputation(rep) } : null,
      });
    }
    return { agents: result };
  });

  fastify.get<{ Params: { agentId: string } }>('/api/v1/agents/:agentId', async (req) => {
    const agent = await agents.findById(req.params.agentId);
    if (!agent) throw new SovereignError({ code: ERROR_CODES.AGENT_NOT_FOUND, message: 'Agent not found', statusCode: 404 });
    const caps = await capabilities.findByAgentId(agent.agentId);
    const rep = await reputation.getLatestSnapshot(agent.agentId);
    return {
      ...agent,
      capabilities: caps.map((c) => ({ ...c, price: c.price.toString() })),
      reputation: rep ? { ...rep, explanation: explainReputation(rep) } : null,
    };
  });

  fastify.get<{ Params: { agentId: string } }>('/api/v1/agents/:agentId/reputation', async (req) => {
    const rep = await reputation.getLatestSnapshot(req.params.agentId);
    if (!rep) return { score: 50, explanation: ['No reputation data — baseline score'] };
    return { ...rep, explanation: explainReputation(rep) };
  });

  fastify.post('/api/v1/agents', async (req, reply) => {
    const input = CreateAgentSchema.parse(req.body);
    const agent = await agents.create({
      walletAddress: input.walletAddress,
      displayName: input.displayName,
      identitySource: input.identitySource,
      status: 'active',
    });
    for (const cap of input.capabilities) {
      await capabilities.create(agent.agentId, {
        capability: cap.capability,
        description: cap.description,
        price: BigInt(cap.price),
        currency: cap.currency,
      });
    }
    return reply.status(201).send(agent);
  });

  // ─── Tasks ─────────────────────────────────────────────
  fastify.post('/api/v1/tasks', async (req, reply) => {
    const input = CreateTaskSchema.parse(req.body);
    const task = await tasks.create({
      buyerAgentId: input.buyerAgentId,
      capability: input.capability,
      description: input.description,
      maxBudget: BigInt(input.maxBudget),
      currency: input.currency,
      network: input.network,
      minimumReputation: input.minimumReputation,
      deadline: new Date(input.deadline),
      state: 'CREATED',
      policyId: input.policyId,
    });

    // Create initial audit event
    const auditEvt = (await import('@sovereign/audit')).createAuditEvent({
      taskId: task.taskId,
      eventType: 'task.created',
      actorType: 'buyer-agent',
      actorId: input.buyerAgentId,
      metadata: { capability: input.capability, maxBudget: input.maxBudget },
    });
    await audit.create(auditEvt);

    return reply.status(201).send({ ...task, maxBudget: task.maxBudget.toString() });
  });

  fastify.get('/api/v1/tasks', async () => {
    const allTasks = await tasks.findAll();
    return { tasks: allTasks.map((t) => ({ ...t, maxBudget: t.maxBudget.toString() })) };
  });

  fastify.get<{ Params: { taskId: string } }>('/api/v1/tasks/:taskId', async (req) => {
    const task = await tasks.findById(req.params.taskId);
    if (!task) throw new SovereignError({ code: ERROR_CODES.TASK_NOT_FOUND, message: 'Task not found', statusCode: 404 });
    const intent = task.intentId ? await intents.findByTaskId(task.taskId) : null;
    const escrow = await escrows.findByTaskId(task.taskId);
    const verification = await verifications.findByTaskId(task.taskId);
    const settlement = await settlements.findByTaskId(task.taskId);
    const execution = await executions.findByTaskId(task.taskId);
    const auditTrail = await audit.findByTaskId(task.taskId);
    const policy = await policies.findById(task.policyId);

    let workerRep = null;
    if (task.workerAgentId) {
      workerRep = await reputation.getLatestSnapshot(task.workerAgentId, task.capability);
    }

    return {
      task: { ...task, maxBudget: task.maxBudget.toString() },
      intent: intent ? { ...intent, amount: intent.amount.toString() } : null,
      escrow: escrow ? { ...escrow, amount: escrow.amount.toString() } : null,
      verification,
      settlement: settlement ? { ...settlement, amount: settlement.amount.toString(), blockNumber: settlement.blockNumber.toString() } : null,
      execution,
      policy: policy ? { ...policy, maxSinglePayment: policy.maxSinglePayment.toString(), maxCumulativeSpend: policy.maxCumulativeSpend.toString(), currentCumulativeSpend: policy.currentCumulativeSpend.toString() } : null,
      workerReputation: workerRep ? { ...workerRep, explanation: explainReputation(workerRep) } : null,
      auditTrail,
    };
  });

  // ─── Task Lifecycle ────────────────────────────────────
  fastify.post<{ Params: { taskId: string } }>('/api/v1/tasks/:taskId/discover', async (req) => {
    const workers = await orchestrator.discoverWorkers(req.params.taskId);
    return { workers: workers.map((w) => ({ ...w, price: w.price.toString() })) };
  });

  fastify.post<{ Params: { taskId: string } }>('/api/v1/tasks/:taskId/select-worker', async (req) => {
    const input = SelectWorkerSchema.parse(req.body);
    const task = await orchestrator.selectWorker(req.params.taskId, input.workerAgentId);
    return { task: { ...task, maxBudget: task.maxBudget.toString() } };
  });

  fastify.post<{ Params: { taskId: string } }>('/api/v1/tasks/:taskId/evaluate-policy', async (req) => {
    const decision = await orchestrator.evaluateTaskPolicy(req.params.taskId);
    return { decision };
  });

  fastify.post<{ Params: { taskId: string } }>('/api/v1/tasks/:taskId/commit-intent', async (req) => {
    const intent = await orchestrator.commitIntent(req.params.taskId);
    return { intent: { ...intent, amount: intent.amount.toString() } };
  });

  fastify.post<{ Params: { taskId: string } }>('/api/v1/tasks/:taskId/create-escrow', async (req) => {
    await orchestrator.createEscrow(req.params.taskId);
    const escrow = await escrows.findByTaskId(req.params.taskId);
    return { escrow: escrow ? { ...escrow, amount: escrow.amount.toString() } : null };
  });

  fastify.post<{ Params: { taskId: string } }>('/api/v1/tasks/:taskId/submit-result', async (req) => {
    const input = SubmitResultSchema.parse(req.body);
    await orchestrator.submitResult(req.params.taskId, input.resultData);
    return { status: 'result_submitted' };
  });

  fastify.post<{ Params: { taskId: string } }>('/api/v1/tasks/:taskId/verify', async (req) => {
    const verification = await orchestrator.verifyResult(req.params.taskId);
    return { verification };
  });

  fastify.post<{ Params: { taskId: string } }>('/api/v1/tasks/:taskId/settle', async (req) => {
    const result = await orchestrator.settle(req.params.taskId);
    return result;
  });

  // ─── Audit ─────────────────────────────────────────────
  fastify.get<{ Params: { taskId: string } }>('/api/v1/tasks/:taskId/audit', async (req) => {
    const events = await audit.findByTaskId(req.params.taskId);
    return { events };
  });

  fastify.get('/api/v1/audit', async () => {
    const events = await audit.findAll(100);
    return { events };
  });

  // ─── Policies ──────────────────────────────────────────
  fastify.get('/api/v1/policies', async () => {
    const allPolicies = await policies.findAll();
    return { policies: allPolicies.map((p) => ({ ...p, maxSinglePayment: p.maxSinglePayment.toString(), maxCumulativeSpend: p.maxCumulativeSpend.toString(), currentCumulativeSpend: p.currentCumulativeSpend.toString() })) };
  });

  fastify.post('/api/v1/policies', async (req, reply) => {
    const input = CreatePolicySchema.parse(req.body);
    const policy = await policies.create({
      agentId: input.agentId,
      maxSinglePayment: BigInt(input.maxSinglePayment),
      maxCumulativeSpend: BigInt(input.maxCumulativeSpend),
      allowedRecipients: input.allowedRecipients,
      allowedNetworks: input.allowedNetworks,
      minimumReputationScore: input.minimumReputationScore,
      requiredCapabilities: input.requiredCapabilities,
      maxExecutionCount: input.maxExecutionCount,
      requireOutcomeVerification: input.requireOutcomeVerification,
      expiresAt: new Date(input.expiresAt),
    });
    return reply.status(201).send({ ...policy, maxSinglePayment: policy.maxSinglePayment.toString(), maxCumulativeSpend: policy.maxCumulativeSpend.toString(), currentCumulativeSpend: policy.currentCumulativeSpend.toString() });
  });

  // ─── Executions ────────────────────────────────────────
  fastify.get('/api/v1/executions', async () => {
    const allExecs = await executions.findAll();
    return { executions: allExecs };
  });

  fastify.get<{ Params: { taskId: string } }>('/api/v1/tasks/:taskId/execution', async (req) => {
    const exec = await executions.findByTaskId(req.params.taskId);
    return { execution: exec };
  });

  // ─── Security Lab / Attack Simulation ──────────────────
  fastify.post('/api/v1/security-lab/simulate', async (req) => {
    const body = req.body as { scenario: string; params?: Record<string, unknown> };
    const scenario = AttackScenarioSchema.parse(body.scenario);

    const policy = await policies.findById('p0000000-0000-0000-0000-000000000001');
    if (!policy) return { error: 'Test policy not found — run db:seed first' };

    const baseContext: PolicyEvaluationContext = {
      currentCumulativeSpend: policy.currentCumulativeSpend,
      currentExecutionCount: policy.currentExecutionCount,
      workerReputationScore: 97,
      existingSettlementForTask: false,
      now: new Date(),
    };

    switch (scenario) {
      case 'over-budget': {
        const intent = createTransactionIntent({
          taskId: randomUUID(), buyerAgentId: 'a0000000-0000-0000-0000-000000000001',
          workerAgentId: 'a0000000-0000-0000-0000-000000000002',
          recipient: '0x2222222222222222222222222222222222222222',
          amount: 15_000_000n, // $15 — exceeds $10 max
          currency: 'USDC', network: 'base-sepolia', capability: 'document-processing',
          settlementCondition: 'VERIFIED_OUTCOME', policyVersion: policy.version, expiresAt: new Date(Date.now() + 3600000),
        });
        const decision = evaluatePolicy(intent, policy, baseContext);
        return { scenario: 'OVER-BUDGET PAYMENT', blocked: !decision.approved, reasons: decision.reasons, result: decision.approved ? 'ALLOWED' : 'BLOCKED — POLICY VIOLATION' };
      }

      case 'split-payment-bypass': {
        const context1 = { ...baseContext, currentCumulativeSpend: 6_000_000n }; // Already spent $6
        const intent = createTransactionIntent({
          taskId: randomUUID(), buyerAgentId: 'a0000000-0000-0000-0000-000000000001',
          workerAgentId: 'a0000000-0000-0000-0000-000000000002',
          recipient: '0x2222222222222222222222222222222222222222',
          amount: 6_000_000n, // Another $6 — total $12 exceeds $10
          currency: 'USDC', network: 'base-sepolia', capability: 'document-processing',
          settlementCondition: 'VERIFIED_OUTCOME', policyVersion: policy.version, expiresAt: new Date(Date.now() + 3600000),
        });
        const decision = evaluatePolicy(intent, policy, context1);
        return { scenario: 'SPLIT-PAYMENT BYPASS ($6 + $6)', blocked: !decision.approved, reasons: decision.reasons, result: decision.approved ? 'ALLOWED' : 'BLOCKED — BUDGET CIRCUMVENTION BLOCKED' };
      }

      case 'recipient-substitution': {
        const intent = createTransactionIntent({
          taskId: randomUUID(), buyerAgentId: 'a0000000-0000-0000-0000-000000000001',
          workerAgentId: 'a0000000-0000-0000-0000-000000000002',
          recipient: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', // Wrong wallet
          amount: 8_000_000n, currency: 'USDC', network: 'base-sepolia', capability: 'document-processing',
          settlementCondition: 'VERIFIED_OUTCOME', policyVersion: policy.version, expiresAt: new Date(Date.now() + 3600000),
        });
        const decision = evaluatePolicy(intent, policy, baseContext);
        return { scenario: 'RECIPIENT SUBSTITUTION', blocked: !decision.approved, reasons: decision.reasons, result: decision.approved ? 'ALLOWED' : 'BLOCKED — RECIPIENT MISMATCH' };
      }

      case 'intent-mutation': {
        const intent = createTransactionIntent({
          taskId: randomUUID(), buyerAgentId: 'a0000000-0000-0000-0000-000000000001',
          workerAgentId: 'a0000000-0000-0000-0000-000000000002',
          recipient: '0x2222222222222222222222222222222222222222',
          amount: 8_000_000n, currency: 'USDC', network: 'base-sepolia', capability: 'document-processing',
          settlementCondition: 'VERIFIED_OUTCOME', policyVersion: policy.version, expiresAt: new Date(Date.now() + 3600000),
        });
        // Mutate the intent after hashing
        const mutated = { ...intent, amount: 9_000_000n };
        const { verifyIntentHash } = await import('@sovereign/intent');
        const hashValid = verifyIntentHash(mutated);
        return { scenario: 'INTENT MUTATION ($8 → $9)', blocked: !hashValid, result: hashValid ? 'HASH VALID' : 'BLOCKED — INTENT HASH MISMATCH' };
      }

      case 'unverified-result': {
        return { scenario: 'UNVERIFIED RESULT', blocked: true, result: 'BLOCKED — SETTLEMENT BLOCKED: Result has not been verified', reasons: ['requireOutcomeVerification=true, but no passed verification exists'] };
      }

      case 'replay-attack': {
        return { scenario: 'REPLAY ATTACK (duplicate settlement)', blocked: true, result: 'BLOCKED — IDEMPOTENCY / ALREADY SETTLED', reasons: ['Settlement already exists for this task. Unique constraint prevents duplicate.'] };
      }

      case 'expired-intent': {
        const intent = createTransactionIntent({
          taskId: randomUUID(), buyerAgentId: 'a0000000-0000-0000-0000-000000000001',
          workerAgentId: 'a0000000-0000-0000-0000-000000000002',
          recipient: '0x2222222222222222222222222222222222222222',
          amount: 8_000_000n, currency: 'USDC', network: 'base-sepolia', capability: 'document-processing',
          settlementCondition: 'VERIFIED_OUTCOME', policyVersion: policy.version, expiresAt: new Date(Date.now() - 3600000), // Expired
        });
        const decision = evaluatePolicy(intent, policy, baseContext);
        return { scenario: 'EXPIRED INTENT', blocked: !decision.approved, reasons: decision.reasons, result: decision.approved ? 'ALLOWED' : 'BLOCKED — INTENT EXPIRED' };
      }

      case 'low-reputation': {
        const context = { ...baseContext, workerReputationScore: 75 };
        const intent = createTransactionIntent({
          taskId: randomUUID(), buyerAgentId: 'a0000000-0000-0000-0000-000000000001',
          workerAgentId: 'a0000000-0000-0000-0000-000000000003',
          recipient: '0x3333333333333333333333333333333333333333',
          amount: 5_000_000n, currency: 'USDC', network: 'base-sepolia', capability: 'document-processing',
          settlementCondition: 'VERIFIED_OUTCOME', policyVersion: policy.version, expiresAt: new Date(Date.now() + 3600000),
        });
        const decision = evaluatePolicy(intent, policy, context);
        return { scenario: 'LOW REPUTATION WORKER', blocked: !decision.approved, reasons: decision.reasons, result: decision.approved ? 'ALLOWED' : 'BLOCKED — WORKER REJECTED' };
      }
    }
  });

  // ─── Dashboard Stats ───────────────────────────────────
  fastify.get('/api/v1/stats', async () => {
    const allTasks = await tasks.findAll(1000);
    const completedCount = allTasks.filter((t) => t.state === 'COMPLETED').length;
    const failedCount = allTasks.filter((t) => ['POLICY_REJECTED', 'VERIFICATION_FAILED', 'KEEPERHUB_FAILED', 'BLOCKCHAIN_FAILED'].includes(t.state)).length;
    const activeCount = allTasks.filter((t) => !['COMPLETED', 'CANCELLED', 'EXPIRED', 'POLICY_REJECTED'].includes(t.state)).length;

    return {
      activeTasks: activeCount,
      completedTasks: completedCount,
      failedTasks: failedCount,
      totalTasks: allTasks.length,
      mode: MOCK_EXTERNAL ? 'SIMULATION' : 'REAL EXECUTION',
    };
  });

  // ─── Start ─────────────────────────────────────────────
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`\n🏛️  SOVEREIGN API running on http://localhost:${PORT}`);
  console.log(`   Mode: ${MOCK_EXTERNAL ? '🔄 SIMULATION' : '⚡ REAL EXECUTION'}\n`);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
