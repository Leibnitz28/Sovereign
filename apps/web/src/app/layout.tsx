import './globals.css';
import React from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, 
  Layers, 
  Users, 
  FileCheck2, 
  Cpu, 
  GitCommit, 
  FlaskConical, 
  Activity,
  ExternalLink
} from 'lucide-react';

export const metadata = {
  title: 'SOVEREIGN — Trust & Deterministic Settlement Layer for Autonomous Agent Commerce',
  description: 'Deterministic security, bounded economic intents, and verified on-chain settlements for autonomous AI agents.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col bg-[#0B0F19] text-gray-100 antialiased selection:bg-indigo-500 selection:text-white">
        {/* Top Header */}
        <header className="sticky top-0 z-50 border-b border-gray-800/80 bg-[#0B0F19]/90 backdrop-blur-md px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-0.5 shadow-glow flex items-center justify-center">
                <div className="w-full h-full bg-surface rounded-[10px] flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
                </div>
              </div>
              <div>
                <span className="text-lg font-black tracking-wider uppercase gradient-text">Sovereign</span>
                <span className="block text-[10px] text-gray-400 tracking-tight -mt-1 font-mono">DETERMINISTIC SETTLEMENT</span>
              </div>
            </Link>

            {/* Primary Navigation Links */}
            <nav className="hidden md:flex items-center space-x-1 pl-4 border-l border-gray-800">
              <Link href="/" className="px-3 py-1.5 text-xs font-medium rounded-lg text-gray-300 hover:text-white hover:bg-gray-800/60 transition">
                Overview
              </Link>
              <Link href="/tasks" className="px-3 py-1.5 text-xs font-medium rounded-lg text-gray-300 hover:text-white hover:bg-gray-800/60 transition">
                Tasks & State
              </Link>
              <Link href="/agents" className="px-3 py-1.5 text-xs font-medium rounded-lg text-gray-300 hover:text-white hover:bg-gray-800/60 transition">
                Agent Directory
              </Link>
              <Link href="/policies" className="px-3 py-1.5 text-xs font-medium rounded-lg text-gray-300 hover:text-white hover:bg-gray-800/60 transition">
                Guardrail Policies
              </Link>
              <Link href="/executions" className="px-3 py-1.5 text-xs font-medium rounded-lg text-gray-300 hover:text-white hover:bg-gray-800/60 transition">
                KeeperHub Workflows
              </Link>
              <Link href="/audit" className="px-3 py-1.5 text-xs font-medium rounded-lg text-gray-300 hover:text-white hover:bg-gray-800/60 transition">
                Audit Trail
              </Link>
              <Link href="/security-lab" className="px-3 py-1.5 text-xs font-semibold rounded-lg text-rose-300 bg-rose-950/40 border border-rose-800/50 hover:bg-rose-900/60 transition flex items-center space-x-1.5">
                <FlaskConical className="w-3.5 h-3.5 text-rose-400" />
                <span>Security Lab</span>
              </Link>
            </nav>
          </div>

          {/* Right Status Badges */}
          <div className="flex items-center space-x-3">
            {/* Mode Indicator */}
            <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-950/60 border border-indigo-700/50 text-[11px] font-mono text-indigo-300">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              <span>SIMULATION & TESTNET MODE</span>
            </div>

            {/* Network Badge */}
            <a 
              href="https://sepolia.basescan.org" 
              target="_blank" 
              rel="noreferrer" 
              className="hidden sm:flex items-center space-x-1.5 px-3 py-1 rounded-full bg-gray-900 border border-gray-800 text-[11px] font-mono text-gray-400 hover:border-gray-700 transition"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Base Sepolia (84532)</span>
              <ExternalLink className="w-3 h-3 text-gray-500" />
            </a>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-900 bg-surface/50 px-6 py-4 text-center text-xs text-gray-500 flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto w-full">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-gray-400">SOVEREIGN PROTOCOL</span>
            <span>•</span>
            <span>Deterministic Settlement Layer for Autonomous Agent Commerce</span>
          </div>
          <div className="flex items-center space-x-4 font-mono text-[11px] text-gray-400">
            <span>USDC: 0x036C...dCF7e</span>
            <span>•</span>
            <span>Escrow: OpenZeppelin v5</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
