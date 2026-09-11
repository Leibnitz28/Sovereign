'use client';

import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  Search, 
  Filter, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Zap
} from 'lucide-react';

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    fetch('/api/v1/tasks')
      .then((res) => res.json())
      .then((data) => {
        if (data.data && Array.isArray(data.data)) {
          setTasks(data.data);
          if (data.data.length > 0) setSelectedTask(data.data[0]);
        }
      })
      .catch(() => {
        // Sample fallback tasks
        const sample = [
          {
            taskId: 'task-a100-demo',
            buyerAgentId: 'a0000000-0000-0000-0000-000000000001',
            workerAgentId: 'a0000000-0000-0000-0000-000000000002',
            capability: 'document-processing',
            state: 'COMPLETED',
            maxBudget: 10000000,
            currency: 'USDC',
            intentHash: '0x88f12a3d00192e88a7c293048572019385018274029482019284729183920192',
            settlementTxHash: '0x3a4b9c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b',
            createdAt: new Date().toISOString(),
          },
          {
            taskId: 'task-b200-demo',
            buyerAgentId: 'a0000000-0000-0000-0000-000000000001',
            workerAgentId: 'a0000000-0000-0000-0000-000000000002',
            capability: 'document-processing',
            state: 'ESCROW_LOCKED',
            maxBudget: 8000000,
            currency: 'USDC',
            intentHash: '0x11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff',
            settlementTxHash: null,
            createdAt: new Date(Date.now() - 3600000).toISOString(),
          },
        ];
        setTasks(sample);
        setSelectedTask(sample[0]);
      });
  }, []);

  const fsmSteps = [
    'CREATED',
    'DISCOVERING',
    'WORKER_SELECTED',
    'INTENT_COMMITTED',
    'ESCROW_LOCKED',
    'SUBMITTED',
    'VERIFIED',
    'SETTLED',
    'COMPLETED',
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Tasks & Finite State Machine
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">
            Track every autonomous commercial agreement across 16 strictly guarded states.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-1 bg-surface p-1 rounded-xl border border-gray-800 text-xs font-mono">
          {['ALL', 'COMPLETED', 'IN_PROGRESS', 'BLOCKED'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg transition ${
                filter === f ? 'bg-indigo-600 text-white font-semibold' : 'text-gray-400 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Task List (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="space-y-2">
            {tasks.map((t) => {
              const isSelected = selectedTask?.taskId === t.taskId;
              return (
                <div
                  key={t.taskId}
                  onClick={() => setSelectedTask(t)}
                  className={`p-4 rounded-xl border transition cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-950/40 border-indigo-500/50 shadow-glow'
                      : 'glass-panel border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-indigo-300 font-bold">{t.taskId}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-950 border border-emerald-800 text-emerald-300">
                      {t.state}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-gray-300 flex items-center justify-between">
                    <span>Capability: {t.capability}</span>
                    <span className="font-mono font-bold text-white">{(t.maxBudget / 1e6).toFixed(2)} USDC</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Task Details & Timeline (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {selectedTask ? (
            <div className="glass-panel p-6 rounded-2xl border border-gray-800 space-y-6">
              <div className="flex items-start justify-between border-b border-gray-800/80 pb-4">
                <div>
                  <span className="text-[11px] font-mono text-indigo-400 uppercase">Selected Task</span>
                  <h2 className="text-xl font-bold font-mono text-white mt-0.5">{selectedTask.taskId}</h2>
                </div>
                <span className="px-2.5 py-1 rounded bg-indigo-950 border border-indigo-800 text-xs font-mono text-indigo-300">
                  {selectedTask.currency} • Base Sepolia
                </span>
              </div>

              {/* State Machine Progression Visualizer */}
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  State Machine Progression
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {fsmSteps.map((s, idx) => {
                    const isPassed = true; // Highlight states in progression
                    return (
                      <div
                        key={s}
                        className={`p-2 rounded-lg border text-center font-mono text-[10px] ${
                          s === selectedTask.state
                            ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 font-bold'
                            : 'bg-gray-900/60 border-gray-800 text-gray-400'
                        }`}
                      >
                        <div className="text-[8px] text-gray-500">0{idx + 1}</div>
                        <div className="truncate">{s}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Cryptographic Proofs & Details */}
              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 rounded-xl bg-black/60 border border-gray-800 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Canonical Intent Hash:</span>
                    <span className="text-cyan-400 truncate max-w-xs">{selectedTask.intentHash || '0x88f1...192'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Buyer Agent:</span>
                    <span className="text-gray-300">{selectedTask.buyerAgentId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Worker Agent:</span>
                    <span className="text-gray-300">{selectedTask.workerAgentId || 'DocProcessor Pro'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Settlement Tx Hash:</span>
                    <a
                      href={`https://sepolia.basescan.org/tx/${selectedTask.settlementTxHash || '0x3a4b...9f81'}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
                    >
                      <span className="truncate max-w-xs">{selectedTask.settlementTxHash || '0x3a4b...9f81'}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-panel p-12 rounded-2xl border border-gray-800 text-center text-gray-500">
              Select a task to inspect state details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
