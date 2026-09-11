// ============================================================
// SOVEREIGN — Repository Layer
// ============================================================
import type { DatabaseClient } from './client.js';
import type {
  Agent, Task, ExecutionPolicy, TransactionIntent,
  Escrow, Verification, Settlement, Execution,
  AuditEvent, ReputationEvent, ReputationSnapshot, IdempotencyRecord,
} from '@sovereign/domain';
import type { AnyTaskState } from '@sovereign/domain';

// ─── Agent Repository ──────────────────────────────────────
export class AgentRepository {
  constructor(private db: DatabaseClient) {}

  async create(agent: Omit<Agent, 'agentId' | 'createdAt' | 'updatedAt'>): Promise<Agent> {
    const result = await this.db.query(
      `INSERT INTO agents (wallet_address, display_name, identity_source, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [agent.walletAddress, agent.displayName, agent.identitySource, agent.status],
    );
    return this.mapAgent(result.rows[0]!);
  }

  async findById(agentId: string): Promise<Agent | null> {
    const result = await this.db.query(
      'SELECT * FROM agents WHERE agent_id = $1',
      [agentId],
    );
    if (result.rows.length === 0) return null;
    return this.mapAgent(result.rows[0]!);
  }

  async findAll(): Promise<Agent[]> {
    const result = await this.db.query('SELECT * FROM agents ORDER BY created_at DESC');
    return result.rows.map((r) => this.mapAgent(r));
  }

  async findByCapability(capability: string): Promise<Agent[]> {
    const result = await this.db.query(
      `SELECT a.* FROM agents a
       JOIN agent_capabilities c ON a.agent_id = c.agent_id
       WHERE c.capability = $1 AND a.status = 'active'`,
      [capability],
    );
    return result.rows.map((r) => this.mapAgent(r));
  }

  private mapAgent(row: Record<string, unknown>): Agent {
    return {
      agentId: row['agent_id'] as string,
      walletAddress: row['wallet_address'] as string,
      displayName: row['display_name'] as string,
      identitySource: row['identity_source'] as Agent['identitySource'],
      status: row['status'] as Agent['status'],
      createdAt: new Date(row['created_at'] as string),
      updatedAt: new Date(row['updated_at'] as string),
    };
  }
}

// ─── Task Repository ───────────────────────────────────────
export class TaskRepository {
  constructor(private db: DatabaseClient) {}

  async create(task: Omit<Task, 'taskId' | 'createdAt' | 'updatedAt' | 'workerAgentId' | 'intentId' | 'escrowId' | 'verificationId' | 'settlementId'>): Promise<Task> {
    const result = await this.db.query(
      `INSERT INTO tasks (buyer_agent_id, capability, description, max_budget, currency, network, minimum_reputation, deadline, state, policy_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [task.buyerAgentId, task.capability, task.description, task.maxBudget.toString(), task.currency, task.network, task.minimumReputation, task.deadline, task.state, task.policyId],
    );
    return this.mapTask(result.rows[0]!);
  }

  async findById(taskId: string): Promise<Task | null> {
    const result = await this.db.query('SELECT * FROM tasks WHERE task_id = $1', [taskId]);
    if (result.rows.length === 0) return null;
    return this.mapTask(result.rows[0]!);
  }

  async findAll(limit = 20, offset = 0): Promise<Task[]> {
    const result = await this.db.query(
      'SELECT * FROM tasks ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset],
    );
    return result.rows.map((r) => this.mapTask(r));
  }

  async updateState(taskId: string, state: AnyTaskState, updates: Record<string, unknown> = {}): Promise<Task> {
    const setClauses = ['state = $2', 'updated_at = NOW()'];
    const values: unknown[] = [taskId, state];
    let paramIndex = 3;

    for (const [key, value] of Object.entries(updates)) {
      setClauses.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }

    const result = await this.db.query(
      `UPDATE tasks SET ${setClauses.join(', ')} WHERE task_id = $1 RETURNING *`,
      values,
    );
    return this.mapTask(result.rows[0]!);
  }

  async countByState(state: AnyTaskState): Promise<number> {
    const result = await this.db.query(
      'SELECT COUNT(*) as count FROM tasks WHERE state = $1',
      [state],
    );
    return parseInt(result.rows[0]!['count'] as string, 10);
  }

  private mapTask(row: Record<string, unknown>): Task {
    return {
      taskId: row['task_id'] as string,
      buyerAgentId: row['buyer_agent_id'] as string,
      workerAgentId: (row['worker_agent_id'] as string) ?? null,
      capability: row['capability'] as string,
      description: row['description'] as string,
      maxBudget: BigInt(row['max_budget'] as string),
      currency: row['currency'] as string,
      network: row['network'] as string,
      minimumReputation: row['minimum_reputation'] as number,
      deadline: new Date(row['deadline'] as string),
      state: row['state'] as AnyTaskState,
      policyId: row['policy_id'] as string,
      intentId: (row['intent_id'] as string) ?? null,
      escrowId: (row['escrow_id'] as string) ?? null,
      verificationId: (row['verification_id'] as string) ?? null,
      settlementId: (row['settlement_id'] as string) ?? null,
      createdAt: new Date(row['created_at'] as string),
      updatedAt: new Date(row['updated_at'] as string),
    };
  }
}

// ─── Intent Repository ─────────────────────────────────────
export class IntentRepository {
  constructor(private db: DatabaseClient) {}

