'use client';

import React, { useState } from 'react';
import { 
  FileCheck2, 
  ShieldAlert, 
  CheckCircle2, 
  Sliders, 
  Lock, 
  DollarSign,
  Cpu
} from 'lucide-react';

export default function PoliciesPage() {
  const [policies] = useState([
    {
      policyId: 'p0000000-0000-0000-0000-000000000001',
      agentId: 'a0000000-0000-0000-0000-000000000001',
      agentName: 'Buyer Agent Alpha',
      maxSingleSpend: 10.0,
      cumulativeSpendLimit: 50.0,
      currentCumulativeSpend: 16.0,
      currencies: ['USDC'],
      networks: ['base-sepolia', 'ethereum-sepolia'],
      minWorkerReputation: 90,
      requireVerification: true,
      settlementTimeoutSeconds: 3600,
    },
  ]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-gray-800 pb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          Autonomous Guardrail Policies
        </h1>
        <p className="text-gray-400 text-xs sm:text-sm mt-1">
          Hard spending limits, network boundaries, and reputation gates evaluated before funds are ever escrowed.
        </p>
      </div>

      <div className="space-y-6">
        {policies.map((p) => (
          <div key={p.policyId} className="glass-panel p-6 rounded-2xl border border-gray-800 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800/80 pb-4">
              <div>
                <span className="text-[11px] font-mono text-indigo-400 uppercase">Policy Enforcer</span>
                <h2 className="text-lg font-bold text-white mt-0.5">{p.agentName}</h2>
                <span className="text-xs font-mono text-gray-500">ID: {p.policyId}</span>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-950 border border-emerald-700 text-emerald-300 font-mono text-xs font-bold self-start">
                GUARDRAIL ACTIVE
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
              <div className="p-4 rounded-xl bg-surface border border-gray-800 space-y-1">
                <span className="text-gray-500 text-[10px] uppercase">Max Single Transaction</span>
                <div className="text-xl font-bold text-white">${p.maxSingleSpend.toFixed(2)} USDC</div>
                <span className="text-[11px] text-cyan-400">Strict Cap per Task</span>
              </div>

              <div className="p-4 rounded-xl bg-surface border border-gray-800 space-y-1">
                <span className="text-gray-500 text-[10px] uppercase">Cumulative Limit</span>
                <div className="text-xl font-bold text-white">
                  ${p.currentCumulativeSpend.toFixed(2)} / ${p.cumulativeSpendLimit.toFixed(2)}
                </div>
                <span className="text-[11px] text-indigo-400">Current Spend: 32%</span>
              </div>

              <div className="p-4 rounded-xl bg-surface border border-gray-800 space-y-1">
                <span className="text-gray-500 text-[10px] uppercase">Reputation Floor</span>
                <div className="text-xl font-bold text-amber-400">≥ {p.minWorkerReputation} / 100</div>
                <span className="text-[11px] text-gray-400">Workers Below Blocked</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-4 rounded-xl bg-black/50 border border-gray-800 space-y-2">
                <span className="text-gray-400 font-bold block">Allowed Settlement Networks</span>
                <div className="flex gap-2">
                  {p.networks.map((net) => (
                    <span key={net} className="px-2 py-1 rounded bg-gray-800 text-gray-300 text-[11px]">
                      {net}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-black/50 border border-gray-800 space-y-2">
                <span className="text-gray-400 font-bold block">Enforced Invariants</span>
                <ul className="text-gray-300 space-y-1 text-[11px]">
                  <li>• Verification Required: <span className="text-emerald-400">YES</span></li>
                  <li>• Escrow SLA Timeout: <span className="text-cyan-400">{p.settlementTimeoutSeconds}s</span></li>
                  <li>• Token Allowlist: <span className="text-indigo-300">{p.currencies.join(', ')}</span></li>
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
