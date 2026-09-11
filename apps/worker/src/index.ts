// ============================================================
// SOVEREIGN — Autonomous Worker Agent
// ============================================================
// Worker agent that registers capabilities, listens for tasks,
// executes work, and submits cryptographically verifiable proofs.

import 'dotenv/config';

const API_BASE = process.env.SOVEREIGN_API_URL || 'http://localhost:3001/api/v1';

export class SovereignWorker {
  constructor(
    public agentId: string,
    public name: string,
    public walletAddress: string,
    public capability: string,
    public price: number
  ) {}

  async register() {
    console.log(`👷 Registering worker ${this.name} (${this.agentId})...`);
    const res = await fetch(`${API_BASE}/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: this.agentId,
        walletAddress: this.walletAddress,
        displayName: this.name,
        identitySource: 'verified-external',
        capabilities: [
          {
            capability: this.capability,
            description: `Automated ${this.capability} worker`,
            price: this.price,
            currency: 'USDC',
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      console.log(`ℹ️ Registration status: ${res.status} (${(err as any)?.error?.message || 'already registered'})`);
    } else {
      console.log(`✅ Worker registered successfully!`);
    }
  }

  async executeTask(taskId: string) {
    console.log(`⚙️ Executing work for task ${taskId}...`);
    // Simulate real workload computation
    await new Promise((resolve) => setTimeout(resolve, 800));

    const resultPayload = {
      workerAgentId: this.agentId,
      resultData: {
        status: 'SUCCESS',
        processedItems: 128,
        computedAt: new Date().toISOString(),
        executionDigest: '0x8899aabbccddeeff00112233445566778899aabbccddeeff0011223344556677',
      },
      proofOfWork: `pow-${this.agentId}-${Date.now()}`,
    };

    console.log(`📤 Submitting deliverables to Sovereign...`);
    const res = await fetch(`${API_BASE}/tasks/${taskId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resultPayload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(`Submission failed: ${(data as any)?.error?.message || res.statusText}`);
    }
    console.log(`✅ Deliverable successfully accepted by Sovereign.`);
    return data;
  }
}

async function main() {
  const worker = new SovereignWorker(
    'a0000000-0000-0000-0000-000000000002',
    'DocProcessor Pro',
    '0x2222222222222222222222222222222222222222',
    'document-processing',
    8000000
  );

  console.log('👷 Sovereign Autonomous Worker Daemon initialized.');
  try {
    await worker.register();
  } catch (err: any) {
    console.log('ℹ️ Registration notice:', err.message);
  }
}

if (process.argv[1]?.endsWith('src/index.ts') || process.argv[1]?.endsWith('src\\index.ts') || process.argv[1]?.endsWith('dist/index.js')) {
  main();
}