  async create(intent: Omit<TransactionIntent, 'intentId' | 'createdAt'>): Promise<TransactionIntent> {
    const result = await this.db.query(
      `INSERT INTO intents (task_id, buyer_agent_id, worker_agent_id, recipient, amount, currency, network, capability, settlement_condition, policy_version, expires_at, nonce, intent_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [intent.taskId, intent.buyerAgentId, intent.workerAgentId, intent.recipient, intent.amount.toString(), intent.currency, intent.network, intent.capability, intent.settlementCondition, intent.policyVersion, intent.expiresAt, intent.nonce, intent.intentHash],
    );
    return this.mapIntent(result.rows[0]!);
  }

  async findByHash(hash: string): Promise<TransactionIntent | null> {
    const result = await this.db.query('SELECT * FROM intents WHERE intent_hash = $1', [hash]);
    if (result.rows.length === 0) return null;
    return this.mapIntent(result.rows[0]!);
  }

  async findByTaskId(taskId: string): Promise<TransactionIntent | null> {
    const result = await this.db.query('SELECT * FROM intents WHERE task_id = $1', [taskId]);
    if (result.rows.length === 0) return null;
    return this.mapIntent(result.rows[0]!);
  }

  private mapIntent(row: Record<string, unknown>): TransactionIntent {
    return {
      intentId: row['intent_id'] as string,
      taskId: row['task_id'] as string,
      buyerAgentId: row['buyer_agent_id'] as string,
      workerAgentId: row['worker_agent_id'] as string,
      recipient: row['recipient'] as string,
      amount: BigInt(row['amount'] as string),
      currency: row['currency'] as string,
      network: row['network'] as string,
      capability: row['capability'] as string,
      settlementCondition: row['settlement_condition'] as string,
      policyVersion: row['policy_version'] as number,
      expiresAt: new Date(row['expires_at'] as string),
      nonce: row['nonce'] as string,
      intentHash: row['intent_hash'] as string,
      createdAt: new Date(row['created_at'] as string),
    };
  }
}

// ─── Policy Repository ─────────────────────────────────────
export class PolicyRepository {
  constructor(private db: DatabaseClient) {}

  async create(policy: Omit<ExecutionPolicy, 'policyId' | 'createdAt' | 'updatedAt' | 'version' | 'currentCumulativeSpend' | 'currentExecutionCount'>): Promise<ExecutionPolicy> {
    const result = await this.db.query(
      `INSERT INTO policies (agent_id, max_single_payment, max_cumulative_spend, allowed_recipients, allowed_networks, minimum_reputation_score, required_capabilities, max_execution_count, require_outcome_verification, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [policy.agentId, policy.maxSinglePayment.toString(), policy.maxCumulativeSpend.toString(), policy.allowedRecipients, policy.allowedNetworks, policy.minimumReputationScore, policy.requiredCapabilities, policy.maxExecutionCount, policy.requireOutcomeVerification, policy.expiresAt],
    );
    return this.mapPolicy(result.rows[0]!);
  }

  async findById(policyId: string): Promise<ExecutionPolicy | null> {
    const result = await this.db.query('SELECT * FROM policies WHERE policy_id = $1', [policyId]);
    if (result.rows.length === 0) return null;
    return this.mapPolicy(result.rows[0]!);
  }

  async findAll(): Promise<ExecutionPolicy[]> {
    const result = await this.db.query('SELECT * FROM policies ORDER BY created_at DESC');
    return result.rows.map((r) => this.mapPolicy(r));
  }

  async incrementCumulativeSpend(policyId: string, amount: bigint): Promise<void> {
    await this.db.query(
      `UPDATE policies SET current_cumulative_spend = current_cumulative_spend + $2, current_execution_count = current_execution_count + 1, updated_at = NOW()
       WHERE policy_id = $1`,
      [policyId, amount.toString()],
    );
  }

  private mapPolicy(row: Record<string, unknown>): ExecutionPolicy {
    return {
      policyId: row['policy_id'] as string,
      agentId: row['agent_id'] as string,
      version: row['version'] as number,
      maxSinglePayment: BigInt(row['max_single_payment'] as string),
      maxCumulativeSpend: BigInt(row['max_cumulative_spend'] as string),
      currentCumulativeSpend: BigInt(row['current_cumulative_spend'] as string),
      allowedRecipients: row['allowed_recipients'] as string[],
      allowedNetworks: row['allowed_networks'] as string[],
      minimumReputationScore: row['minimum_reputation_score'] as number,
      requiredCapabilities: row['required_capabilities'] as string[],
      maxExecutionCount: row['max_execution_count'] as number,
      currentExecutionCount: row['current_execution_count'] as number,
      requireOutcomeVerification: row['require_outcome_verification'] as boolean,
      expiresAt: new Date(row['expires_at'] as string),
      createdAt: new Date(row['created_at'] as string),
      updatedAt: new Date(row['updated_at'] as string),
    };
  }
}

// ─── Escrow Repository ─────────────────────────────────────
export class EscrowRepository {
  constructor(private db: DatabaseClient) {}

