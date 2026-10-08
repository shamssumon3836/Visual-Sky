import React, { useState, useEffect } from 'react';
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
  const [inputVal, setInputVal] = useState<string>('10');
  const [customNotes, setCustomNotes] = useState<string>('Find competitor and lookalike companies with similar business models and target decision makers.');

  useEffect(() => {
    setInputVal(String(batchSize));
  }, [batchSize]);

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
              <span className="flex items-center gap-1.5 text-indigo-300">
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                <span>Benchmark Website Domain or Competitor URL (Type Any Website):</span>
              </span>
              <span className="text-[10px] text-indigo-400 font-semibold bg-indigo-950/70 px-2 py-0.5 rounded-full border border-indigo-500/30">
                Type Any Domain
              </span>
            </label>
            <div className="relative">
              <Globe className="w-4 h-4 text-indigo-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={seedDomain}
                onChange={(e) => setSeedDomain(e.target.value)}
                placeholder="Type ANY domain (e.g. stripe.com, shopify.com, webflow.com, pathao.com, or your competitor's site)..."
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-9 pr-3 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                required
              />
            </div>
          </div>

          {/* DEDICATED FULL-WIDTH PROSPECTS TO MINE CONTROL CARD */}
          <div className="p-4 bg-gradient-to-r from-indigo-950/40 via-slate-900/90 to-violet-950/40 border-2 border-indigo-500/40 rounded-3xl space-y-3 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 text-lg shadow-inner">
                  🎯
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-white">Prospects to Mine (লিড সংখ্যা)</span>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold border border-emerald-500/30">
                      কোনো লিমিট নেই (No Limit)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    ইনপুট বক্সে আপনার ইচ্ছামতো যেকোনো সংখ্যা লিখুন অথবা নিচের প্রিসেট বাটনগুলো ক্লিক করুন
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-slate-950 px-3.5 py-1.5 rounded-2xl border border-indigo-500/40 shadow-inner">
                <span className="text-xs text-slate-400 font-medium">নির্বাচিত সংখ্যা:</span>
                <span className="text-base text-indigo-300 font-mono font-black">{batchSize} Leads</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <div className="flex items-center bg-slate-950 border-2 border-indigo-500/60 rounded-2xl overflow-hidden shadow-lg shadow-indigo-950/50">
                <button
                  type="button"
                  onClick={() => {
                    const next = Math.max(1, batchSize - 10);
                    setBatchSize(next);
                    setInputVal(String(next));
                  }}
                  className="px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-black transition cursor-pointer border-r border-slate-800"
                  title="Decrease by 10"
                >
                  -10
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = Math.max(1, batchSize - 5);
                    setBatchSize(next);
                    setInputVal(String(next));
                  }}
                  className="px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-black transition cursor-pointer border-r border-slate-800"
                  title="Decrease by 5"
                >
                  -5
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  value={inputVal}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setInputVal(val);
                    if (val !== '') {
                      const n = parseInt(val, 10);
                      if (!isNaN(n) && n > 0) {
                        setBatchSize(n);
                      }
                    }
                  }}
                  onBlur={() => {
                    const n = parseInt(inputVal, 10);
                    if (isNaN(n) || n < 1) {
                      setBatchSize(10);
                      setInputVal('10');
                    } else {
                      setBatchSize(n);
                      setInputVal(String(n));
                    }
                  }}
                  placeholder="সংখ্যা লিখুন"
                  className="w-24 bg-transparent text-center text-base font-mono font-black text-indigo-300 focus:outline-none px-2 py-2"
                />
                <button
                  type="button"
                  onClick={() => {
                    const next = batchSize + 5;
                    setBatchSize(next);
                    setInputVal(String(next));
                  }}
                  className="px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-black transition cursor-pointer border-l border-slate-800"
                  title="Increase by 5"
                >
                  +5
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = batchSize + 10;
                    setBatchSize(next);
                    setInputVal(String(next));
                  }}
                  className="px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-black transition cursor-pointer border-l border-slate-800"
                  title="Increase by 10"
                >
                  +10
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 flex-1">
                {[5, 10, 20, 25, 50, 75, 100, 150, 200, 300, 500, 1000].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      setBatchSize(num);
                      setInputVal(String(num));
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      batchSize === num
                        ? 'bg-indigo-600 text-white font-black shadow-lg shadow-indigo-600/30 scale-105'
                        : 'bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-indigo-500/50 hover:bg-slate-900'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80">
              <span>💡 যেকোনো সংখ্যা টাইপ করুন — সিস্টেম ঠিক সেই পরিমাণ ভেরিফাইড লুকঅ্যালাইক লিড বের করবে</span>
              <span className="font-mono text-emerald-400 font-bold">100% Live Sites & MX Verified</span>
            </div>
          </div>
        </div>

        {/* Target Decision Maker Role Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <span>Target Decision Maker Role (Type Custom Role or Select Preset):</span>
            <span className="text-[10px] text-indigo-400 font-normal">e.g. Founder, Medical Director, Managing Partner</span>
          </div>
          <input
            type="text"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            placeholder="Type any custom role (e.g. Managing Partner, VP Procurement, Chief Medical Officer)..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none font-medium"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {rolePresets.map((r) => {
              const isSelected = targetRole === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setTargetRole(r)}
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition text-center truncate cursor-pointer ${
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
