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
        const task = { ...(store.tasks.get(id) || {}), state, ...updates };
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

    const mockPoliciesRepo: any = {
      findActiveForAgent: vi.fn(async () => ({
        policyId: 'pol-001',
        agentId: 'buyer-001',
        version: 1,
        maxSinglePayment: 10_000_000n,
        maxCumulativeSpend: 50_000_000n,
        allowedRecipients: [],
        allowedCurrencies: ['USDC'],
        allowedNetworks: ['base-sepolia'],
        requiredCapabilities: ['document-processing'],
        minimumWorkerReputation: 90,
        requiresVerification: true,
        maxExecutionsPerTask: 1,
        settlementTimeoutSeconds: 3600,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      getCumulativeSpend: vi.fn(async () => 0n),
    };

    const mockEscrowsRepo: any = {
      create: vi.fn(async (escrow: any) => {
        store.escrows.set(escrow.escrowId, escrow);
        return escrow;
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
        store.verifications.set(v.verificationId, v);
        return v;
      }),
      findByTaskId: vi.fn(async (taskId: string) => {
        for (const v of store.verifications.values()) {
          if (v.taskId === taskId) return v;
        }
        return null;
      }),
    };

    const mockCapabilitiesRepo: any = {
      findByAgentAndCapability: vi.fn(async () => ({
        capability: 'document-processing',
        price: 8_000_000,
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

    // 3. Commit intent & escrow
    const intentRes = await orchestrator.commitIntentAndEscrow(taskId);
    expect(intentRes.intent.intentHash).toBeDefined();

    // 4. Submit result
    const submission = await orchestrator.submitResult(
      taskId,
      selectedWorker.agentId,
      { output: 'Analysis complete', confidence: 0.99 },
      'proof-0x123'
    );
    expect(submission.state).toBe('RESULT_SUBMITTED');

    // 5. Verify deliverable
    const verified = await orchestrator.verifyTask(taskId);
    expect(verified.state).toBe('VERIFIED');

    // 6. Settle via KeeperHub
    const settled = await orchestrator.settleTask(taskId);
    expect(settled.state).toBe('COMPLETED');
    expect(store.audit.length).toBeGreaterThanOrEqual(6);
  });
});
