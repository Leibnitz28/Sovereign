'use client';

import React, { useState } from 'react';
import { 
  Cpu, 
  Workflow, 
  CheckCircle, 
  Clock, 
  ExternalLink, 
  RefreshCw,
  Zap,
  ShieldCheck
} from 'lucide-react';

export default function ExecutionsPage() {
  const [executions] = useState([
    {
      executionId: 'exec-8f92a1',
      taskId: 'task-a100-demo',
      workerName: 'DocProcessor Pro',
      workflowName: 'document-analysis-pipeline',
      keeperHubStatus: 'COMPLETED',
      dryRunPassed: true,
      executionTimeMs: 1420,
      network: 'base-sepolia',
      txHash: '0x3a4b9c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b',
      steps: [
        { name: 'Workflow Validation', status: 'SUCCESS', duration: '120ms' },
        { name: 'KeeperHub Dry-Run Simulation', status: 'SUCCESS', duration: '340ms' },
        { name: 'Worker Computation & Proof Gen', status: 'SUCCESS', duration: '820ms' },
        { name: 'Base Sepolia Escrow Release', status: 'SUCCESS', duration: '140ms' },
      ],
    },
  ]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-gray-800 pb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          KeeperHub Execution Engine
        </h1>
        <p className="text-gray-400 text-xs sm:text-sm mt-1">
          Automated multi-step workflow execution, dry-run validation, and deterministic value settlement.
        </p>
      </div>

      <div className="space-y-6">
        {executions.map((ex) => (
          <div key={ex.executionId} className="glass-panel p-6 rounded-2xl border border-gray-800 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800/80 pb-4">
              <div>
                <span className="text-[11px] font-mono text-cyan-400 uppercase">KeeperHub Orchestrator</span>
                <h2 className="text-lg font-bold text-white mt-0.5">{ex.workflowName}</h2>
                <span className="text-xs font-mono text-gray-500">Execution ID: {ex.executionId}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="px-3 py-1 rounded-full bg-emerald-950 border border-emerald-700 text-emerald-300 font-mono text-xs font-bold">
                  {ex.keeperHubStatus}
                </span>
              </div>
            </div>

            {/* Workflow Step Visualization */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                KeeperHub Workflow Pipeline
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {ex.steps.map((step, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-gray-900/80 border border-gray-800 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-gray-500">
                      <span>STEP 0{idx + 1}</span>
                      <span className="text-emerald-400 font-bold">{step.duration}</span>
                    </div>
                    <div className="text-xs font-semibold text-gray-200">{step.name}</div>
                    <div className="text-[10px] font-mono text-emerald-400 flex items-center space-x-1">
                      <CheckCircle className="w-3 h-3" />
                      <span>{step.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* On-Chain Execution Proof */}
            <div className="p-4 rounded-xl bg-black/60 border border-gray-800 font-mono text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Target Task:</span>
                <span className="text-indigo-400">{ex.taskId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Dry-Run Simulation Verified:</span>
                <span className="text-emerald-400 font-bold">PASSED (0 Reverts)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Settlement Transaction:</span>
                <a
                  href={`https://sepolia.basescan.org/tx/${ex.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-400 hover:underline flex items-center space-x-1 truncate max-w-xs"
                >
                  <span>{ex.txHash}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
