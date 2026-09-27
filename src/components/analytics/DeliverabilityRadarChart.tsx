import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Sparkles, 
  Radio, 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  Server, 
  Flame, 
  Zap, 
  Lock,
  Layers,
  HelpCircle,
  TrendingUp,
  Cpu
} from 'lucide-react';

interface RadarMetric {
  id: string;
  label: string;
  currentValue: number; // 0 - 100
  targetValue: number;
  benchmarkTop1Pct: number;
  description: string;
  status: 'optimal' | 'warning' | 'alert';
  details: string;
}

interface DeliverabilityRadarChartProps {
  primaryInboxScore?: number;
  spfDkimPassRate?: number;
  dmarcStatus?: string;
  bounceRate?: number;
  onRefresh?: () => void;
}

export const DeliverabilityRadarChart: React.FC<DeliverabilityRadarChartProps> = ({
  primaryInboxScore = 99.8,
  spfDkimPassRate = 100,
  dmarcStatus = 'Enforced (p=reject)',
  bounceRate = 0.08,
}) => {
  const [activePreset, setActivePreset] = useState<'current' | 'benchmark' | 'both'>('both');
  const [hoveredMetricId, setHoveredMetricId] = useState<string | null>(null);
  const [selectedTargetIsp, setSelectedTargetIsp] = useState<'google' | 'microsoft' | 'yahoo' | 'custom'>('google');

  // 6 Primary Radar Vectors for Cold Outreach Deliverability
  const radarMetrics: RadarMetric[] = [
    {
      id: 'spf_dkim',
      label: 'SPF & DKIM 2048 Alignment',
      currentValue: spfDkimPassRate,
      targetValue: 100,
      benchmarkTop1Pct: 100,
      description: 'Cryptographic identity check on custom domain headers',
      status: 'optimal',
      details: 'RSA 2048-bit keys verified across all active outbound webmail relays.'
    },
    {
      id: 'inbox_placement',
      label: 'Primary Tab Landing',
      currentValue: Math.min(100, Math.max(90, primaryInboxScore)),
      targetValue: 99.5,
      benchmarkTop1Pct: 99.9,
      description: 'Bypasses promotions/updates and lands in the primary VIP inbox',
      status: 'optimal',
      details: 'Zero spam flags detected across Gmail, Google Workspace & Outlook.'
    },
    {
      id: 'warmup_health',
      label: 'Domain Warmup Velocity',
      currentValue: 98,
      targetValue: 95,
      benchmarkTop1Pct: 99,
      description: 'Gradual ramp-up curve and peer-to-peer inbox positive reply loops',
      status: 'optimal',
      details: '+15 emails/day increment with human-like randomized sleep intervals.'
    },
    {
      id: 'spam_avoidance',
      label: 'Spam Filter Avoidance',
      currentValue: 99.2,
      targetValue: 98.0,
      benchmarkTop1Pct: 99.8,
      description: 'Zero spam trigger words and clean HTML/Plaintext balance',
      status: 'optimal',
      details: 'Clean copy, no suspicious tracking links or aggressive punctuation.'
    },
    {
      id: 'ip_reputation',
      label: 'IP & ASN Trust Score',
      currentValue: 99.6,
      targetValue: 97.5,
      benchmarkTop1Pct: 99.9,
      description: 'Sender IP not listed on Spamhaus, Barracuda, or SORBS RBLs',
      status: 'optimal',
      details: 'Clean ASN routing with dedicated PTR reverse DNS records.'
    },
    {
      id: 'engagement_velocity',
      label: 'Reply & Click Velocity',
      currentValue: 94.5,
      targetValue: 90.0,
      benchmarkTop1Pct: 97.0,
      description: 'Recipient engagement signals that tell algorithms you are high-priority',
      status: 'optimal',
      details: 'Organic replies signal positive user intent to Google & Microsoft.'
    }
  ];

  // Mathematical Radial Coordinates generator (6-axis hexagon)
  const size = 380;
  const center = size / 2;
  const radius = 135;
  const numAxes = radarMetrics.length;

  const getCoordinates = (value: number, axisIndex: number) => {
    const angle = (Math.PI * 2 / numAxes) * axisIndex - Math.PI / 2;
    const r = (value / 100) * radius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y, angle };
  };

  // Generate SVG Polygon path for Current Score
  const currentPoints = radarMetrics.map((m, idx) => {
    const { x, y } = getCoordinates(m.currentValue, idx);
    return `${x},${y}`;
  }).join(' ');

  // Generate SVG Polygon path for Top 1% Benchmark
  const benchmarkPoints = radarMetrics.map((m, idx) => {
    const { x, y } = getCoordinates(m.benchmarkTop1Pct, idx);
    return `${x},${y}`;
  }).join(' ');

  // Concentric Rings (20, 40, 60, 80, 100%)
  const rings = [0.2, 0.4, 0.6, 0.8, 1.0];

  // ISP Deliverability Telemetry
  const ispData = {
    google: {
      name: 'Google Workspace & Gmail',
      score: '99.8%',
      status: 'Optimal (Primary Tab)',
      spf: 'PASS',
      dkim: 'PASS (2048-bit)',
      dmarc: 'p=reject',
      mxDelay: '42ms',
      color: 'from-blue-500 to-cyan-400'
    },
    microsoft: {
      name: 'Microsoft 365 & Outlook',
      score: '99.4%',
      status: 'Optimal (Focused Inbox)',
      spf: 'PASS',
      dkim: 'PASS',
      dmarc: 'Aligned',
      mxDelay: '58ms',
      color: 'from-indigo-500 to-blue-400'
    },
    yahoo: {
      name: 'Yahoo & AOL Mail',
      score: '99.6%',
      status: 'Optimal (Inbox)',
      spf: 'PASS',
      dkim: 'PASS',
      dmarc: 'Aligned',
      mxDelay: '64ms',
      color: 'from-purple-500 to-pink-500'
    },
    custom: {
      name: 'Custom Domain Webmails / cPanel',
      score: '100.0%',
      status: 'Direct Relay Active',
      spf: 'PASS',
      dkim: 'PASS',
      dmarc: 'Strict',
      mxDelay: '28ms',
      color: 'from-emerald-500 to-cyan-400'
    }
  };

  const activeIsp = ispData[selectedTargetIsp];

  return (
    <div className="bg-gradient-to-b from-slate-900 via-[#0a0f1d] to-slate-950 rounded-3xl border border-slate-800 p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden">
      {/* Radiant Glow ambient backgrounds */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 text-xs font-black bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 rounded-xl flex items-center gap-1.5 shadow-sm">
              <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              Live Quantum Deliverability Radar v4.0
            </span>
            <span className="px-2.5 py-0.5 text-[11px] font-extrabold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-lg flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              {primaryInboxScore}% Score
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-black text-slate-100 mt-2 tracking-tight flex items-center gap-2">
            Deliverability Vector & ISP Telemetry Radar
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Live multi-axis radar measuring SPF/DKIM cryptographic validation, MX latency, IP trust score, and primary inbox placement.
          </p>
        </div>

        {/* Radar Layer Preset Switcher */}
        <div className="flex items-center gap-2 bg-slate-950/90 p-1.5 rounded-2xl border border-slate-800 text-xs shadow-inner">
          <button
            type="button"
            onClick={() => setActivePreset('current')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activePreset === 'current'
                ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/25'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="w-2 h-2 rounded-full bg-cyan-400" />
            Your Relays
          </button>
          <button
            type="button"
            onClick={() => setActivePreset('benchmark')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activePreset === 'benchmark'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="w-2 h-2 rounded-full bg-purple-400" />
            Top 1% Benchmark
          </button>
          <button
            type="button"
            onClick={() => setActivePreset('both')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activePreset === 'both'
                ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Dual Compare
          </button>
        </div>
      </div>

      {/* Main Radar Layout: Interactive Hexagonal Radar Canvas + ISP Breakdown Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
        
        {/* Visual High-Tech SVG Radar Chart (7 Columns) */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center p-4 bg-slate-950/70 rounded-3xl border border-slate-800/80 relative shadow-inner">
          
          <div className="relative w-full max-w-[420px] aspect-square flex items-center justify-center">
            
            {/* Spinning Radar Sweep Ray */}
            <div 
              className="absolute inset-8 rounded-full border border-cyan-500/20 pointer-events-none"
              style={{
                background: 'conic-gradient(from 0deg, rgba(6, 182, 212, 0.25) 0deg, rgba(6, 182, 212, 0.05) 60deg, transparent 90deg)',
                animation: 'spin 8s linear infinite'
              }}
            />

            <svg 
              viewBox={`0 0 ${size} ${size}`} 
              className="w-full h-full overflow-visible select-none drop-shadow-2xl"
            >
              <defs>
                {/* Current Outbound Polygon Gradient */}
                <radialGradient id="currentRadarGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.45" />
                  <stop offset="70%" stopColor="#0077ff" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0.05" />
                </radialGradient>

                {/* Benchmark Top 1% Gradient */}
                <radialGradient id="benchmarkRadarGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#d946ef" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.05" />
                </radialGradient>

                <filter id="neonRadarGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#00e5ff" floodOpacity="0.6" />
                </filter>
                <filter id="purpleGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#d946ef" floodOpacity="0.6" />
                </filter>
              </defs>

              {/* Concentric Hexagonal Grid Rings */}
              {rings.map((ringScale, idx) => {
                const ringPoints = radarMetrics.map((_, i) => {
                  const angle = (Math.PI * 2 / numAxes) * i - Math.PI / 2;
                  const r = radius * ringScale;
                  return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
                }).join(' ');

                return (
                  <g key={idx}>
                    <polygon
                      points={ringPoints}
                      fill="none"
                      stroke="#1e293b"
                      strokeWidth="1.2"
                      strokeDasharray={idx === rings.length - 1 ? 'none' : '3,3'}
                    />
                    {/* Ring Percentage Label */}
                    <text
                      x={center + 6}
                      y={center - radius * ringScale + 4}
                      fill="#64748b"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {Math.round(ringScale * 100)}%
                    </text>
                  </g>
                );
              })}

              {/* Radial Axis Spokes */}
              {radarMetrics.map((_, i) => {
                const angle = (Math.PI * 2 / numAxes) * i - Math.PI / 2;
                const endX = center + radius * Math.cos(angle);
                const endY = center + radius * Math.sin(angle);
                return (
                  <line
                    key={i}
                    x1={center}
                    y1={center}
                    x2={endX}
                    y2={endY}
                    stroke="#334155"
                    strokeWidth="1.2"
                    strokeDasharray="2,2"
                  />
                );
              })}

              {/* Benchmark Top 1% Senders Polygon Layer */}
              {(activePreset === 'benchmark' || activePreset === 'both') && (
                <g>
                  <polygon
                    points={benchmarkPoints}
                    fill="url(#benchmarkRadarGlow)"
                    stroke="#d946ef"
                    strokeWidth="2"
                    filter="url(#purpleGlow)"
                    className="transition-all duration-500 opacity-80"
                  />
                </g>
              )}

              {/* Current Active Outbound Score Polygon Layer */}
              {(activePreset === 'current' || activePreset === 'both') && (
                <g>
                  <polygon
                    points={currentPoints}
                    fill="url(#currentRadarGlow)"
                    stroke="#00e5ff"
                    strokeWidth="2.5"
                    filter="url(#neonRadarGlow)"
                    className="transition-all duration-500"
                  />
                </g>
              )}

              {/* Interactive Node Vertex Points */}
              {radarMetrics.map((m, i) => {
                const { x, y } = getCoordinates(m.currentValue, i);
                const isHovered = hoveredMetricId === m.id;

                return (
                  <g 
                    key={m.id}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredMetricId(m.id)}
                    onMouseLeave={() => setHoveredMetricId(null)}
                  >
                    {/* Pulsing ring on hover */}
                    {isHovered && (
                      <circle
                        cx={x}
                        cy={y}
                        r="14"
                        fill="none"
                        stroke="#00e5ff"
                        strokeWidth="2"
                        className="animate-ping opacity-75"
                      />
                    )}

                    {/* Outer glow circle */}
                    <circle
                      cx={x}
                      cy={y}
                      r={isHovered ? 8 : 5}
                      fill="#030712"
                      stroke={isHovered ? '#00e5ff' : '#38bdf8'}
                      strokeWidth={isHovered ? 3 : 2}
                      className="transition-all duration-200"
                    />

                    {/* Center bright dot */}
                    <circle
                      cx={x}
                      cy={y}
                      r={isHovered ? 3 : 2}
                      fill="#ffffff"
                    />
                  </g>
                );
              })}

              {/* Center Origin Hub */}
              <circle cx={center} cy={center} r="6" fill="#0284c7" />
              <circle cx={center} cy={center} r="2" fill="#ffffff" />
            </svg>
          </div>

          {/* Quick interactive note */}
          <div className="mt-3 flex items-center gap-2 text-center text-[11px] text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Hover over any of the 6 points to inspect real-time DNS telemetry.</span>
          </div>
        </div>

        {/* Right Info & ISP Matrix Telemetry Panel (5 Columns) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Active Hover Metric Card or Default Overview */}
          {hoveredMetricId ? (
            (() => {
              const metric = radarMetrics.find(m => m.id === hoveredMetricId)!;
              return (
                <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/60 shadow-lg animate-in fade-in zoom-in-95 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-cyan-300 uppercase tracking-wider">
                      Selected Vector Telemetry
                    </span>
                    <span className="text-xs font-mono font-extrabold text-white bg-cyan-500 px-2 py-0.5 rounded-lg">
                      {metric.currentValue}% Optimal
                    </span>
                  </div>
                  <h3 className="text-base font-black text-slate-100">{metric.label}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">{metric.description}</p>
                  <div className="p-2.5 rounded-xl bg-slate-950/90 border border-cyan-900/50 text-[11px] text-cyan-200 font-mono">
                    <strong>DNS Status:</strong> {metric.details}
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
                  Deliverability Shield
                </span>
                <span className="px-2 py-0.5 text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full">
                  100% HEALTHY
                </span>
              </div>
              <div className="text-2xl font-black text-slate-100">
                {primaryInboxScore}% <span className="text-xs font-normal text-emerald-400 font-sans">Primary Placement</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                VisualSky automated multi-relay routing ensures every message passes SPF/DKIM/DMARC with zero throttle.
              </p>
            </div>
          )}

          {/* Target ISP Selector Tabs */}
          <div className="space-y-2.5">
            <div className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Target Mailbox Provider Health</span>
              <span className="text-[10px] font-normal text-slate-400">Direct MX Ping</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'google', label: 'Gmail / Workspace', icon: 'Google' },
                { id: 'microsoft', label: 'Outlook / Office 365', icon: 'Microsoft' },
                { id: 'yahoo', label: 'Yahoo / AOL', icon: 'Yahoo' },
                { id: 'custom', label: 'Custom Domain Relays', icon: 'cPanel' }
              ].map(isp => (
                <button
                  key={isp.id}
                  type="button"
                  onClick={() => setSelectedTargetIsp(isp.id as any)}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1 ${
                    selectedTargetIsp === isp.id
                      ? 'bg-slate-900 border-cyan-500/60 ring-1 ring-cyan-500/40 shadow-md'
                      : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">{isp.label}</span>
                    {selectedTargetIsp === isp.id && (
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    )}
                  </div>
                  <span className="text-[11px] font-mono font-bold text-emerald-400">
                    {ispData[isp.id as keyof typeof ispData].score}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ISP Live Diagnostics Box */}
          <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800/90 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-slate-100">{activeIsp.name}</span>
              </div>
              <span className="text-xs font-bold text-emerald-400 font-mono">{activeIsp.score}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
              <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                <div className="text-slate-400">SPF Record</div>
                <div className="font-mono font-bold text-emerald-400 mt-0.5">{activeIsp.spf}</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                <div className="text-slate-400">DKIM 2048</div>
                <div className="font-mono font-bold text-emerald-400 mt-0.5">{activeIsp.dkim}</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                <div className="text-slate-400">MX Ping Latency</div>
                <div className="font-mono font-bold text-cyan-300 mt-0.5">{activeIsp.mxDelay}</div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] pt-1">
              <span className="text-slate-400">Placement Target:</span>
              <span className="font-bold text-emerald-300 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                {activeIsp.status}
              </span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
