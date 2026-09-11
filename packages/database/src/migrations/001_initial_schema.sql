-- ============================================================
-- SOVEREIGN — Database Schema Migration 001
-- ============================================================
-- All financially critical fields use BIGINT (atomic USDC units).
-- Proper constraints enforce data integrity.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Agents ────────────────────────────────────────────────
CREATE TABLE agents (
  agent_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address VARCHAR(42) NOT NULL,
  display_name   VARCHAR(100) NOT NULL,
  identity_source VARCHAR(30) NOT NULL DEFAULT 'self-declared',
  status         VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_identity_source CHECK (identity_source IN ('self-declared','erc-8004','verified-external','daydreams')),
  CONSTRAINT chk_agent_status CHECK (status IN ('active','suspended','deactivated'))
);

CREATE INDEX idx_agents_wallet ON agents(wallet_address);

-- ─── Agent Capabilities ────────────────────────────────────
CREATE TABLE agent_capabilities (
  capability_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id      UUID NOT NULL REFERENCES agents(agent_id),
  capability    VARCHAR(100) NOT NULL,
  description   VARCHAR(500) NOT NULL,
  price         BIGINT NOT NULL,
  currency      VARCHAR(10) NOT NULL DEFAULT 'USDC',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_price_positive CHECK (price > 0)
);

CREATE INDEX idx_capabilities_agent ON agent_capabilities(agent_id);
CREATE INDEX idx_capabilities_cap ON agent_capabilities(capability);

-- ─── Policies ──────────────────────────────────────────────
CREATE TABLE policies (
  policy_id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id                    UUID NOT NULL REFERENCES agents(agent_id),
  version                     INTEGER NOT NULL DEFAULT 1,
  max_single_payment          BIGINT NOT NULL,
  max_cumulative_spend        BIGINT NOT NULL,
  current_cumulative_spend    BIGINT NOT NULL DEFAULT 0,
  allowed_recipients          TEXT[] NOT NULL DEFAULT '{}',
  allowed_networks            TEXT[] NOT NULL DEFAULT '{base-sepolia}',
  minimum_reputation_score    INTEGER NOT NULL DEFAULT 0,
  required_capabilities       TEXT[] NOT NULL DEFAULT '{}',
  max_execution_count         INTEGER NOT NULL DEFAULT 100,
  current_execution_count     INTEGER NOT NULL DEFAULT 0,
  require_outcome_verification BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at                  TIMESTAMPTZ NOT NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_max_single_positive CHECK (max_single_payment > 0),
  CONSTRAINT chk_max_cumulative_positive CHECK (max_cumulative_spend > 0),
  CONSTRAINT chk_cumulative_within_max CHECK (current_cumulative_spend <= max_cumulative_spend)
);

-- ─── Tasks ─────────────────────────────────────────────────
CREATE TABLE tasks (
  task_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_agent_id   UUID NOT NULL REFERENCES agents(agent_id),
  worker_agent_id  UUID REFERENCES agents(agent_id),
  capability       VARCHAR(100) NOT NULL,
  description      TEXT NOT NULL,
  max_budget       BIGINT NOT NULL,
  currency         VARCHAR(10) NOT NULL DEFAULT 'USDC',
  network          VARCHAR(30) NOT NULL DEFAULT 'base-sepolia',
  minimum_reputation INTEGER NOT NULL DEFAULT 0,
  deadline         TIMESTAMPTZ NOT NULL,
  state            VARCHAR(30) NOT NULL DEFAULT 'CREATED',
  policy_id        UUID NOT NULL REFERENCES policies(policy_id),
  intent_id        UUID,
  escrow_id        UUID,
  verification_id  UUID,
  settlement_id    UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_budget_positive CHECK (max_budget > 0)
);

CREATE INDEX idx_tasks_buyer ON tasks(buyer_agent_id);
CREATE INDEX idx_tasks_worker ON tasks(worker_agent_id);
CREATE INDEX idx_tasks_state ON tasks(state);

