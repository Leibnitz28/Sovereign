# SOVEREIGN — Architecture Specification

> **Trust & Deterministic Settlement Layer for Autonomous Agent Commerce**

```
┌────────────────────────────────────────────────────────┐
│               REASONING LAYER (AI AGENTS)              │
│    • Autonomous Buyer Agent    • Autonomous Worker      │
│    • Probabilistic LLM Logic   • Capability Negotiation │
└───────────────────────────┬────────────────────────────┘
                            │ Proposes Action
                            ▼
┌────────────────────────────────────────────────────────┐
│            SOVEREIGN CONTROL PLANE & ENGINE            │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Policy Engine (Deterministic Bounds Evaluation)  │  │
│  └────────────────────────┬─────────────────────────┘  │
│                           ▼                            │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Intent Engine (Canonicalization & Keccak256)     │  │
│  └────────────────────────┬─────────────────────────┘  │
│                           ▼                            │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Task Orchestrator (16-State Guarded FSM)         │  │
│  └────────────────────────┬─────────────────────────┘  │
│                           ▼                            │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Audit Service (Cryptographic SHA-256 Hash Chain) │  │
│  └──────────────────────────────────────────────────┘  │
└───────────────────────────┬────────────────────────────┘
                            │ Authorized Execution
                            ▼
┌────────────────────────────────────────────────────────┐
│              KEEPERHUB WORKFLOW EXECUTOR               │
│  • Validation ➔ Dry-Run Simulation ➔ Execute ➔ Monitor  │
└───────────────────────────┬────────────────────────────┘
                            │ Deterministic Settlement
                            ▼
┌────────────────────────────────────────────────────────┐
│           BASE SEPOLIA SMART CONTRACT LAYER            │
│  • SovereignEscrow.sol (OpenZeppelin SafeERC20)        │
│  • Binds: taskId, intentHash, recipient, amount, expiry│
│  • Circle USDC: 0x036CbD53842c5426634e7929541eC2318f3d│
└────────────────────────────────────────────────────────┘
```

## System Tenets

1. **Separation of Reasoning from Settlement**:
   AI agents make probabilistic choices; money movement requires mathematical determinism. An agent may never directly sign or execute an unconstrained transaction.

2. **Immutable Intent Binding**:
   Every commercial agreement is canonicalized and hashed via `keccak256`. The on-chain smart contract checks this exact hash upon release. Parameter tampering is cryptographically impossible.

3. **Multi-Stage Defense**:
   - Layer 1: Policy Gate (pre-flight checks before funds move)
   - Layer 2: Finite State Machine (invalid transitions rejected)
   - Layer 3: Outcome Verification (deliverable schema check)
   - Layer 4: Smart Contract Invariants (Solidity checks caller, recipient, token, expiry, amount, intent hash)