  async create(escrow: Omit<Escrow, 'escrowId' | 'createdAt' | 'updatedAt'>): Promise<Escrow> {
    const result = await this.db.query(
      `INSERT INTO escrows (task_id, intent_hash, buyer, worker, recipient, token, amount, state, on_chain_escrow_id, transaction_hash, expiry)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [escrow.taskId, escrow.intentHash, escrow.buyer, escrow.worker, escrow.recipient, escrow.token, escrow.amount.toString(), escrow.state, escrow.onChainEscrowId?.toString() ?? null, escrow.transactionHash, escrow.expiry],
    );
    return this.mapEscrow(result.rows[0]!);
  }

  async findByTaskId(taskId: string): Promise<Escrow | null> {
    const result = await this.db.query('SELECT * FROM escrows WHERE task_id = $1', [taskId]);
    if (result.rows.length === 0) return null;
    return this.mapEscrow(result.rows[0]!);
  }

  async updateState(escrowId: string, state: Escrow['state'], txHash?: string): Promise<void> {
    const params: unknown[] = [escrowId, state];
    let sql = 'UPDATE escrows SET state = $2, updated_at = NOW()';
    if (txHash) {
      sql += ', transaction_hash = $3';
      params.push(txHash);
    }
    sql += ' WHERE escrow_id = $1';
    await this.db.query(sql, params);
  }

  private mapEscrow(row: Record<string, unknown>): Escrow {
    return {
      escrowId: row['escrow_id'] as string,
      taskId: row['task_id'] as string,
      intentHash: row['intent_hash'] as string,
      buyer: row['buyer'] as string,
      worker: row['worker'] as string,
      recipient: row['recipient'] as string,
      token: row['token'] as string,
      amount: BigInt(row['amount'] as string),
      state: row['state'] as Escrow['state'],
      onChainEscrowId: row['on_chain_escrow_id'] ? BigInt(row['on_chain_escrow_id'] as string) : null,
      transactionHash: (row['transaction_hash'] as string) ?? null,
      expiry: new Date(row['expiry'] as string),
      createdAt: new Date(row['created_at'] as string),
      updatedAt: new Date(row['updated_at'] as string),
    };
  }
}

// ─── Settlement Repository ─────────────────────────────────
export class SettlementRepository {
  constructor(private db: DatabaseClient) {}

  async create(settlement: Omit<Settlement, 'settlementId'>): Promise<Settlement> {
    const result = await this.db.query(
      `INSERT INTO settlements (task_id, intent_id, intent_hash, escrow_id, execution_id, amount, recipient, transaction_hash, block_number, network, status, settled_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [settlement.taskId, settlement.intentId, settlement.intentHash, settlement.escrowId, settlement.executionId, settlement.amount.toString(), settlement.recipient, settlement.transactionHash, settlement.blockNumber.toString(), settlement.network, settlement.status, settlement.settledAt],
    );
    return this.mapSettlement(result.rows[0]!);
  }

  async findByTaskId(taskId: string): Promise<Settlement | null> {
    const result = await this.db.query('SELECT * FROM settlements WHERE task_id = $1', [taskId]);
    if (result.rows.length === 0) return null;
    return this.mapSettlement(result.rows[0]!);
  }

  async existsForTask(taskId: string): Promise<boolean> {
    const result = await this.db.query(
      'SELECT 1 FROM settlements WHERE task_id = $1',
      [taskId],
    );
    return result.rows.length > 0;
  }

  private mapSettlement(row: Record<string, unknown>): Settlement {
    return {
      settlementId: row['settlement_id'] as string,
      taskId: row['task_id'] as string,
      intentId: row['intent_id'] as string,
      intentHash: row['intent_hash'] as string,
      escrowId: row['escrow_id'] as string,
      executionId: row['execution_id'] as string,
      amount: BigInt(row['amount'] as string),
      recipient: row['recipient'] as string,
      transactionHash: row['transaction_hash'] as string,
      blockNumber: BigInt(row['block_number'] as string),
      network: row['network'] as string,
      status: row['status'] as Settlement['status'],
      settledAt: new Date(row['settled_at'] as string),
    };
  }
}

// ─── Audit Repository ──────────────────────────────────────
export class AuditRepository {
  constructor(private db: DatabaseClient) {}

