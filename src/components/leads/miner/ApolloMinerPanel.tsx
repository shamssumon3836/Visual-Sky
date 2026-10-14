import React, { useState, useEffect } from 'react';
import { 
  Target, 
  Key, 
  Check, 
  X, 
  ExternalLink, 
  ShieldCheck, 
  Sparkles, 
  RefreshCw, 
  StopCircle, 
  Send, 
  ChevronDown, 
  ChevronUp,
  Sliders,
  Globe,
  Phone,
  Mail,
  Zap,
  Building,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface ApolloMinerPanelProps {
  apolloApiKey: string;
  isApolloConnected: boolean;
  onOpenApolloModal: () => void;
  onStartApolloMining: (params: {
    niche: string;
    location: string;
    targetRole: string;
    batchSize: number;
    requirePhone: boolean;
  }) => void;
  onStopMining: () => void;
  isGenerating: boolean;
  progressPercent: number;
  progressStep: string;
}

export const ApolloMinerPanel: React.FC<ApolloMinerPanelProps> = ({
  apolloApiKey,
  isApolloConnected,
  onOpenApolloModal,
  onStartApolloMining,
  onStopMining,
  isGenerating,
  progressPercent,
  progressStep
}) => {
  const [niche, setNiche] = useState<string>('Video Editing Agency');
  const [location, setLocation] = useState<string>('London & Manchester, UK');
  const [targetRole, setTargetRole] = useState<string>('Founder & CEO');
  const [batchSize, setBatchSize] = useState<number>(25);
  const [batchSizeInput, setBatchSizeInput] = useState<string>('25');
  const [requirePhone, setRequirePhone] = useState<boolean>(true);
  const [requireMxCheck, setRequireMxCheck] = useState<boolean>(true);
  const [showGuide, setShowGuide] = useState<boolean>(false);

  useEffect(() => {
    setBatchSizeInput(String(batchSize));
  }, [batchSize]);

  // Industry presets
  const industryPresets = [
    { label: 'Video Editing Agency', niche: 'Video Editing & Creative Production Agency', role: 'Founder & CEO', loc: 'London & Manchester, UK' },
    { label: 'B2B SaaS Founders', niche: 'B2B SaaS & Cloud Software', role: 'Founder & CEO', loc: 'San Francisco & New York, USA' },
    { label: 'E-Commerce CEOs', niche: 'E-Commerce Brands & Shopify Stores', role: 'Chief Executive Officer', loc: 'United States & UK' },
    { label: 'Marketing Agencies', niche: 'Digital Marketing & Growth Agencies', role: 'Managing Director / Owner', loc: 'London, New York & Sydney' },
    { label: 'Real Estate Brokers', niche: 'Commercial Real Estate & Development', role: 'Principal Broker / Partner', loc: 'Miami, Dallas & Austin, USA' },
    { label: 'Healthcare & MedSpas', niche: 'Private Clinics & Medical Spas', role: 'Clinic Owner / Medical Director', loc: 'Major US Metro Areas' }
  ];

  // Role presets
  const rolePresets = [
    'Founder & CEO',
    'Managing Director',
    'Chief Marketing Officer (CMO)',
    'VP of Sales',
    'Business Owner & Partner',
    'Creative Director'
  ];

  // Location presets
  const locationPresets = [
    'London & Manchester, UK',
    'San Francisco & New York, USA',
    'Austin & Dallas, Texas, USA',
    'Toronto & Vancouver, Canada',
    'Sydney & Melbourne, Australia',
    'Dubai & Abu Dhabi, UAE'
  ];

  const handleApplyPreset = (p: typeof industryPresets[0]) => {
    setNiche(p.niche);
    setTargetRole(p.role);
    setLocation(p.loc);
  };

  const handleStartMining = () => {
    onStartApolloMining({
      niche,
      location,
      targetRole,
      batchSize,
      requirePhone
    });
  };

  return (
    <div className="bg-slate-900/95 border-2 border-amber-500/30 rounded-3xl p-6 shadow-2xl shadow-amber-950/20 space-y-6 animate-in fade-in">
      {/* Top Banner: Apollo.io Live Intelligence */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-950/30 border border-amber-500/40 shadow-inner">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border-2 border-amber-500/50 flex items-center justify-center text-amber-400 font-black text-2xl shadow-lg shadow-amber-500/20 shrink-0">
            🎯
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black text-white tracking-wide">
                Apollo.io B2B Sales Intelligence
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${
                isApolloConnected
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}>
                {isApolloConnected ? '🟢 Live Apollo API Connected' : '⚡ Apollo Free Intelligence Active'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                275M+ Live Verified Records
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Extract validated B2B decision makers with direct mobile numbers, corporate emails, and active company websites.
              <span className="text-amber-300 font-semibold ml-1">
                Zero dead websites guarantee with real-time DNS & MX resolution.
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
          <button
            type="button"
            onClick={onOpenApolloModal}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition cursor-pointer border ${
              isApolloConnected
                ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-500/40 shadow-sm'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black border-amber-400 shadow-md shadow-amber-500/30'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>{isApolloConnected ? 'Manage Apollo Key' : 'Connect Free Apollo Key'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer text-xs"
            title="Toggle setup guide"
          >
            {showGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Collapsible 1-minute Free Setup Guide */}
      {showGuide && (
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 text-xs text-slate-300 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-amber-300 flex items-center gap-1.5">
              <span>⚡ How to get your free Apollo API Key (1 minute):</span>
            </span>
            <a
              href="https://app.apollo.io/#/settings/integrations/apis"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:text-amber-300 font-bold underline flex items-center gap-1"
            >
              <span>Go to Apollo API Settings</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <ol className="list-decimal list-inside space-y-1.5 text-slate-400 pl-1 leading-relaxed">
            <li>Create or log into your free account at <strong className="text-white">apollo.io</strong> (free tier gives monthly email credits).</li>
            <li>In the bottom left, click <strong className="text-white">Settings</strong> &rarr; select <strong className="text-white">Integrations</strong> &rarr; click <strong className="text-white">API Keys</strong>.</li>
            <li>Click <strong className="text-white">Create New Key</strong>, name it (e.g. <em>VisualSky Cold Outreach</em>), and copy the key.</li>
            <li>Click <strong className="text-amber-300">Connect Free Apollo Key</strong> above, paste it, and click Verify. All lead runs will query live Apollo records!</li>
          </ol>
        </div>
      )}

      {/* Industry Presets Quick Bar */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>1-Click High-Converting B2B Blueprints:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {industryPresets.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleApplyPreset(p)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer text-left ${
                niche === p.niche
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 font-bold shadow-sm'
                  : 'bg-slate-950/80 text-slate-300 hover:text-white border-slate-800 hover:border-slate-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Apollo Search Configuration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Niche / Industry Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-extrabold text-slate-200 flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-amber-400" />
            <span>Target Niche / Industry Keyword</span>
          </label>
          <input
            type="text"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="e.g. Video Editing Agency, SaaS, DTC..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 transition"
          />
        </div>

        {/* Target Decision Maker Role */}
        <div className="space-y-1.5">
          <label className="text-xs font-extrabold text-slate-200 flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-amber-400" />
            <span>Decision Maker Role / Title</span>
          </label>
          <input
            type="text"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            placeholder="e.g. Founder & CEO, Managing Director..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 transition"
          />
          <div className="flex flex-wrap gap-1 pt-1">
            {rolePresets.slice(0, 3).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setTargetRole(r)}
                className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-950 text-slate-400 hover:text-amber-300 border border-slate-800 hover:border-amber-500/40 transition cursor-pointer"
              >
                {r.split('(')[0].trim()}
              </button>
            ))}
          </div>
        </div>

        {/* Location / Geography */}
        <div className="space-y-1.5">
          <label className="text-xs font-extrabold text-slate-200 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-amber-400" />
            <span>Location / Geographic Market</span>
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. London & Manchester, UK..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 transition"
          />
          <div className="flex flex-wrap gap-1 pt-1">
            {locationPresets.slice(0, 3).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLocation(l)}
                className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-950 text-slate-400 hover:text-amber-300 border border-slate-800 hover:border-amber-500/40 transition cursor-pointer"
              >
                {l.split(',')[0].trim()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quantity & Strict Verification Options */}
      <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-extrabold text-slate-200">
              Leads to Mine:
            </span>
            {/* Stepper + Input */}
            <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-sm">
              <button
                type="button"
                onClick={() => setBatchSize(Math.max(5, batchSize - 5))}
                className="px-2.5 py-1.5 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-black transition cursor-pointer border-r border-slate-700"
              >
                -5
              </button>
              <input
                type="number"
                min={1}
                max={500}
                value={batchSizeInput}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setBatchSizeInput(val);
                  if (val !== '') {
                    const n = parseInt(val, 10);
                    if (!isNaN(n) && n > 0) setBatchSize(n);
                  }
                }}
                onBlur={() => {
                  const n = parseInt(batchSizeInput, 10);
                  if (isNaN(n) || n < 1) {
                    setBatchSize(25);
                    setBatchSizeInput('25');
                  } else {
                    setBatchSize(n);
                    setBatchSizeInput(String(n));
                  }
                }}
                className="w-16 bg-slate-950 text-center text-xs font-mono font-black text-amber-300 focus:outline-none px-1 py-1.5 border-x border-slate-800"
              />
              <button
                type="button"
                onClick={() => setBatchSize(batchSize + 5)}
                className="px-2.5 py-1.5 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-black transition cursor-pointer border-l border-slate-700"
              >
                +5
              </button>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5">
              {[10, 25, 50, 100, 200].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setBatchSize(num)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    batchSize === num
                      ? 'bg-amber-400 text-slate-950 font-black shadow-sm shadow-amber-400/40'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Verification Toggles */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={requirePhone}
                onChange={(e) => setRequirePhone(e.target.checked)}
                className="rounded accent-amber-500 w-3.5 h-3.5"
              />
              <span className="flex items-center gap-1 font-medium">
                <Phone className="w-3 h-3 text-emerald-400" />
                <span>Require Direct Mobile / Phone</span>
              </span>
            </label>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={requireMxCheck}
                onChange={(e) => setRequireMxCheck(e.target.checked)}
                className="rounded accent-amber-500 w-3.5 h-3.5"
              />
              <span className="flex items-center gap-1 font-medium">
                <ShieldCheck className="w-3 h-3 text-cyan-400" />
                <span>Zero Dead Sites (DNS + MX Verified)</span>
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Mining Progress HUD (When Running) */}
      {isGenerating && (
        <div className="p-4 rounded-2xl bg-slate-950/90 border-2 border-amber-500/50 space-y-3 shadow-xl">
          <div className="flex items-center justify-between text-xs font-extrabold text-amber-300">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
              <span>{progressStep || 'Mining Apollo.io Intelligence records...'}</span>
            </div>
            <span className="font-mono">{progressPercent}%</span>
          </div>

          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-400 pt-1">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Apollo 275M+ B2B Registry</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Live DNS Resolution</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
              <span>MX Mail Host Reachability</span>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons: Mine or Stop */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Every lead includes live verified corporate website, direct decision maker role & MX mail delivery.</span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {isGenerating ? (
            <button
              type="button"
              onClick={onStopMining}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-rose-600/30"
            >
              <StopCircle className="w-4 h-4" />
              <span>Stop Mining</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartMining}
              className="w-full sm:w-auto px-8 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2.5 transition cursor-pointer shadow-xl shadow-amber-500/25 active:scale-[0.98]"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Mine with Apollo.io Intelligence</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
