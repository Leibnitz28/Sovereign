# SOVEREIGN — Trust & Deterministic Settlement Layer for Autonomous Agent Commerce

> **AI agents are probabilistic decision-makers. Money movement must be deterministic.**

Sovereign is a production-grade infrastructure platform that allows autonomous buyer agents to discover and hire worker agents, evaluate their identity and reputation, enforce deterministic spending and execution guardrails, lock funds in on-chain smart contract escrow, and execute verifiable settlements via **KeeperHub** on **Base Sepolia**.

---

## Key Features

1. **Deterministic Policy Engine**: Pure, mathematical policy evaluation (max spend cap, cumulative limits, allowlists, reputation floors). Zero LLM hallucinations in financial execution.
2. **Canonical Intent Binding**: All commercial terms are serialized into a canonical string and hashed with `keccak256`. Funds cannot move if any parameter changes by a single bit.
3. **16-State Guarded Finite State Machine**: Strict state transitions from `CREATED` to `COMPLETED`, preventing premature releases or skipped steps.
4. **SovereignEscrow Smart Contract**: OpenZeppelin-backed ERC-20 escrow on Base Sepolia (`0x036CbD53842c5426634e7929541eC2318f3dCF7e` USDC). Rejects mismatched recipients, expired settlements, unauthorized callers, or replayed intents.
5. **KeeperHub Workflow Execution**: End-to-end orchestration: validation → dry-run simulation → execution → real-time monitoring.
6. **Transparent Formula-Based Reputation**: Explainable weighted score across 6 factors with Sybil anti-gaming defenses.
7. **Cryptographic Hash-Chained Audit Trail**: SHA-256 tamper-evident log chaining each event to the previous event hash.
8. **Security Lab (8 Attack Scenarios)**: Interactive simulator demonstrating 100% defense against prompt injections, parameter mutations, and replay attacks.

---

## Architecture

```
Probabilistic AI Buyer ──▶ [ Sovereign Policy Engine ] ──▶ [ Keccak256 Intent Engine ]
                                        │
                                        ▼
                              [ SovereignEscrow.sol ]
                              Base Sepolia Testnet
                                        │
                                        ▼
   Worker Delivers Work ──▶ [ Verification Engine ] ──▶ [ KeeperHub Settlement ]
```

---

## Quick Start

### 1. Prerequisites
- Node.js >= 20
- pnpm >= 9
- Docker & Docker Compose (for PostgreSQL + Redis)
- Foundry (`forge`) for smart contract verification

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Start Infrastructure & Migrate Database
```bash
docker compose up -d
pnpm db:migrate
pnpm db:seed
```

### 4. Run All Services
```bash
# Start API (port 3001) & Web Control Plane (port 3000)
pnpm dev
```

- Control Plane Dashboard: [http://localhost:3000](http://localhost:3000)
- REST API Server: [http://localhost:3001](http://localhost:3001)
- Interactive Security Lab: [http://localhost:3000/security-lab](http://localhost:3000/security-lab)

---

## Automated Test Suites

### Run All Unit & Integration Tests (Vitest)
```bash
pnpm test
```

### Run Property-Based Fuzz Tests (fast-check)
```bash
pnpm test:fuzz
```

### Run Foundry Smart Contract Tests
```bash
pnpm contracts:test
```

---

## Running Autonomous Agents

### Run Buyer Agent Scenario
```bash
pnpm --filter @sovereign/agent start
```

### Run Worker Agent Daemon
```bash
pnpm --filter @sovereign/worker start
```

---

## Security Lab: 8 Attack Scenarios Defended

1. **Budget Overflow**: Injection attempts to commit $50 vs $10 policy limit (`POLICY_VIOLATION`).
2. **Recipient Hijack**: Malicious substitution of worker wallet to attacker address (`RECIPIENT_MISMATCH`).
3. **Intent Tampering**: Mutating parameters post-agreement (`INTENT_HASH_MISMATCH`).
4. **Replay Attack**: Re-submitting a previously settled intent (`INTENT_ALREADY_USED`).
5. **Premature Release**: Attempting settlement prior to verification (`INVALID_STATE_TRANSITION`).
6. **Reputation Sybil Gaming**: Self-attestation and cyclic wash trades (`REPUTATION_GAMING_DETECTED`).
7. **Untrusted Worker**: Forcing worker below required reputation floor (`REPUTATION_TOO_LOW`).
8. **Expired Intent**: Attempting settlement past the SLA window (`ESCROW_EXPIRED`).

---

## License
MIT