  async create(event: Omit<AuditEvent, 'eventId'>): Promise<AuditEvent> {
    const result = await this.db.query(
      `INSERT INTO audit_events (task_id, intent_id, execution_id, event_type, actor_type, actor_id, timestamp, payload_hash, previous_event_hash, event_hash, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [event.taskId, event.intentId, event.executionId, event.eventType, event.actorType, event.actorId, event.timestamp, event.payloadHash, event.previousEventHash, event.eventHash, JSON.stringify(event.metadata)],
    );
    return this.mapAuditEvent(result.rows[0]!);
  }

  async findByTaskId(taskId: string): Promise<AuditEvent[]> {
    const result = await this.db.query(
      'SELECT * FROM audit_events WHERE task_id = $1 ORDER BY timestamp ASC',
      [taskId],
    );
    return result.rows.map((r) => this.mapAuditEvent(r));
  }

  async getLastEventForTask(taskId: string): Promise<AuditEvent | null> {
    const result = await this.db.query(
      'SELECT * FROM audit_events WHERE task_id = $1 ORDER BY timestamp DESC LIMIT 1',
      [taskId],
    );
    if (result.rows.length === 0) return null;
    return this.mapAuditEvent(result.rows[0]!);
  }

  async findAll(limit = 50, offset = 0): Promise<AuditEvent[]> {
    const result = await this.db.query(
      'SELECT * FROM audit_events ORDER BY timestamp DESC LIMIT $1 OFFSET $2',
      [limit, offset],
    );
    return result.rows.map((r) => this.mapAuditEvent(r));
  }

  private mapAuditEvent(row: Record<string, unknown>): AuditEvent {
    return {
      eventId: row['event_id'] as string,
      taskId: row['task_id'] as string,
      intentId: (row['intent_id'] as string) ?? null,
      executionId: (row['execution_id'] as string) ?? null,
      eventType: row['event_type'] as AuditEvent['eventType'],
      actorType: row['actor_type'] as AuditEvent['actorType'],
      actorId: row['actor_id'] as string,
      timestamp: new Date(row['timestamp'] as string),
      payloadHash: row['payload_hash'] as string,
      previousEventHash: row['previous_event_hash'] as string,
      eventHash: row['event_hash'] as string,
      metadata: (row['metadata'] as Record<string, unknown>) ?? {},
    };
  }
}

// ─── Reputation Repository ─────────────────────────────────
export class ReputationRepository {
  constructor(private db: DatabaseClient) {}

  async createEvent(event: Omit<ReputationEvent, 'eventId'>): Promise<void> {
    await this.db.query(
      `INSERT INTO reputation_events (agent_id, task_id, event_type, settlement_tx_hash)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (agent_id, task_id, event_type) DO NOTHING`,
      [event.agentId, event.taskId, event.eventType, event.settlementTxHash],
    );
  }

  async getEvents(agentId: string): Promise<ReputationEvent[]> {
    const result = await this.db.query(
      'SELECT * FROM reputation_events WHERE agent_id = $1 ORDER BY created_at DESC',
      [agentId],
    );
    return result.rows.map((r) => ({
      eventId: r['event_id'] as string,
      agentId: r['agent_id'] as string,
      taskId: r['task_id'] as string,
      eventType: r['event_type'] as ReputationEvent['eventType'],
      settlementTxHash: (r['settlement_tx_hash'] as string) ?? null,
      createdAt: new Date(r['created_at'] as string),
    }));
  }

  async saveSnapshot(snapshot: Omit<ReputationSnapshot, 'snapshotId'>): Promise<void> {
    await this.db.query(
      `INSERT INTO reputation_snapshots (agent_id, capability, overall_score, completion_rate, successful_settlement_rate, verification_success_rate, dispute_rate, recent_activity, capability_reliability, task_volume, calculated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [snapshot.agentId, snapshot.capability, snapshot.overallScore, snapshot.completionRate, snapshot.successfulSettlementRate, snapshot.verificationSuccessRate, snapshot.disputeRate, snapshot.recentActivity, snapshot.capabilityReliability, snapshot.taskVolume, snapshot.calculatedAt],
    );
  }

  async getLatestSnapshot(agentId: string, capability = '*'): Promise<ReputationSnapshot | null> {
    const result = await this.db.query(
      `SELECT * FROM reputation_snapshots WHERE agent_id = $1 AND capability = $2 ORDER BY calculated_at DESC LIMIT 1`,
      [agentId, capability],
    );
    if (result.rows.length === 0) return null;
    const r = result.rows[0]!;
    return {
      snapshotId: r['snapshot_id'] as string,
      agentId: r['agent_id'] as string,
      capability: r['capability'] as string,
      overallScore: parseFloat(r['overall_score'] as string),
      completionRate: parseFloat(r['completion_rate'] as string),
      successfulSettlementRate: parseFloat(r['successful_settlement_rate'] as string),
      verificationSuccessRate: parseFloat(r['verification_success_rate'] as string),
      disputeRate: parseFloat(r['dispute_rate'] as string),
      recentActivity: parseFloat(r['recent_activity'] as string),
      capabilityReliability: parseFloat(r['capability_reliability'] as string),
      taskVolume: r['task_volume'] as number,
      calculatedAt: new Date(r['calculated_at'] as string),
    };
  }
}

// ─── Execution Repository ──────────────────────────────────
export class ExecutionRepository {
  constructor(private db: DatabaseClient) {}

