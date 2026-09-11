// ============================================================
// SOVEREIGN — Seed Data
// ============================================================
// Deterministic seed data for local development and demos.
import type { DatabaseClient } from './client.js';

export async function seedDatabase(db: DatabaseClient): Promise<void> {
  console.log('🌱 Seeding database...');

  // ─── Buyer Agent ───────────────────────────────────────
  await db.query(
    `INSERT INTO agents (agent_id, wallet_address, display_name, identity_source, status)
     VALUES ('a0000000-0000-0000-0000-000000000001', '0x1111111111111111111111111111111111111111', 'Buyer Agent Alpha', 'self-declared', 'active')
     ON CONFLICT (agent_id) DO NOTHING RETURNING agent_id`,
    [],
  );

  // ─── High-Reputation Worker ────────────────────────────
  await db.query(
    `INSERT INTO agents (agent_id, wallet_address, display_name, identity_source, status)
     VALUES ('a0000000-0000-0000-0000-000000000002', '0x2222222222222222222222222222222222222222', 'DocProcessor Pro', 'verified-external', 'active')
     ON CONFLICT (agent_id) DO NOTHING`,
    [],
  );

  await db.query(
    `INSERT INTO agent_capabilities (agent_id, capability, description, price, currency)
     VALUES ('a0000000-0000-0000-0000-000000000002', 'document-processing', 'High-volume document processing and analysis', 8000000, 'USDC')
     ON CONFLICT DO NOTHING`,
    [],
  );

  // ─── Low-Reputation Worker ─────────────────────────────
  await db.query(
    `INSERT INTO agents (agent_id, wallet_address, display_name, identity_source, status)
     VALUES ('a0000000-0000-0000-0000-000000000003', '0x3333333333333333333333333333333333333333', 'Budget Processor', 'self-declared', 'active')
     ON CONFLICT (agent_id) DO NOTHING`,
    [],
  );

  await db.query(
    `INSERT INTO agent_capabilities (agent_id, capability, description, price, currency)
     VALUES ('a0000000-0000-0000-0000-000000000003', 'document-processing', 'Basic document processing', 5000000, 'USDC')
     ON CONFLICT DO NOTHING`,
    [],
  );

  // ─── Expensive Worker ──────────────────────────────────
  await db.query(
    `INSERT INTO agents (agent_id, wallet_address, display_name, identity_source, status)
     VALUES ('a0000000-0000-0000-0000-000000000004', '0x4444444444444444444444444444444444444444', 'Premium Processor', 'erc-8004', 'active')
     ON CONFLICT (agent_id) DO NOTHING`,
    [],
  );

  await db.query(
    `INSERT INTO agent_capabilities (agent_id, capability, description, price, currency)
     VALUES ('a0000000-0000-0000-0000-000000000004', 'document-processing', 'Premium document processing with guaranteed SLA', 12000000, 'USDC')
     ON CONFLICT DO NOTHING`,
    [],
  );

  // ─── Verifier Agent ────────────────────────────────────
  await db.query(
    `INSERT INTO agents (agent_id, wallet_address, display_name, identity_source, status)
     VALUES ('a0000000-0000-0000-0000-000000000005', '0x5555555555555555555555555555555555555555', 'Outcome Verifier', 'verified-external', 'active')
     ON CONFLICT (agent_id) DO NOTHING`,
    [],
  );

  // ─── Reputation Snapshots ──────────────────────────────
  // High-rep worker: score 97
  await db.query(
    `INSERT INTO reputation_snapshots (agent_id, capability, overall_score, completion_rate, successful_settlement_rate, verification_success_rate, dispute_rate, recent_activity, capability_reliability, task_volume)
     VALUES ('a0000000-0000-0000-0000-000000000002', 'document-processing', 97, 0.98, 0.97, 0.96, 0.01, 0.95, 0.98, 150)
     ON CONFLICT DO NOTHING`,
    [],
  );

  // Low-rep worker: score 82
  await db.query(
    `INSERT INTO reputation_snapshots (agent_id, capability, overall_score, completion_rate, successful_settlement_rate, verification_success_rate, dispute_rate, recent_activity, capability_reliability, task_volume)
     VALUES ('a0000000-0000-0000-0000-000000000003', 'document-processing', 82, 0.80, 0.75, 0.78, 0.08, 0.85, 0.80, 30)
     ON CONFLICT DO NOTHING`,
    [],
  );

  // Premium worker: score 99
  await db.query(
    `INSERT INTO reputation_snapshots (agent_id, capability, overall_score, completion_rate, successful_settlement_rate, verification_success_rate, dispute_rate, recent_activity, capability_reliability, task_volume)
     VALUES ('a0000000-0000-0000-0000-000000000004', 'document-processing', 99, 0.99, 0.99, 0.99, 0.00, 0.98, 0.99, 500)
     ON CONFLICT DO NOTHING`,
    [],
  );

  // ─── Test Policy ───────────────────────────────────────
  await db.query(
    `INSERT INTO policies (policy_id, agent_id, version, max_single_payment, max_cumulative_spend, allowed_recipients, allowed_networks, minimum_reputation_score, required_capabilities, max_execution_count, require_outcome_verification, expires_at)
     VALUES ('p0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 1, 10000000, 50000000, ARRAY['0x2222222222222222222222222222222222222222','0x4444444444444444444444444444444444444444'], ARRAY['base-sepolia'], 90, ARRAY['document-processing'], 10, TRUE, NOW() + INTERVAL '30 days')
     ON CONFLICT (policy_id) DO NOTHING`,
    [],
  );

  console.log('✅ Database seeded successfully');
}
