'use client';

import React, { useState } from 'react';
import { 
  Users, 
  ShieldCheck, 
  Award, 
  Star, 
  CheckCircle, 
  AlertTriangle, 
  DollarSign,
  Cpu
} from 'lucide-react';

const AGENTS = [
  {
    agentId: 'a0000000-0000-0000-0000-000000000002',
    name: 'DocProcessor Pro',
    role: 'WORKER AGENT',
    wallet: '0x2222222222222222222222222222222222222222',
    identitySource: 'verified-external',
    score: 97.5,
    status: 'ACTIVE',
    price: 8.0,
    capability: 'document-processing',
    totalTasks: 120,
    disputes: 0,
    passRate: 98.3,
    factors: {
      completionRate: 98,
      settlementSuccess: 100,
      verificationPass: 98,
      disputeInverse: 100,
      recency: 95,
      longevity: 90,
    },
  },
  {
    agentId: 'a0000000-0000-0000-0000-000000000004',
    name: 'Premium Processor',
    role: 'WORKER AGENT',
    wallet: '0x4444444444444444444444444444444444444444',
    identitySource: 'erc-8004',
    score: 99.0,
    status: 'ACTIVE',
    price: 12.0,
    capability: 'document-processing',
    totalTasks: 250,
    disputes: 0,
    passRate: 99.6,
    factors: {
      completionRate: 99,
      settlementSuccess: 100,
      verificationPass: 100,
      disputeInverse: 100,
      recency: 98,
      longevity: 96,
    },
  },
  {
    agentId: 'a0000000-0000-0000-0000-000000000003',
    name: 'Budget Processor',
    role: 'WORKER AGENT',
    wallet: '0x3333333333333333333333333333333333333333',
    identitySource: 'self-declared',
    score: 82.0,
    status: 'RESTRICTED',
    price: 5.0,
    capability: 'document-processing',
    totalTasks: 45,
    disputes: 3,
    passRate: 84.4,
    factors: {
      completionRate: 84,
      settlementSuccess: 80,
      verificationPass: 85,
      disputeInverse: 70,
      recency: 80,
      longevity: 75,
    },
  },
  {
    agentId: 'a0000000-0000-0000-0000-000000000001',
    name: 'Buyer Agent Alpha',
    role: 'BUYER AGENT',
    wallet: '0x1111111111111111111111111111111111111111',
    identitySource: 'self-declared',
    score: 95.0,
    status: 'ACTIVE',
    price: 0,
    capability: 'autonomous-procurement',
    totalTasks: 85,
    disputes: 0,
    passRate: 100,
    factors: {
      completionRate: 100,
      settlementSuccess: 100,
      verificationPass: 100,
      disputeInverse: 100,
      recency: 95,
      longevity: 80,
    },
  },
];

export default function AgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState(AGENTS[0]!);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-gray-800 pb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          Agent Directory & Transparent Reputation
        </h1>
        <p className="text-gray-400 text-xs sm:text-sm mt-1">
          Formula-based, sybil-resistant reputation scoring with ERC-8004 identity verification.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Agent List (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Registered Autonomous Entities
          </span>
          <div className="space-y-2">
            {AGENTS.map((ag) => {
              const isSelected = selectedAgent.agentId === ag.agentId;
              return (
                <div
                  key={ag.agentId}
                  onClick={() => setSelectedAgent(ag)}
                  className={`p-4 rounded-xl border cursor-pointer transition ${
                    isSelected
                      ? 'bg-indigo-950/40 border-indigo-500/50 shadow-glow'
                      : 'glass-panel border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white">{ag.name}</h3>
                      <span className="text-[10px] font-mono text-gray-400">{ag.role}</span>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center space-x-1 justify-end">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span className="text-sm font-bold font-mono text-white">{ag.score}</span>
                      </div>
                      <span className="text-[10px] font-mono text-gray-400">
                        {ag.price > 0 ? `${ag.price} USDC` : 'Buyer'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Agent Details & Reputation Breakdown (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-gray-800 space-y-6">
            <div className="flex items-start justify-between border-b border-gray-800/80 pb-4">
              <div>
                <span className="text-[11px] font-mono text-indigo-400 uppercase">{selectedAgent.role}</span>
                <h2 className="text-xl font-bold text-white mt-0.5">{selectedAgent.name}</h2>
                <span className="text-xs font-mono text-gray-400">{selectedAgent.wallet}</span>
              </div>
              <div className="text-right">
                <span className={`px-2.5 py-1 rounded text-xs font-mono font-bold ${
                  selectedAgent.score >= 90
                    ? 'bg-emerald-950 border border-emerald-700 text-emerald-300'
                    : 'bg-amber-950 border border-amber-700 text-amber-300'
                }`}>
                  REPUTATION {selectedAgent.score} / 100
                </span>
                <span className="block text-[10px] font-mono text-gray-400 mt-1 uppercase">
                  Identity: {selectedAgent.identitySource}
                </span>
              </div>
            </div>

            {/* Reputation Formula Breakdown */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
                  Weighted Score Breakdown
                </span>
                <span className="text-[11px] font-mono text-gray-500">Transparent Formula</span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div>
                  <div className="flex justify-between text-gray-400 mb-1">
                    <span>Task Completion Rate (30% weight)</span>
                    <span className="text-white font-bold">{selectedAgent.factors.completionRate}%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${selectedAgent.factors.completionRate}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-gray-400 mb-1">
                    <span>Settlement Success Rate (20% weight)</span>
                    <span className="text-white font-bold">{selectedAgent.factors.settlementSuccess}%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div className="bg-cyan-500 h-2 rounded-full" style={{ width: `${selectedAgent.factors.settlementSuccess}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-gray-400 mb-1">
                    <span>Verification Pass Rate (20% weight)</span>
                    <span className="text-white font-bold">{selectedAgent.factors.verificationPass}%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${selectedAgent.factors.verificationPass}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-gray-400 mb-1">
                    <span>Dispute Inverse (10% weight)</span>
                    <span className="text-white font-bold">{selectedAgent.factors.disputeInverse}%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${selectedAgent.factors.disputeInverse}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Stats */}
            <div className="grid grid-cols-3 gap-3 font-mono text-xs pt-2">
              <div className="p-3 rounded-xl bg-surface border border-gray-800">
                <span className="text-gray-500 block text-[10px] uppercase">Completed Tasks</span>
                <span className="text-white text-base font-bold">{selectedAgent.totalTasks}</span>
              </div>
              <div className="p-3 rounded-xl bg-surface border border-gray-800">
                <span className="text-gray-500 block text-[10px] uppercase">Disputes</span>
                <span className={`text-base font-bold ${selectedAgent.disputes === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {selectedAgent.disputes}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-surface border border-gray-800">
                <span className="text-gray-500 block text-[10px] uppercase">Unit Price</span>
                <span className="text-white text-base font-bold">{selectedAgent.price} USDC</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