  async create(execution: Omit<Execution, 'executionId' | 'createdAt' | 'updatedAt'>): Promise<Execution> {
    const result = await this.db.query(
      `INSERT INTO executions (task_id, intent_id, intent_hash, keeperhub_workflow_id, keeperhub_execution_id, status, dry_run_result)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [execution.taskId, execution.intentId, execution.intentHash, execution.keeperHubWorkflowId, execution.keeperHubExecutionId, execution.status, execution.dryRunResult ? JSON.stringify(execution.dryRunResult) : null],
    );
    return this.mapExecution(result.rows[0]!);
  }

  async findByTaskId(taskId: string): Promise<Execution | null> {
    const result = await this.db.query('SELECT * FROM executions WHERE task_id = $1 ORDER BY created_at DESC LIMIT 1', [taskId]);
    if (result.rows.length === 0) return null;
    return this.mapExecution(result.rows[0]!);
  }

  async findAll(limit = 20, offset = 0): Promise<Execution[]> {
    const result = await this.db.query(
      'SELECT * FROM executions ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset],
    );
    return result.rows.map((r) => this.mapExecution(r));
  }

  async updateStatus(executionId: string, status: Execution['status'], updates: Record<string, unknown> = {}): Promise<void> {
    const setClauses = ['status = $2', 'updated_at = NOW()'];
    const values: unknown[] = [executionId, status];
    let paramIndex = 3;
    for (const [key, value] of Object.entries(updates)) {
      setClauses.push(`${key} = $${paramIndex}`);
      values.push(typeof value === 'object' ? JSON.stringify(value) : value);
      paramIndex++;
    }
    await this.db.query(
      `UPDATE executions SET ${setClauses.join(', ')} WHERE execution_id = $1`,
      values,
    );
  }

  private mapExecution(row: Record<string, unknown>): Execution {
    return {
      executionId: row['execution_id'] as string,
      taskId: row['task_id'] as string,
      intentId: row['intent_id'] as string,
      intentHash: row['intent_hash'] as string,
      keeperHubWorkflowId: (row['keeperhub_workflow_id'] as string) ?? null,
      keeperHubExecutionId: (row['keeperhub_execution_id'] as string) ?? null,
      status: row['status'] as Execution['status'],
      dryRunResult: (row['dry_run_result'] as Record<string, unknown>) ?? null,
      createdAt: new Date(row['created_at'] as string),
      updatedAt: new Date(row['updated_at'] as string),
    };
  }
}

// ─── Idempotency Repository ───────────────────────────────
export class IdempotencyRepository {
  constructor(private db: DatabaseClient) {}

  async find(key: string): Promise<IdempotencyRecord | null> {
    const result = await this.db.query(
      'SELECT * FROM idempotency_keys WHERE key = $1 AND expires_at > NOW()',
      [key],
    );
    if (result.rows.length === 0) return null;
    const r = result.rows[0]!;
    return {
      key: r['key'] as string,
      endpoint: r['endpoint'] as string,
      statusCode: r['status_code'] as number,
      responseBody: r['response_body'] as string,
      createdAt: new Date(r['created_at'] as string),
      expiresAt: new Date(r['expires_at'] as string),
    };
  }

  async save(record: IdempotencyRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO idempotency_keys (key, endpoint, status_code, response_body, created_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (key) DO NOTHING`,
      [record.key, record.endpoint, record.statusCode, record.responseBody, record.createdAt, record.expiresAt],
    );
  }

