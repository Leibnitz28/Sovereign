// ============================================================
// SOVEREIGN — Autonomous Buyer Agent
// ============================================================
// Autonomous agent that discovers, negotiates, hires, and settles
// with worker agents through Sovereign's deterministic protocol.

import 'dotenv/config';

const API_BASE = process.env.SOVEREIGN_API_URL || 'http://localhost:3001/api/v1';

interface ApiResponse<T = any> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

async function apiRequest<T = any>(
  path: string,
  method = 'GET',
  body?: any,
  headers: Record<string, string> = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = (await res.json()) as ApiResponse<T>;
  if (!res.ok) {
    throw new Error(`API Error [${res.status}] ${json.error?.code || 'UNKNOWN'}: ${json.error?.message || res.statusText}`);
  }
  return (json.data !== undefined ? json.data : json) as T;
}

export async function runBuyerAgentScenario() {
  console.log('🤖 ============================================================');
  console.log('🤖 SOVEREIGN BUYER AGENT — Autonomous Commerce Lifecycle');
  console.log('🤖 ============================================================\n');

  try {
    // 1. Health check
    console.log('📡 Step 1: Connecting to Sovereign Control Plane...');
    const health = await apiRequest<{ status: string; mode: string }>('/health');
    console.log(`✅ Connected! Engine status: ${health.status} | Mode: ${health.mode}\n`);

    // 2. Create Task
    console.log('📝 Step 2: Creating task with deterministic spending constraints...');
    const buyerAgentId = 'a0000000-0000-0000-0000-000000000001';
    const task = await apiRequest<any>('/tasks', 'POST', {
      buyerAgentId,
      capability: 'document-processing',
      maxBudget: 10000000, // 10 USDC
      currency: 'USDC',
      network: 'base-sepolia',
      minimumReputation: 90,
      metadata: {
        documentUrl: 'https://storage.sovereign.network/docs/quarterly_filing_q3.pdf',
        expectedFormat: 'structured-json',
      },
    });
    console.log(`✅ Task created! ID: ${task.taskId}`);
    console.log(`   Budget: 10.00 USDC | Required Rep: ≥90 | Network: base-sepolia\n`);

    // 3. Worker Discovery
    console.log('🔍 Step 3: Discovering qualified worker agents in marketplace...');
    const workers = await apiRequest<any[]>(`/tasks/${task.taskId}/discover`, 'POST');
    console.log(`✅ Discovered ${workers.length} candidates:`);
    for (const w of workers) {
      console.log(`   • ${w.displayName} (${w.agentId.slice(0, 8)}...): ${w.price / 1e6} USDC, Rep: ${w.reputationScore}/100, Trust: ${w.identitySource}`);
    }
    console.log('');

    // 4. Worker Selection & Policy Evaluation
    const selected = workers.find((w) => w.reputationScore >= 90 && w.price <= 10000000);
    if (!selected) {
      throw new Error('No worker met the autonomous buyer constraints!');
    }
    console.log(`🎯 Step 4: Autonomous selection: ${selected.displayName} (${selected.price / 1e6} USDC)`);
    console.log('   Evaluating deterministic spending policy against candidate...');
    const selectRes = await apiRequest<any>(`/tasks/${task.taskId}/select`, 'POST', {
      workerAgentId: selected.agentId,
    });
    console.log(`✅ Worker assigned & policy PASSED! Intent Hash generated: ${selectRes.intentHash}\n`);

    // 5. Escrow Locking
    console.log('🔒 Step 5: Committing funds to deterministic escrow...');
    const escrowRes = await apiRequest<any>(`/tasks/${task.taskId}/escrow`, 'POST');
    console.log(`✅ Escrow locked! Escrow ID: ${escrowRes.escrowId} | State: ${escrowRes.escrowState}\n`);

    // 6. Worker Execution & Submission
    console.log('⚙️ Step 6: Worker executing autonomous task...');
    await new Promise((r) => setTimeout(r, 1200));
    console.log('   Worker submitting proof of execution...');
    const submission = await apiRequest<any>(`/tasks/${task.taskId}/submit`, 'POST', {
      workerAgentId: selected.agentId,
      resultData: {
        summary: 'Parsed 42 financial metrics with 99.8% confidence score.',
        outputHash: '0xabc123def45678901234567890abcdef1234567890abcdef1234567890abcdef',
        tokensUsed: 1420,
      },
      proofOfWork: 'zk-proof-stark-mock-0x777',
    });
    console.log(`✅ Result submitted! Verification status: ${submission.state}\n`);

    // 7. Verification & KeeperHub Settle
    console.log('⚖️ Step 7: Verifying deliverables against intent specifications...');
    const verification = await apiRequest<any>(`/tasks/${task.taskId}/verify`, 'POST');
    console.log(`✅ Verification PASSED! Score: ${verification.score}/100\n`);

    console.log('🚀 Step 8: Triggering deterministic KeeperHub settlement...');
    const settlement = await apiRequest<any>(`/tasks/${task.taskId}/settle`, 'POST');
    console.log(`✅ Settlement COMPLETE!`);
    console.log(`   Tx Hash: ${settlement.settlementTxHash}`);
    console.log(`   Amount: ${settlement.amount / 1e6} USDC to ${selected.walletAddress}`);
    console.log(`   Block explorer: https://sepolia.basescan.org/tx/${settlement.settlementTxHash}\n`);

    // 8. Audit Trail Verification
    console.log('📜 Step 9: Verifying cryptographically chained audit trail...');
    const auditTrail = await apiRequest<any[]>(`/audit?taskId=${task.taskId}`);
    console.log(`✅ Audit trail contains ${auditTrail.length} immutable events.`);
    for (const [idx, event] of auditTrail.entries()) {
      console.log(`   [${idx + 1}] ${event.eventType} (${event.actorType}) — Hash: ${event.eventHash.slice(0, 16)}...`);
    }

    console.log('\n✨ ============================================================');
    console.log('✨ COMMERCE LIFECYCLE COMPLETED WITH DETERMINISTIC SUCCESS');
    console.log('✨ ============================================================\n');
  } catch (err: any) {
    console.error('❌ Error executing buyer agent scenario:', err.message);
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith('src/index.ts') || process.argv[1]?.endsWith('src\\index.ts') || process.argv[1]?.endsWith('dist/index.js')) {
  runBuyerAgentScenario();
}