-- ─── Intents ───────────────────────────────────────────────
CREATE TABLE intents (
  intent_id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id             UUID NOT NULL REFERENCES tasks(task_id),
  buyer_agent_id      UUID NOT NULL REFERENCES agents(agent_id),
  worker_agent_id     UUID NOT NULL REFERENCES agents(agent_id),
  recipient           VARCHAR(42) NOT NULL,
  amount              BIGINT NOT NULL,
  currency            VARCHAR(10) NOT NULL DEFAULT 'USDC',
  network             VARCHAR(30) NOT NULL DEFAULT 'base-sepolia',
  capability          VARCHAR(100) NOT NULL,
  settlement_condition TEXT NOT NULL,
  policy_version      INTEGER NOT NULL,
  expires_at          TIMESTAMPTZ NOT NULL,
  nonce               VARCHAR(66) NOT NULL,
  intent_hash         VARCHAR(66) NOT NULL UNIQUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_intent_amount_positive CHECK (amount > 0)
);

CREATE UNIQUE INDEX idx_intents_hash ON intents(intent_hash);

-- ─── Policy Decisions ──────────────────────────────────────
CREATE TABLE policy_decisions (
  decision_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  intent_id      UUID NOT NULL REFERENCES intents(intent_id),
  policy_id      UUID NOT NULL REFERENCES policies(policy_id),
  policy_version INTEGER NOT NULL,
  approved       BOOLEAN NOT NULL,
  reasons        TEXT[] NOT NULL DEFAULT '{}',
  intent_hash    VARCHAR(66) NOT NULL,
  evaluated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Escrows ───────────────────────────────────────────────
CREATE TABLE escrows (
  escrow_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id            UUID NOT NULL REFERENCES tasks(task_id) UNIQUE,
  intent_hash        VARCHAR(66) NOT NULL,
  buyer              VARCHAR(42) NOT NULL,
  worker             VARCHAR(42) NOT NULL,
  recipient          VARCHAR(42) NOT NULL,
  token              VARCHAR(42) NOT NULL,
  amount             BIGINT NOT NULL,
  state              VARCHAR(20) NOT NULL DEFAULT 'pending',
  on_chain_escrow_id BIGINT,
  transaction_hash   VARCHAR(66),
  expiry             TIMESTAMPTZ NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_escrow_amount_positive CHECK (amount > 0),
  CONSTRAINT chk_escrow_state CHECK (state IN ('pending','funded','released','refunded','cancelled','expired'))
);

-- ─── Verifications ─────────────────────────────────────────
CREATE TABLE verifications (
  verification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id         UUID NOT NULL REFERENCES tasks(task_id) UNIQUE,
  verifier_id     UUID NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  criteria        TEXT NOT NULL,
  evidence_hash   VARCHAR(66) NOT NULL DEFAULT '',
  reason          TEXT NOT NULL DEFAULT '',
  verified_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_verification_status CHECK (status IN ('pending','passed','failed','disputed'))
);

-- ─── Settlements ───────────────────────────────────────────
CREATE TABLE settlements (
  settlement_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id          UUID NOT NULL REFERENCES tasks(task_id) UNIQUE,
  intent_id        UUID NOT NULL REFERENCES intents(intent_id),
  intent_hash      VARCHAR(66) NOT NULL,
  escrow_id        UUID NOT NULL REFERENCES escrows(escrow_id),
  execution_id     UUID NOT NULL,
  amount           BIGINT NOT NULL,
  recipient        VARCHAR(42) NOT NULL,
  transaction_hash VARCHAR(66) NOT NULL UNIQUE,
  block_number     BIGINT NOT NULL DEFAULT 0,
  network          VARCHAR(30) NOT NULL DEFAULT 'base-sepolia',
  status           VARCHAR(20) NOT NULL DEFAULT 'pending',
  settled_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_settlement_status CHECK (status IN ('pending','confirmed','failed','reverted')),
  CONSTRAINT chk_settlement_amount_positive CHECK (amount > 0)
);

CREATE UNIQUE INDEX idx_settlements_tx ON settlements(transaction_hash);

-- ─── Executions ────────────────────────────────────────────
CREATE TABLE executions (
  execution_id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id                 UUID NOT NULL REFERENCES tasks(task_id),
  intent_id               UUID NOT NULL REFERENCES intents(intent_id),
  intent_hash             VARCHAR(66) NOT NULL,
  keeperhub_workflow_id   VARCHAR(200),
  keeperhub_execution_id  VARCHAR(200),
  status                  VARCHAR(20) NOT NULL DEFAULT 'pending',
  dry_run_result          JSONB,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_execution_status CHECK (status IN ('pending','validating','dry-run','authorized','executing','monitoring','completed','failed','cancelled'))
);

-- ─── Execution Attempts ────────────────────────────────────
CREATE TABLE execution_attempts (
  attempt_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  execution_id   UUID NOT NULL REFERENCES executions(execution_id),
  attempt_number INTEGER NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'success',
  error_code     VARCHAR(50),
  error_message  TEXT,
  latency_ms     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_attempt_status CHECK (status IN ('success','failure','timeout'))
);

-- ─── Reputation Events ─────────────────────────────────────
CREATE TABLE reputation_events (
  event_id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id           UUID NOT NULL REFERENCES agents(agent_id),
  task_id            UUID NOT NULL REFERENCES tasks(task_id),
  event_type         VARCHAR(30) NOT NULL,
  settlement_tx_hash VARCHAR(66),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_rep_event_type CHECK (event_type IN ('task_completed','task_failed','verification_passed','verification_failed','dispute_filed','dispute_resolved','settlement_confirmed','settlement_failed'))
);

-- Prevent duplicate reputation events for the same task
CREATE UNIQUE INDEX idx_rep_events_unique ON reputation_events(agent_id, task_id, event_type);

-- ─── Reputation Snapshots ──────────────────────────────────
CREATE TABLE reputation_snapshots (
  snapshot_id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id                 UUID NOT NULL REFERENCES agents(agent_id),
  capability               VARCHAR(100) NOT NULL DEFAULT '*',
  overall_score            NUMERIC(5,2) NOT NULL DEFAULT 50.0,
  completion_rate          NUMERIC(5,4) NOT NULL DEFAULT 0.0,
  successful_settlement_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0,
  verification_success_rate  NUMERIC(5,4) NOT NULL DEFAULT 0.0,
  dispute_rate             NUMERIC(5,4) NOT NULL DEFAULT 0.0,
  recent_activity          NUMERIC(5,4) NOT NULL DEFAULT 0.0,
  capability_reliability   NUMERIC(5,4) NOT NULL DEFAULT 0.0,
  task_volume              INTEGER NOT NULL DEFAULT 0,
  calculated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rep_snapshots_agent ON reputation_snapshots(agent_id, capability);

-- ─── Audit Events ──────────────────────────────────────────
CREATE TABLE audit_events (
  event_id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id            UUID NOT NULL,
  intent_id          UUID,
  execution_id       UUID,
  event_type         VARCHAR(50) NOT NULL,
  actor_type         VARCHAR(20) NOT NULL,
  actor_id           VARCHAR(100) NOT NULL,
  timestamp          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload_hash       VARCHAR(66) NOT NULL,
  previous_event_hash VARCHAR(66) NOT NULL DEFAULT '0x0000000000000000000000000000000000000000000000000000000000000000',
  event_hash         VARCHAR(66) NOT NULL,
  metadata           JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT chk_actor_type CHECK (actor_type IN ('buyer-agent','worker-agent','system','verifier','keeperhub','blockchain'))
);

CREATE INDEX idx_audit_task ON audit_events(task_id);
CREATE INDEX idx_audit_timestamp ON audit_events(timestamp);

-- ─── Idempotency Keys ─────────────────────────────────────
CREATE TABLE idempotency_keys (
  key            VARCHAR(200) PRIMARY KEY,
  endpoint       VARCHAR(200) NOT NULL,
  status_code    INTEGER NOT NULL,
  response_body  TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_idem_expires ON idempotency_keys(expires_at);

-- ─── Risk Signals ──────────────────────────────────────────
CREATE TABLE risk_signals (
  signal_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id     UUID NOT NULL REFERENCES tasks(task_id),
  signal_type VARCHAR(50) NOT NULL,
  severity    VARCHAR(20) NOT NULL,
  description TEXT NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_severity CHECK (severity IN ('low','medium','high','critical'))
);

-- ─── Disputes ──────────────────────────────────────────────
CREATE TABLE disputes (
  dispute_id  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id     UUID NOT NULL REFERENCES tasks(task_id),
  filed_by    UUID NOT NULL REFERENCES agents(agent_id),
  reason      TEXT NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'open',
  resolution  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  CONSTRAINT chk_dispute_status CHECK (status IN ('open','resolved','dismissed'))
);
