// ============================================================
// SOVEREIGN — KeeperHub Adapter
// ============================================================
// Clean adapter with mock/real modes behind identical interface.
// KeeperHub is the ONLY execution boundary for value movement.

import { randomUUID } from 'node:crypto';

export interface KeeperHubWorkflow {
  readonly workflowId: string;
  readonly name: string;
  readonly parameters: Record<string, unknown>;
  readonly createdAt: Date;
}

export interface KeeperHubDryRunResult {
  readonly success: boolean;
  readonly estimatedGas: bigint;
  readonly warnings: readonly string[];
  readonly simulatedTxHash: string;
}

export interface KeeperHubExecution {
  readonly executionId: string;
  readonly workflowId: string;
  readonly status: 'pending' | 'running' | 'completed' | 'failed';
  readonly transactionHash: string | null;
  readonly blockNumber: bigint | null;
  readonly error: string | null;
  readonly startedAt: Date;
  readonly completedAt: Date | null;
}

export interface KeeperHubExecuteParams {
  readonly intentHash: string;
  readonly recipient: string;
  readonly amount: bigint;
  readonly token: string;
  readonly network: string;
  readonly taskId: string;
  readonly escrowId: string;
}

/** The KeeperHub executor interface — identical for mock and real */
export interface KeeperHubExecutor {
  createOrResolveWorkflow(params: KeeperHubExecuteParams): Promise<KeeperHubWorkflow>;
  validateWorkflow(workflow: KeeperHubWorkflow): Promise<{ valid: boolean; errors: string[] }>;
  dryRun(workflow: KeeperHubWorkflow): Promise<KeeperHubDryRunResult>;
  execute(workflow: KeeperHubWorkflow): Promise<KeeperHubExecution>;
  getExecution(executionId: string): Promise<KeeperHubExecution>;
}

// ─── Mock Implementation ───────────────────────────────────

export class MockKeeperHubExecutor implements KeeperHubExecutor {
  private executions = new Map<string, KeeperHubExecution>();

  async createOrResolveWorkflow(params: KeeperHubExecuteParams): Promise<KeeperHubWorkflow> {
    return {
      workflowId: `wf_${randomUUID().slice(0, 8)}`,
      name: 'sovereign-usdc-settlement',
      parameters: {
        intentHash: params.intentHash,
        recipient: params.recipient,
        amount: params.amount.toString(),
        token: params.token,
        network: params.network,
        taskId: params.taskId,
        escrowId: params.escrowId,
      },
      createdAt: new Date(),
    };
  }

  async validateWorkflow(workflow: KeeperHubWorkflow): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const params = workflow.parameters;

    if (!params['recipient']) errors.push('Missing recipient');
    if (!params['amount'] || params['amount'] === '0') errors.push('Invalid amount');
    if (!params['intentHash']) errors.push('Missing intent hash');
    if (!params['token']) errors.push('Missing token');

    return { valid: errors.length === 0, errors };
  }

  async dryRun(_workflow: KeeperHubWorkflow): Promise<KeeperHubDryRunResult> {
    return {
      success: true,
      estimatedGas: 65000n,
      warnings: [],
      simulatedTxHash: `0x${Buffer.from(randomUUID()).toString('hex').padEnd(64, '0')}`,
    };
  }

  async execute(workflow: KeeperHubWorkflow): Promise<KeeperHubExecution> {
    const executionId = `exec_${randomUUID().slice(0, 8)}`;
    const txHash = `0x${Buffer.from(randomUUID() + randomUUID()).toString('hex').slice(0, 64)}`;

    const execution: KeeperHubExecution = {
      executionId,
      workflowId: workflow.workflowId,
      status: 'completed',
      transactionHash: txHash,
      blockNumber: BigInt(Math.floor(Math.random() * 10000000) + 20000000),
      error: null,
      startedAt: new Date(),
      completedAt: new Date(),
    };

    this.executions.set(executionId, execution);
    return execution;
  }

  async getExecution(executionId: string): Promise<KeeperHubExecution> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }
    return execution;
  }
}

// ─── Real Implementation (Stub) ────────────────────────────

export class RealKeeperHubExecutor implements KeeperHubExecutor {
  constructor(
    public readonly apiUrl: string,
    public readonly apiKey: string,
  ) {}

  async createOrResolveWorkflow(_params: KeeperHubExecuteParams): Promise<KeeperHubWorkflow> {
    // TODO: Implement when KeeperHub API docs become available
    // POST ${this.apiUrl}/workflows
    throw new Error('Real KeeperHub integration pending — API documentation not yet available. Set MOCK_EXTERNAL_SERVICES=true');
  }

  async validateWorkflow(_workflow: KeeperHubWorkflow): Promise<{ valid: boolean; errors: string[] }> {
    throw new Error('Real KeeperHub integration pending');
  }

  async dryRun(_workflow: KeeperHubWorkflow): Promise<KeeperHubDryRunResult> {
    throw new Error('Real KeeperHub integration pending');
  }

  async execute(_workflow: KeeperHubWorkflow): Promise<KeeperHubExecution> {
    throw new Error('Real KeeperHub integration pending');
  }

  async getExecution(_executionId: string): Promise<KeeperHubExecution> {
    throw new Error('Real KeeperHub integration pending');
  }
}

/** Factory function to create the appropriate executor */
export function createKeeperHubExecutor(config: {
  mock: boolean;
  apiUrl?: string;
  apiKey?: string;
}): KeeperHubExecutor {
  if (config.mock) {
    return new MockKeeperHubExecutor();
  }
  if (!config.apiUrl || !config.apiKey) {
    throw new Error('KeeperHub API URL and API key are required for real mode');
  }
  return new RealKeeperHubExecutor(config.apiUrl, config.apiKey);
}
