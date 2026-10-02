import React, { useState } from 'react';
import { Globe, Search, Sparkles, RefreshCw, StopCircle, ArrowRight, Zap, Building, Check, Layers } from 'lucide-react';

interface DomainProspectorPanelProps {
  onStartMining: (domain: string, role: string, batchSize: number, customNotes: string) => Promise<void>;
  onStopMining: () => void;
  isGenerating: boolean;
  progressPercent: number;
  progressStep: string;
}

const POPULAR_SEEDS = [
  { name: 'Linear', domain: 'linear.app', niche: 'Project Management & DevTools' },
  { name: 'Shopify', domain: 'shopify.com', niche: 'E-Commerce Platform & Retail' },
  { name: 'Retool', domain: 'retool.com', niche: 'Internal Tools & Enterprise SaaS' },
  { name: 'Brex', domain: 'brex.com', niche: 'Fintech & Corporate Cards' },
  { name: 'Figma', domain: 'figma.com', niche: 'Collaborative Design Systems' },
  { name: 'Webflow', domain: 'webflow.com', niche: 'Visual Web Development & CMS' },
  { name: 'Notion', domain: 'notion.so', niche: 'Connected Workspace & Knowledge' },
  { name: 'Supabase', domain: 'supabase.com', niche: 'Open Source Cloud Database' }
];

export const DomainProspectorPanel: React.FC<DomainProspectorPanelProps> = ({
  onStartMining,
  onStopMining,
  isGenerating,
  progressPercent,
  progressStep
}) => {
  const [seedDomain, setSeedDomain] = useState<string>('linear.app');
  const [targetRole, setTargetRole] = useState<string>('Founder & CEO');
  const [batchSize, setBatchSize] = useState<number>(10);
  const [customNotes, setCustomNotes] = useState<string>('Find competitor and lookalike companies with similar business models and target decision makers.');

  const rolePresets = [
    'Founder & CEO',
    'Co-Founder & CTO',
    'VP of Growth & Marketing',
    'Head of Sales & Revenue',
    'Director of Engineering',
    'Chief Operating Officer'
  ];

  const handleSelectSeed = (item: { name: string; domain: string; niche: string }) => {
    setSeedDomain(item.domain);
    setCustomNotes(`Find competitors and lookalikes similar to ${item.name} (${item.domain}) in ${item.niche}.`);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!seedDomain.trim() || isGenerating) return;
    onStartMining(seedDomain.trim(), targetRole, batchSize, customNotes);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base text-slate-100">Competitor & Lookalike Website Prospector</h3>
              <span className="px-2 py-0.5 text-[10px] font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
                Domain Intelligence
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Enter any benchmark website or competitor domain. Gemini will discover similar lookalike companies and extract their decision makers.
            </p>
          </div>
        </div>
      </div>

      {/* 1-Click Popular Seeds */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Quick Benchmark Seeds (1-Click Fill):</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {POPULAR_SEEDS.map((seed) => {
            const isSelected = seedDomain.toLowerCase() === seed.domain.toLowerCase();
            return (
              <button
                key={seed.domain}
                type="button"
                onClick={() => handleSelectSeed(seed)}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-indigo-950/60 border-indigo-500/50 text-indigo-200'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-900 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-100">{seed.name}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                </div>
                <div className="text-[11px] font-mono text-indigo-400 truncate mt-0.5">{seed.domain}</div>
                <div className="text-[10px] text-slate-500 truncate mt-1">{seed.niche}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Input Form */}
      <form onSubmit={handleFormSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Target Website / Seed Domain */}
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>Benchmark Website Domain or Competitor URL</span>
              <span className="text-[10px] text-indigo-400">e.g. linear.app, stripe.com, shopify.com</span>
            </label>
            <div className="relative">
              <Globe className="w-4 h-4 text-indigo-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={seedDomain}
                onChange={(e) => setSeedDomain(e.target.value)}
                placeholder="e.g. stripe.com or companydomain.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-9 pr-3 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                required
              />
            </div>
          </div>

          {/* Batch Size Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs font-bold text-slate-300">
              <span>Prospects to Mine</span>
              <span className="text-indigo-400 font-mono font-black">{batchSize} Leads</span>
            </div>
            <input
              type="range"
              min="5"
              max="25"
              step="5"
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer mt-2"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>5</span>
              <span>15</span>
              <span>25</span>
            </div>
          </div>
        </div>

        {/* Target Decision Maker Role Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-300 block">Target Decision Maker Role</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {rolePresets.map((r) => {
              const isSelected = targetRole === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setTargetRole(r)}
                  className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition text-center truncate cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 border-indigo-400 text-white shadow-md'
                      : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-850'
                  }`}
                >
                  {r}
                </button>
              );
            })}
          </div>
        </div>

        {/* Additional Targeting Notes */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-300 block">Lookalike Criteria & Focus Notes</label>
          <input
            type="text"
            value={customNotes}
            onChange={(e) => setCustomNotes(e.target.value)}
            placeholder="e.g. Focus on Series A / B companies with active engineering and sales teams..."
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Submit / Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          {isGenerating ? (
            <>
              <button
                type="button"
                disabled
                className="flex-1 py-3.5 rounded-2xl bg-indigo-900/60 border border-indigo-500/40 text-indigo-200 font-extrabold text-sm flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                <span>Prospecting Lookalikes ({progressPercent}%)...</span>
              </button>
              <button
                type="button"
                onClick={onStopMining}
                className="px-6 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-sm shadow-xl shadow-rose-600/30 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <StopCircle className="w-5 h-5" />
                <span>Stop</span>
              </button>
            </>
          ) : (
            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-500 hover:from-indigo-500 hover:via-purple-500 hover:to-cyan-400 text-white font-extrabold text-sm shadow-xl shadow-indigo-600/25 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>Mine Competitors & Lookalikes ({batchSize} Leads)</span>
            </button>
          )}
        </div>

        {/* Progress Bar */}
        {isGenerating && (
          <div className="p-4 bg-slate-950/80 rounded-2xl border border-indigo-500/30 space-y-2">
            <div className="flex justify-between items-center text-xs text-indigo-300 font-bold">
              <span className="truncate max-w-[70%]">{progressStep}</span>
              <span className="font-mono">{progressPercent}%</span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </form>
    </div>
  );
};
