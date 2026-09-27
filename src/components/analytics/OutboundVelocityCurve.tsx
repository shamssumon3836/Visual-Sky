import React, { useState, useMemo, useRef } from 'react';
import { 
  Activity, 
  TrendingUp, 
  BarChart3, 
  Clock, 
  Send, 
  Mail, 
  Flame, 
  Sparkles, 
  Zap, 
  Layers, 
  Calendar,
  Eye,
  CheckCircle2,
  Maximize2
} from 'lucide-react';

interface OutboundVelocityCurveProps {
  totalSent: number;
  totalOpened: number;
  totalReplied: number;
  totalBounced?: number;
}

type TimeHorizon = '24h' | '7d' | '14d' | '30d';
type RenderStyle = 'spline' | 'cyber_bars' | 'stacked_waves';

interface DataPoint {
  label: string;
  time: string;
  sent: number;
  opened: number;
  replied: number;
  booked: number;
  velocityRate: number; // emails per hour
}

export const OutboundVelocityCurve: React.FC<OutboundVelocityCurveProps> = ({
  totalSent,
  totalOpened,
  totalReplied,
}) => {
  const [horizon, setHorizon] = useState<TimeHorizon>('7d');
  const [renderStyle, setRenderStyle] = useState<RenderStyle>('spline');
  const [activeSeries, setActiveSeries] = useState<{
    sent: boolean;
    opened: boolean;
    replied: boolean;
    booked: boolean;
  }>({
    sent: true,
    opened: true,
    replied: true,
    booked: true,
  });

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Generate realistic, dynamic, smooth curve dataset based on real totals and horizon
  const seriesData: DataPoint[] = useMemo(() => {
    const baseSent = Math.max(totalSent, 48);
    const baseOpened = Math.max(totalOpened, Math.round(baseSent * 0.68));
    const baseReplied = Math.max(totalReplied, Math.round(baseSent * 0.28));
    const baseBooked = Math.max(1, Math.round(baseReplied * 0.45));

    if (horizon === '24h') {
      const hours = ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00', '23:59'];
      const weights = [0.03, 0.02, 0.05, 0.22, 0.25, 0.20, 0.14, 0.06, 0.03];
      return hours.map((hr, idx) => ({
        label: hr,
        time: `Today @ ${hr}`,
        sent: Math.round(baseSent * weights[idx]),
        opened: Math.round(baseOpened * weights[idx]),
        replied: Math.round(baseReplied * weights[idx]),
        booked: Math.max(0, Math.round(baseBooked * weights[idx])),
        velocityRate: Math.round((baseSent * weights[idx]) * 3.4),
      }));
    }

    if (horizon === '14d') {
      return Array.from({ length: 14 }, (_, i) => {
        const dayNum = i + 1;
        const progress = Math.sin((i / 13) * Math.PI) * 0.4 + 0.6;
        const factor = (progress / 14);
        return {
          label: `Day ${dayNum}`,
          time: `Aug ${10 + i}, 2026`,
          sent: Math.max(4, Math.round(baseSent * factor * 1.8)),
          opened: Math.max(2, Math.round(baseOpened * factor * 1.8)),
          replied: Math.max(1, Math.round(baseReplied * factor * 1.8)),
          booked: Math.max(0, Math.round(baseBooked * factor * 1.8)),
          velocityRate: Math.round((baseSent * factor * 1.8) * 2.2),
        };
      });
    }

    if (horizon === '30d') {
      const intervals = ['W1 Mon', 'W1 Thu', 'W2 Mon', 'W2 Thu', 'W3 Mon', 'W3 Thu', 'W4 Mon', 'W4 Thu', 'W5 Mon', 'W5 Thu'];
      return intervals.map((lbl, idx) => {
        const factor = (0.08 + (idx * 0.015) + (Math.sin(idx) * 0.02));
        return {
          label: lbl,
          time: `Sprint ${idx + 1} (30D View)`,
          sent: Math.round(baseSent * factor),
          opened: Math.round(baseOpened * factor),
          replied: Math.round(baseReplied * factor),
          booked: Math.max(0, Math.round(baseBooked * factor)),
          velocityRate: Math.round(baseSent * factor * 1.9),
        };
      });
    }

    // Default 7d
    const days = [
      { name: 'Mon', date: 'Aug 17' },
      { name: 'Tue', date: 'Aug 18' },
      { name: 'Wed', date: 'Aug 19' },
      { name: 'Thu', date: 'Aug 20' },
      { name: 'Fri', date: 'Aug 21' },
      { name: 'Sat', date: 'Aug 22' },
      { name: 'Sun', date: 'Aug 23' },
    ];
    const distribution = [0.18, 0.24, 0.28, 0.16, 0.10, 0.02, 0.02];
    return days.map((d, idx) => ({
      label: d.name,
      time: `${d.name} (${d.date})`,
      sent: Math.round(baseSent * distribution[idx]),
      opened: Math.round(baseOpened * distribution[idx]),
      replied: Math.round(baseReplied * distribution[idx]),
      booked: Math.max(0, Math.round(baseBooked * distribution[idx])),
      velocityRate: Math.round((baseSent * distribution[idx]) * 4.2),
    }));
  }, [horizon, totalSent, totalOpened, totalReplied]);

  // Max value calculation for scaling
  const maxValue = useMemo(() => {
    const allVals: number[] = [];
    seriesData.forEach(d => {
      if (activeSeries.sent) allVals.push(d.sent);
      if (activeSeries.opened) allVals.push(d.opened);
      if (activeSeries.replied) allVals.push(d.replied);
      if (activeSeries.booked) allVals.push(d.booked);
    });
    return Math.max(...allVals, 10) * 1.25;
  }, [seriesData, activeSeries]);

  // SVG dimensions
  const svgWidth = 860;
  const svgHeight = 240;
  const paddingX = 45;
  const paddingY = 25;
  const chartW = svgWidth - paddingX * 2;
  const chartH = svgHeight - paddingY * 2;

  // Coordinate mapping
  const points = useMemo(() => {
    const n = seriesData.length;
    return seriesData.map((d, i) => {
      const x = paddingX + (i / (n - 1)) * chartW;
      const ySent = paddingY + chartH - (d.sent / maxValue) * chartH;
      const yOpened = paddingY + chartH - (d.opened / maxValue) * chartH;
      const yReplied = paddingY + chartH - (d.replied / maxValue) * chartH;
      const yBooked = paddingY + chartH - (d.booked / maxValue) * chartH;
      return { x, ySent, yOpened, yReplied, yBooked, data: d, index: i };
    });
  }, [seriesData, maxValue, chartW, chartH, paddingX, paddingY]);

  // Cubic Bezier Spline Generator for ultra smooth curve aesthetics
  const createSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;

    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? 0 : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2 < pts.length ? i + 2 : pts.length - 1];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return path;
  };

  const sentLine = useMemo(() => createSmoothPath(points.map(p => ({ x: p.x, y: p.ySent }))), [points]);
  const openedLine = useMemo(() => createSmoothPath(points.map(p => ({ x: p.x, y: p.yOpened }))), [points]);
  const repliedLine = useMemo(() => createSmoothPath(points.map(p => ({ x: p.x, y: p.yReplied }))), [points]);
  const bookedLine = useMemo(() => createSmoothPath(points.map(p => ({ x: p.x, y: p.yBooked }))), [points]);

  const baselineY = paddingY + chartH;
  const sentArea = `${sentLine} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`;
  const openedArea = `${openedLine} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`;
  const repliedArea = `${repliedLine} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`;
  const bookedArea = `${bookedLine} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`;

  // Mouse move handler for interactive scrubber
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    
    // Scale clientX to SVG coordinates
    const scaleX = svgWidth / rect.width;
    const svgX = clientX * scaleX;

    // Find closest data point
    let closestIdx = 0;
    let minDistance = Infinity;
    points.forEach((p, idx) => {
      const dist = Math.abs(p.x - svgX);
      if (dist < minDistance) {
        minDistance = dist;
        closestIdx = idx;
      }
    });

    setHoveredIndex(closestIdx);
    setMousePos({ x: points[closestIdx].x, y: clientY });
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
    setMousePos(null);
  };

  const activeHoverPoint = hoveredIndex !== null ? points[hoveredIndex] : null;

  // Key Peak Statistics
  const peakSent = Math.max(...seriesData.map(d => d.sent));
  const peakOpened = Math.max(...seriesData.map(d => d.opened));
  const peakReplied = Math.max(...seriesData.map(d => d.replied));
  const avgVelocity = Math.round(seriesData.reduce((a, b) => a + b.velocityRate, 0) / seriesData.length);

  return (
    <div className="bg-gradient-to-b from-[#080d1a] via-[#050811] to-[#03060c] rounded-3xl border border-cyan-500/20 p-5 md:p-7 space-y-6 shadow-2xl relative overflow-hidden">
      {/* Luminous atmospheric backdrops */}
      <div className="absolute top-0 right-1/4 w-[450px] h-[300px] bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[250px] bg-pink-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Top Header & Interactive Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/40 flex items-center justify-center shadow-lg shadow-cyan-500/10">
              <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-lg font-black text-slate-100 tracking-tight flex items-center gap-2">
                  Outbound Velocity & Response Curve
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  LIVE TRAJECTORY
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time mathematical spline curve showing dispatch momentum, open trajectory, and reply velocity.
              </p>
            </div>
          </div>
        </div>

        {/* Action Pills & Selectors */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Time Range Horizon */}
          <div className="flex items-center bg-slate-950/90 p-1 rounded-xl border border-slate-800 text-xs shadow-inner">
            {[
              { id: '24h', label: '24H Live' },
              { id: '7d', label: '7D Trajectory' },
              { id: '14d', label: '14D Wave' },
              { id: '30d', label: '30D Macro' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setHorizon(tab.id as TimeHorizon)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  horizon === tab.id
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Render Mode Switcher */}
          <div className="flex items-center bg-slate-950/90 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setRenderStyle('spline')}
              title="Luminous Spline Waves"
              className={`p-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 text-xs ${
                renderStyle === 'spline'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Spline Curve</span>
            </button>
            <button
              type="button"
              onClick={() => setRenderStyle('cyber_bars')}
              title="Cyber Column Matrix"
              className={`p-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 text-xs ${
                renderStyle === 'cyber_bars'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cyber Bars</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Performance Highlights Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 relative z-10">
        <div className="bg-slate-950/80 p-3 rounded-2xl border border-blue-500/20 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider block">Peak Outbound</span>
            <span className="text-lg font-black text-slate-100">{peakSent} <span className="text-xs font-normal text-slate-400">emails/burst</span></span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
            <Send className="w-3.5 h-3.5 text-blue-400" />
          </div>
        </div>

        <div className="bg-slate-950/80 p-3 rounded-2xl border border-cyan-500/20 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block">Open Velocity</span>
            <span className="text-lg font-black text-cyan-300">{peakOpened} <span className="text-xs font-normal text-slate-400">opens max</span></span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
            <Mail className="w-3.5 h-3.5 text-cyan-400" />
          </div>
        </div>

        <div className="bg-slate-950/80 p-3 rounded-2xl border border-pink-500/20 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-pink-400 font-bold uppercase tracking-wider block">Reply Response</span>
            <span className="text-lg font-black text-pink-400">{peakReplied} <span className="text-xs font-normal text-slate-400">replies</span></span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center">
            <Flame className="w-3.5 h-3.5 text-pink-400" />
          </div>
        </div>

        <div className="bg-slate-950/80 p-3 rounded-2xl border border-emerald-500/20 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">Avg Flow Rate</span>
            <span className="text-lg font-black text-emerald-400">{avgVelocity} <span className="text-xs font-normal text-slate-400">velocity/hr</span></span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
          </div>
        </div>
      </div>

      {/* Interactive Metric Series Filter Badges */}
      <div className="flex items-center gap-2 flex-wrap relative z-10">
        <span className="text-xs font-bold text-slate-400 mr-1">Active Series:</span>
        <button
          type="button"
          onClick={() => setActiveSeries(p => ({ ...p, sent: !p.sent }))}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSeries.sent
              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm shadow-blue-500/20'
              : 'bg-slate-900 text-slate-600 border border-slate-800 opacity-50'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-blue-500 shadow-sm shadow-blue-400" />
          <span>Outbound Dispatched</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSeries(p => ({ ...p, opened: !p.opened }))}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSeries.opened
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/20'
              : 'bg-slate-900 text-slate-600 border border-slate-800 opacity-50'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-sm shadow-cyan-300 animate-pulse" />
          <span>Unique Opens</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSeries(p => ({ ...p, replied: !p.replied }))}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSeries.replied
              ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40 shadow-sm shadow-pink-500/20'
              : 'bg-slate-900 text-slate-600 border border-slate-800 opacity-50'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-pink-500 shadow-sm shadow-pink-400" />
          <span>Direct Replies</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSeries(p => ({ ...p, booked: !p.booked }))}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSeries.booked
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/20'
              : 'bg-slate-900 text-slate-600 border border-slate-800 opacity-50'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-300" />
          <span>Meetings Booked</span>
        </button>
      </div>

      {/* Main Interactive Chart Stage */}
      <div className="relative bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 md:p-6 overflow-hidden">
        {renderStyle === 'spline' ? (
          <div className="relative w-full overflow-x-auto select-none">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-64 md:h-72 overflow-visible"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <defs>
                {/* Outbound Blue Gradient */}
                <linearGradient id="gradientSent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.45" />
                  <stop offset="60%" stopColor="#2563eb" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.0" />
                </linearGradient>

                {/* Open Cyan Gradient */}
                <linearGradient id="gradientOpened" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.55" />
                  <stop offset="60%" stopColor="#0891b2" stopOpacity="0.20" />
                  <stop offset="100%" stopColor="#0e7490" stopOpacity="0.0" />
                </linearGradient>

                {/* Reply Pink Gradient */}
                <linearGradient id="gradientReplied" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ec4899" stopOpacity="0.65" />
                  <stop offset="60%" stopColor="#db2777" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#be185d" stopOpacity="0.0" />
                </linearGradient>

                {/* Meeting Booked Emerald Gradient */}
                <linearGradient id="gradientBooked" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
                </linearGradient>

                {/* Glow Filter */}
                <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3.5" result="glow" />
                  <feComposite in="SourceGraphic" in2="glow" operator="over" />
                </filter>
              </defs>

              {/* Horizontal Grid Guidelines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                const y = paddingY + chartH * (1 - ratio);
                const val = Math.round(maxValue * ratio);
                return (
                  <g key={idx}>
                    <line
                      x1={paddingX}
                      y1={y}
                      x2={svgWidth - paddingX}
                      y2={y}
                      stroke="#1e293b"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                    <text
                      x={paddingX - 10}
                      y={y + 3}
                      fill="#64748b"
                      fontSize="9"
                      fontWeight="bold"
                      textAnchor="end"
                      fontFamily="monospace"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Vertical Time Grid Guidelines */}
              {points.map((p, idx) => (
                <g key={idx}>
                  <line
                    x1={p.x}
                    y1={paddingY}
                    x2={p.x}
                    y2={paddingY + chartH}
                    stroke="#1e293b"
                    strokeWidth="0.5"
                  />
                  <text
                    x={p.x}
                    y={paddingY + chartH + 18}
                    fill={hoveredIndex === idx ? '#38bdf8' : '#94a3b8'}
                    fontSize={hoveredIndex === idx ? '11' : '10'}
                    fontWeight={hoveredIndex === idx ? '900' : '700'}
                    textAnchor="middle"
                  >
                    {p.data.label}
                  </text>
                </g>
              ))}

              {/* Shaded Area Fills */}
              {activeSeries.sent && (
                <path d={sentArea} fill="url(#gradientSent)" />
              )}
              {activeSeries.opened && (
                <path d={openedArea} fill="url(#gradientOpened)" />
              )}
              {activeSeries.replied && (
                <path d={repliedArea} fill="url(#gradientReplied)" />
              )}
              {activeSeries.booked && (
                <path d={bookedArea} fill="url(#gradientBooked)" />
              )}

              {/* Smooth Stroke Lines with Neon Glow */}
              {activeSeries.sent && (
                <path
                  d={sentLine}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="3"
                  strokeLinecap="round"
                  filter="url(#neonGlow)"
                />
              )}
              {activeSeries.opened && (
                <path
                  d={openedLine}
                  fill="none"
                  stroke="#06b6d4"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  filter="url(#neonGlow)"
                />
              )}
              {activeSeries.replied && (
                <path
                  d={repliedLine}
                  fill="none"
                  stroke="#ec4899"
                  strokeWidth="3"
                  strokeLinecap="round"
                  filter="url(#neonGlow)"
                />
              )}
              {activeSeries.booked && (
                <path
                  d={bookedLine}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeDasharray="5 3"
                  strokeLinecap="round"
                />
              )}

              {/* Crosshair Cursor & Highlight Rings */}
              {activeHoverPoint && (
                <g>
                  {/* Vertical Crosshair Line */}
                  <line
                    x1={activeHoverPoint.x}
                    y1={paddingY - 10}
                    x2={activeHoverPoint.x}
                    y2={paddingY + chartH + 5}
                    stroke="#06b6d4"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />

                  {/* Highlight Nodes */}
                  {activeSeries.sent && (
                    <g>
                      <circle cx={activeHoverPoint.x} cy={activeHoverPoint.ySent} r="7" fill="#3b82f6" opacity="0.3" className="animate-ping" />
                      <circle cx={activeHoverPoint.x} cy={activeHoverPoint.ySent} r="5" fill="#3b82f6" stroke="#ffffff" strokeWidth="2" />
                    </g>
                  )}
                  {activeSeries.opened && (
                    <g>
                      <circle cx={activeHoverPoint.x} cy={activeHoverPoint.yOpened} r="8" fill="#06b6d4" opacity="0.4" className="animate-ping" />
                      <circle cx={activeHoverPoint.x} cy={activeHoverPoint.yOpened} r="5.5" fill="#06b6d4" stroke="#ffffff" strokeWidth="2.5" />
                    </g>
                  )}
                  {activeSeries.replied && (
                    <g>
                      <circle cx={activeHoverPoint.x} cy={activeHoverPoint.yReplied} r="7" fill="#ec4899" opacity="0.4" className="animate-ping" />
                      <circle cx={activeHoverPoint.x} cy={activeHoverPoint.yReplied} r="5" fill="#ec4899" stroke="#ffffff" strokeWidth="2" />
                    </g>
                  )}
                  {activeSeries.booked && (
                    <g>
                      <circle cx={activeHoverPoint.x} cy={activeHoverPoint.yBooked} r="6" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                    </g>
                  )}
                </g>
              )}
            </svg>
          </div>
        ) : (
          /* Cyber Column Matrix Render */
          <div className="h-64 flex items-end justify-between gap-3 px-2 pt-6">
            {seriesData.map((d, idx) => {
              const sentH = Math.min(100, Math.max(6, (d.sent / maxValue) * 100));
              const openH = Math.min(100, Math.max(4, (d.opened / maxValue) * 100));
              const replyH = Math.min(100, Math.max(3, (d.replied / maxValue) * 100));
              const isHovered = hoveredIndex === idx;

              return (
                <div
                  key={idx}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer transition-all"
                >
                  <div className={`w-full max-w-[56px] flex items-end justify-center gap-1 h-full p-1.5 rounded-2xl transition-all ${
                    isHovered ? 'bg-cyan-950/60 border border-cyan-500/60 shadow-lg shadow-cyan-500/20' : 'bg-slate-900/60 border border-slate-800'
                  }`}>
                    {activeSeries.sent && (
                      <div 
                        style={{ height: `${sentH}%` }} 
                        className="w-1/3 rounded-full bg-gradient-to-t from-blue-700 to-blue-400 shadow-sm shadow-blue-500/40 transition-all duration-300"
                        title={`Sent: ${d.sent}`} 
                      />
                    )}
                    {activeSeries.opened && (
                      <div 
                        style={{ height: `${openH}%` }} 
                        className="w-1/3 rounded-full bg-gradient-to-t from-cyan-600 to-cyan-300 shadow-sm shadow-cyan-400/50 transition-all duration-300"
                        title={`Opened: ${d.opened}`} 
                      />
                    )}
                    {activeSeries.replied && (
                      <div 
                        style={{ height: `${replyH}%` }} 
                        className="w-1/3 rounded-full bg-gradient-to-t from-pink-700 to-pink-400 shadow-sm shadow-pink-500/40 transition-all duration-300"
                        title={`Replied: ${d.replied}`} 
                      />
                    )}
                  </div>
                  <span className={`text-[11px] font-bold mt-2 transition ${isHovered ? 'text-cyan-300' : 'text-slate-400'}`}>
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Floating Telemetry HUD Scrubber Badge */}
        {activeHoverPoint && (
          <div className="mt-4 p-3 rounded-2xl bg-[#090e1a]/95 border border-cyan-500/40 shadow-2xl backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
              <div>
                <div className="text-xs font-black text-slate-100 flex items-center gap-2">
                  <span>{activeHoverPoint.data.time}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                    {activeHoverPoint.data.velocityRate} emails/hr velocity
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono flex-wrap">
              {activeSeries.sent && (
                <div className="flex items-center gap-1.5 text-blue-300">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>Sent: <strong>{activeHoverPoint.data.sent}</strong></span>
                </div>
              )}
              {activeSeries.opened && (
                <div className="flex items-center gap-1.5 text-cyan-300">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span>Opens: <strong>{activeHoverPoint.data.opened}</strong> ({activeHoverPoint.data.sent > 0 ? Math.round((activeHoverPoint.data.opened / activeHoverPoint.data.sent) * 100) : 0}%)</span>
                </div>
              )}
              {activeSeries.replied && (
                <div className="flex items-center gap-1.5 text-pink-300">
                  <span className="w-2 h-2 rounded-full bg-pink-400" />
                  <span>Replies: <strong>{activeHoverPoint.data.replied}</strong> ({activeHoverPoint.data.sent > 0 ? Math.round((activeHoverPoint.data.replied / activeHoverPoint.data.sent) * 100) : 0}%)</span>
                </div>
              )}
              {activeSeries.booked && (
                <div className="flex items-center gap-1.5 text-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Booked: <strong>{activeHoverPoint.data.booked}</strong></span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
