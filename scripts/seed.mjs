import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://sovereign:sovereign@localhost:5432/sovereign';

async function seed() {
  console.log('🌱 Seeding database...');
  const pool = new pg.Pool({ connectionString: DATABASE_URL });

  const client = {
    query: (text, params) => pool.query(text, params),
  };

  try {
    // ─── Buyer Agent ───────────────────────────────────────
    await client.query(
      `INSERT INTO agents (agent_id, wallet_address, display_name, identity_source, status)
       VALUES ('a0000000-0000-0000-0000-000000000001', '0x1111111111111111111111111111111111111111', 'Buyer Agent Alpha', 'self-declared', 'active')
       ON CONFLICT (agent_id) DO NOTHING`
    );

    // ─── High-Reputation Worker ────────────────────────────
    await client.query(
      `INSERT INTO agents (agent_id, wallet_address, display_name, identity_source, status)
       VALUES ('a0000000-0000-0000-0000-000000000002', '0x2222222222222222222222222222222222222222', 'DocProcessor Pro', 'verified-external', 'active')
       ON CONFLICT (agent_id) DO NOTHING`
    );

    await client.query(
      `INSERT INTO agent_capabilities (agent_id, capability, description, price, currency)
       VALUES ('a0000000-0000-0000-0000-000000000002', 'document-processing', 'High-volume document processing and analysis', 8000000, 'USDC')
       ON CONFLICT DO NOTHING`
    );

    // ─── Low-Reputation Worker ─────────────────────────────
    await client.query(
      `INSERT INTO agents (agent_id, wallet_address, display_name, identity_source, status)
       VALUES ('a0000000-0000-0000-0000-000000000003', '0x3333333333333333333333333333333333333333', 'Budget Processor', 'self-declared', 'active')
       ON CONFLICT (agent_id) DO NOTHING`
    );

    await client.query(
      `INSERT INTO agent_capabilities (agent_id, capability, description, price, currency)
       VALUES ('a0000000-0000-0000-0000-000000000003', 'document-processing', 'Basic document processing', 5000000, 'USDC')
       ON CONFLICT DO NOTHING`
    );

    // ─── Expensive Worker ──────────────────────────────────
    await client.query(
      `INSERT INTO agents (agent_id, wallet_address, display_name, identity_source, status)
       VALUES ('a0000000-0000-0000-0000-000000000004', '0x4444444444444444444444444444444444444444', 'Premium Processor', 'erc-8004', 'active')
       ON CONFLICT (agent_id) DO NOTHING`
    );

    await client.query(
      `INSERT INTO agent_capabilities (agent_id, capability, description, price, currency)
       VALUES ('a0000000-0000-0000-0000-000000000004', 'document-processing', 'Premium document processing with guaranteed SLA', 12000000, 'USDC')
       ON CONFLICT DO NOTHING`
    );

    // ─── Seed Policies ─────────────────────────────────────
    await client.query(
      `INSERT INTO policies (policy_id, agent_id, max_single_spend, cumulative_spend_limit, current_cumulative_spend, allowed_currencies, allowed_networks, min_worker_reputation, require_verification, settlement_timeout_seconds)
       VALUES ('p0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 10000000, 50000000, 0, '["USDC"]', '["base-sepolia", "ethereum-sepolia"]', 90, true, 3600)
       ON CONFLICT (policy_id) DO NOTHING`
    );

    // ─── Seed Reputation Snapshots ─────────────────────────
    await client.query(
      `INSERT INTO reputation_snapshots (agent_id, capability, overall_score, total_tasks, completed_tasks, dispute_count, verified_percentage)
       VALUES 
        ('a0000000-0000-0000-0000-000000000002', 'document-processing', 97.5, 120, 118, 0, 98.3),
        ('a0000000-0000-0000-0000-000000000003', 'document-processing', 82.0, 45, 38, 3, 84.4),
        ('a0000000-0000-0000-0000-000000000004', 'document-processing', 99.0, 250, 249, 0, 99.6)
       ON CONFLICT DO NOTHING`
    );

    console.log('✅ Seed completed successfully.');
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
