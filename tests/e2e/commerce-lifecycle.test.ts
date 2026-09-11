import { describe, it, expect, vi } from 'vitest';
import { TaskOrchestrator } from '../../apps/api/src/orchestrator.js';
import { createKeeperHubExecutor } from '@sovereign/keeperhub';
import { createDaydreamsAdapter } from '@sovereign/daydreams';

describe('E2E Autonomous Commerce Lifecycle', () => {
  it('orchestrates complete workflow from discovery to verified settlement', async () => {
    // In-memory repositories mock
    const store = {
      tasks: new Map<string, any>(),
      intents: new Map<string, any>(),
      policies: new Map<string, any>(),
      escrows: new Map<string, any>(),
      settlements: new Map<string, any>(),
      audit: [] as any[],
      reputation: new Map<string, any>(),
      executions: new Map<string, any>(),
      verifications: new Map<string, any>(),
      capabilities: new Map<string, any>(),
    };

    const mockTasksRepo: any = {
      findById: vi.fn(async (id: string) => store.tasks.get(id) || null),
      updateState: vi.fn(async (id: string, state: string, updates: any) => {
        const workerAgentId = updates.worker_agent_id ?? updates.workerAgentId ?? store.tasks.get(id)?.workerAgentId ?? null;
        const intentId = updates.intent_id ?? updates.intentId ?? store.tasks.get(id)?.intentId ?? null;
        const escrowId = updates.escrow_id ?? updates.escrowId ?? store.tasks.get(id)?.escrowId ?? null;
        const verificationId = updates.verification_id ?? updates.verificationId ?? store.tasks.get(id)?.verificationId ?? null;
        const task = {
          ...(store.tasks.get(id) || {}),
          state,
          ...updates,
          workerAgentId,
          intentId,
          escrowId,
          verificationId,
        };
        store.tasks.set(id, task);
        return task;
      }),
    };

    const mockIntentsRepo: any = {
      create: vi.fn(async (intent: any) => {
        store.intents.set(intent.intentId, intent);
        return intent;
      }),
      findByTaskId: vi.fn(async (taskId: string) => {
        for (const it of store.intents.values()) {
          if (it.taskId === taskId) return it;
        }
        return null;
      }),
    };

    const samplePolicy = {
      policyId: 'pol-001',
      agentId: 'buyer-001',
      version: 1,
      maxSinglePayment: 10_000_000n,
      maxCumulativeSpend: 50_000_000n,
      currentCumulativeSpend: 0n,
      allowedRecipients: [],
      allowedCurrencies: ['USDC'],
      allowedNetworks: ['base-sepolia'],
      requiredCapabilities: ['document-processing'],
      minimumReputationScore: 90,
      maxExecutionCount: 5,
      currentExecutionCount: 0,
      requireOutcomeVerification: true,
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockPoliciesRepo: any = {
      findById: vi.fn(async () => samplePolicy),
      findActiveForAgent: vi.fn(async () => samplePolicy),
      getCumulativeSpend: vi.fn(async () => 0n),
      incrementCumulativeSpend: vi.fn(async () => {}),
    };

    const mockEscrowsRepo: any = {
      create: vi.fn(async (escrow: any) => {
        const withId = { escrowId: 'esc-001', ...escrow };
        store.escrows.set(withId.escrowId, withId);
        return withId;
      }),
      findByTaskId: vi.fn(async (taskId: string) => {
        for (const e of store.escrows.values()) {
          if (e.taskId === taskId) return e;
        }
        return null;
      }),
      updateState: vi.fn(async (id: string, state: string) => {
        const e = store.escrows.get(id);
        if (e) e.state = state;
        return e;
      }),
    };

    const mockSettlementsRepo: any = {
      create: vi.fn(async (s: any) => {
        store.settlements.set(s.settlementId, s);
        return s;
      }),
      existsForTask: vi.fn(async () => false),
    };

    const mockAuditRepo: any = {
      create: vi.fn(async (evt: any) => {
        store.audit.push(evt);
        return evt;
      }),
      getLastEventForTask: vi.fn(async (taskId: string) => {
        const taskEvents = store.audit.filter((e) => e.taskId === taskId);
        return taskEvents[taskEvents.length - 1] || null;
      }),
    };

    const mockReputationRepo: any = {
      getLatestSnapshot: vi.fn(async () => ({
        overallScore: 97.5,
        totalTasks: 120,
        completedTasks: 118,
        disputeCount: 0,
      })),
      createEvent: vi.fn(async () => {}),
      recordEvent: vi.fn(async () => {}),
      getEventsForAgent: vi.fn(async () => []),
      saveSnapshot: vi.fn(async () => {}),
    };

    const mockExecutionsRepo: any = {
      create: vi.fn(async (ex: any) => {
        store.executions.set(ex.executionId, ex);
        return ex;
      }),
      updateStatus: vi.fn(async () => {}),
    };

    const mockVerificationsRepo: any = {
      create: vi.fn(async (v: any) => {
        const withId = { verificationId: 'ver-001', ...v };
        store.verifications.set(withId.verificationId, withId);
        return withId;
      }),
      findByTaskId: vi.fn(async (taskId: string) => {
        for (const v of store.verifications.values()) {
          if (v.taskId === taskId) return v;
        }
        return null;
      }),
    };

    const mockCapabilitiesRepo: any = {
      findByAgentId: vi.fn(async () => [
        {
          capability: 'document-processing',
          price: 8_000_000n,
          currency: 'USDC',
        },
      ]),
      findByAgentAndCapability: vi.fn(async () => ({
        capability: 'document-processing',
        price: 8_000_000n,
        currency: 'USDC',
      })),
    };

    const keeperHub = createKeeperHubExecutor({ mock: true });
    const daydreams = createDaydreamsAdapter({ mock: true });

    const orchestrator = new TaskOrchestrator({
      tasks: mockTasksRepo,
      intents: mockIntentsRepo,
      policies: mockPoliciesRepo,
      escrows: mockEscrowsRepo,
      settlements: mockSettlementsRepo,
      audit: mockAuditRepo,
      reputation: mockReputationRepo,
      executions: mockExecutionsRepo,
      verifications: mockVerificationsRepo,
      capabilities: mockCapabilitiesRepo,
      keeperHub,
      daydreams,
    });

    // Seed task in store
    const taskId = 'task-e2e-001';
    store.tasks.set(taskId, {
      taskId,
      buyerAgentId: 'buyer-001',
      workerAgentId: null,
      capability: 'document-processing',
      state: 'CREATED',
      maxBudget: 10_000_000n,
      currency: 'USDC',
      network: 'base-sepolia',
      minimumReputation: 90,
      policyId: 'pol-001',
      deadline: new Date(Date.now() + 86400000),
      metadata: {},
      createdAt: new Date(),
    });

    // 1. Worker discovery
    const workers = await orchestrator.discoverWorkers(taskId);
    expect(workers.length).toBeGreaterThan(0);

    // 2. Select worker
    const selectedWorker = workers[0]!;
    const selectedTask = await orchestrator.selectWorker(taskId, selectedWorker.agentId);
    expect(selectedTask.workerAgentId).toBe(selectedWorker.agentId);

    // 3. Evaluate Policy
    const decision = await orchestrator.evaluateTaskPolicy(taskId);
    expect(decision.approved).toBe(true);

    // 4. Commit intent
    const intent = await orchestrator.commitIntent(taskId);
    expect(intent.intentHash).toBeDefined();

    // 5. Create Escrow
    await orchestrator.createEscrow(taskId);

    // 6. Submit result
    await orchestrator.submitResult(taskId, JSON.stringify({ output: 'Analysis complete' }));

    // 7. Verify result
    const verified = await orchestrator.verifyResult(taskId);
    expect(verified.status).toBe('passed');

    // 8. Settle via KeeperHub
    const { settlement, execution } = await orchestrator.settle(taskId);
    expect(settlement.transactionHash).toBeDefined();
    expect(execution.status).toBe('completed');
    expect(store.audit.length).toBeGreaterThanOrEqual(6);
  });
});