  async cleanup(): Promise<void> {
    await this.db.query('DELETE FROM idempotency_keys WHERE expires_at < NOW()');
  }
}

// ─── Verification Repository ───────────────────────────────
export class VerificationRepository {
  constructor(private db: DatabaseClient) {}

  async create(v: Omit<Verification, 'verificationId'>): Promise<Verification> {
    const result = await this.db.query(
      `INSERT INTO verifications (task_id, verifier_id, status, criteria, evidence_hash, reason, verified_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [v.taskId, v.verifierId, v.status, v.criteria, v.evidenceHash, v.reason, v.verifiedAt],
    );
    const r = result.rows[0]!;
    return {
      verificationId: r['verification_id'] as string,
      taskId: r['task_id'] as string,
      verifierId: r['verifier_id'] as string,
      status: r['status'] as Verification['status'],
      criteria: r['criteria'] as string,
      evidenceHash: r['evidence_hash'] as string,
      reason: r['reason'] as string,
      verifiedAt: new Date(r['verified_at'] as string),
    };
  }

  async findByTaskId(taskId: string): Promise<Verification | null> {
    const result = await this.db.query('SELECT * FROM verifications WHERE task_id = $1', [taskId]);
    if (result.rows.length === 0) return null;
    const r = result.rows[0]!;
    return {
      verificationId: r['verification_id'] as string,
      taskId: r['task_id'] as string,
      verifierId: r['verifier_id'] as string,
      status: r['status'] as Verification['status'],
      criteria: r['criteria'] as string,
      evidenceHash: r['evidence_hash'] as string,
      reason: r['reason'] as string,
      verifiedAt: new Date(r['verified_at'] as string),
    };
  }
}

// ─── Capability Repository ─────────────────────────────────
export class CapabilityRepository {
  constructor(private db: DatabaseClient) {}

  async create(agentId: string, cap: { capability: string; description: string; price: bigint; currency: string }): Promise<void> {
    await this.db.query(
      `INSERT INTO agent_capabilities (agent_id, capability, description, price, currency)
       VALUES ($1, $2, $3, $4, $5)`,
      [agentId, cap.capability, cap.description, cap.price.toString(), cap.currency],
    );
  }

  async findByAgentId(agentId: string): Promise<import('@sovereign/domain').AgentCapability[]> {
    const result = await this.db.query(
      'SELECT * FROM agent_capabilities WHERE agent_id = $1',
      [agentId],
    );
    return result.rows.map((r) => ({
      capabilityId: r['capability_id'] as string,
      agentId: r['agent_id'] as string,
      capability: r['capability'] as string,
      description: r['description'] as string,
      price: BigInt(r['price'] as string),
      currency: r['currency'] as string,
      createdAt: new Date(r['created_at'] as string),
    }));
  }
}
