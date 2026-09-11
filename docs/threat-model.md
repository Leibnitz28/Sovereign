# SOVEREIGN — Threat Model & Security Matrix

## 1. Threat Taxonomy & Attack Scenarios

| Attack Vector | Attacker Objective | Sovereign Defense Layer | Rejection Code |
|---|---|---|---|
| **1. Budget Overflow** | Prompt injection forces buyer to commit $50 instead of $10 | Deterministic Policy Engine (`max-single-spend`) | `POLICY_VIOLATION` |
| **2. Recipient Hijack** | Compromised agent substitutes recipient wallet to attacker | Intent Binding + Smart Contract Recipient Check | `RECIPIENT_MISMATCH` |
| **3. Intent Tampering** | Mutates payment amount in flight after agreement | Keccak256 Canonical Intent Verifier | `INTENT_HASH_MISMATCH` |
| **4. Double Settle / Replay** | Replays signed settlement payload twice | `intentHashUsed[hash]` in `SovereignEscrow.sol` | `INTENT_ALREADY_USED` |
| **5. Premature Settlement** | Releases funds before worker submission is verified | 16-State Guarded FSM Transition Guard | `INVALID_STATE_TRANSITION` |
| **6. Reputation Gaming** | Sybil ring trades back and forth to inflate scores | Anti-Sybil Anti-Gaming Engine | `REPUTATION_GAMING_DETECTED` |
| **7. Untrusted Worker** | Assigns low-reputation worker violating buyer policy | Worker Selection Guard | `POLICY_VIOLATION (REP_TOO_LOW)` |
| **8. Expired Intent** | Attempts settlement after agreed SLA deadline | Solidity `block.timestamp <= expiry` | `ESCROW_EXPIRED` |

## 2. Invariants

- **Invariant A**: Funds in escrow can only be unlocked to `recipient` matching the locked `intentHash`.
- **Invariant B**: A single `intentHash` can only be settled exactly once on-chain.
- **Invariant C**: No state transition can occur without creating a SHA-256 hash-chained audit event.
